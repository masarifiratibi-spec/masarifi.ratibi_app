"""Local behavioral tests. No SSH, Docker, live DB, financial operations or Staging writes."""
import copy
import importlib.util
from pathlib import Path
import stat
from types import SimpleNamespace
import sys
import json
import subprocess
import unittest
from unittest.mock import patch
import tempfile

spec = importlib.util.spec_from_file_location("redmi_watchdog", Path(__file__).with_name("redmi-voice-rollback-watchdog.py"))
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)
NOW = watchdog.instant("2026-10-11T01:00:00.000Z")


def control():
    packet = {
        "version": 2, "mode": "canary", "project": watchdog.PROJECT, "device": "f66a40694eca",
        "attemptId": "11111111-1111-4111-8111-111111111111", "sourceSha": watchdog.SOURCE,
        "imageDigest": watchdog.DIGEST, "kind": "expense", "expenseMinor": 1000,
        "maxExpenseMinor": 1000, "maxTransactions": 1, "maxPostings": 1, "currency": "SAR", "locale": "ar",
        "ownerId": "user_LOCALFixture", "clerkSessionHash": "9" * 64,
        "startsAt": "2026-10-11T01:00:00.000Z", "deadline": "2026-10-11T01:05:00.000Z",
        "baseline": {"observedAt": "2026-10-11T00:59:59.000Z", "balancesHash": "1" * 64},
    }
    descriptor = {
        "host": watchdog.HOST, "project": watchdog.PROJECT,
        "scope": "redmi-voice-" + packet["attemptId"], "workerName": watchdog.WORKER_NAME,
        "originalAnalysisID": watchdog.ANALYSIS_ID, "originalAssistantID": watchdog.ASSISTANT_ID,
        "originalAPIComposeFiles": [{"path": watchdog.COHORT + "/compose.backend.yml", "sha256": "2" * 64}],
        "envHashes": {name: "3" * 64 for name in watchdog.ENV_NAMES},
        "watchdogHash": "4" * 64, "redmiControlsHash": "5" * 64,
        "candidateComposeHash": "6" * 64, "databaseCAHash": "7" * 64,
        "watchdogUnitHash": "c" * 64,
    }
    packet["controlHash"] = watchdog.canonical_hash(descriptor)
    scope_hash = watchdog.scope_hash(packet)
    return {
        "packet": packet, "rollback": descriptor, "scopeHash": scope_hash,
        "approval": {"kind": "direct-human-financial-approval", "packetHash": scope_hash,
                     "messageReference": "TEST-only-user-turn", "verbatimMessage": "TEST ONLY approval of fictitious local scope.",
                     "receivedAt": "2026-10-10T20:00:00.000Z"},
        "epochId": "22222222-2222-4222-8222-222222222222", "manifestHash": "8" * 64,
        "workerID": "a" * 64, "deadline": packet["deadline"],
    }


def container(name, service, identity="a" * 64, scoped=None, epoch=None):
    labels = {"com.docker.compose.project": "masarifi-staging", "com.docker.compose.service": service}
    environment = ["MASARIFI_RELEASE_VERSION=" + watchdog.SOURCE, "SUPABASE_URL=https://" + watchdog.PROJECT + ".supabase.co"]
    if scoped:
        labels["org.masarifi.scope"] = scoped
        environment.append("MASARIFI_STAGING_VOICE_EPOCH_ID=" + epoch)
    return {"Id": identity, "Name": "/" + name, "Config": {"Image": watchdog.IMAGE, "Labels": labels, "Env": environment},
            "HostConfig": {"NetworkMode": "masarifi-staging_backend"}, "State": {"Running": True}}


class RecordingBoundary:
    """Records host-action selection; it does not implement or simulate ledger behavior."""
    def __init__(self, failure=None, closed=None):
        self.actions = []
        self.failure = failure
        self.closed = {"posting": False, "state": "closed"} if closed is None else closed

    def step(self, action):
        self.actions.append(action)
        if self.failure == action:
            raise watchdog.GuardError("TEST_BOUNDARY_FAILURE")

    def guard(self, scope):
        self.step("guard")
        watchdog.validate_control(scope, NOW + 3600)

    def close_epoch(self, scope):
        self.step("close_epoch")
        return self.closed

    def stop_owned_worker(self, scope):
        self.step("stop_owned_worker")

    def restore_guard(self, scope):
        self.step("restore_guard")

    def restore_api(self, scope):
        self.step("restore_api")

    def start_preserved_analysis(self, scope):
        self.step("start_preserved_analysis")

    def verify_restored(self, scope):
        self.step("verify_restored")


class WatchdogTests(unittest.TestCase):
    def test_expired_scope_closes_before_exact_restoration_without_extra_services(self):
        boundary = RecordingBoundary()
        result = watchdog.rollback(control(), boundary)
        self.assertEqual(boundary.actions, ["guard", "close_epoch", "stop_owned_worker", "restore_guard", "restore_api", "start_preserved_analysis", "verify_restored"])
        self.assertTrue(result["postingOffConfirmed"])
        self.assertTrue(result["analysisRestored"])
        self.assertEqual(result["blockers"], [])

    def test_failed_database_fence_still_stops_owned_writer_and_never_reports_off(self):
        for boundary in (RecordingBoundary("close_epoch"), RecordingBoundary(closed={"posting": True, "state": "active"})):
            with self.subTest(boundary=boundary.failure):
                result = watchdog.rollback(control(), boundary)
                self.assertEqual(boundary.actions, ["guard", "close_epoch", "stop_owned_worker"])
                self.assertFalse(result["postingOffConfirmed"])
                self.assertTrue(result["workerStoppedConfirmed"])
                self.assertFalse(result["apiRestored"])

    def test_changed_restore_pins_leave_database_closed_and_writer_stopped(self):
        boundary = RecordingBoundary("restore_guard")
        result = watchdog.rollback(control(), boundary)
        self.assertEqual(boundary.actions, ["guard", "close_epoch", "stop_owned_worker", "restore_guard"])
        self.assertTrue(result["postingOffConfirmed"])
        self.assertTrue(result["workerStoppedConfirmed"])
        self.assertFalse(result["apiRestored"])

    def test_actual_database_invalid_json_still_stops_owned_writer(self):
        class InvalidDatabaseOutput(watchdog.LocalHost):
            def __init__(self, output):
                super().__init__("/test")
                self.output = output
                self.actions = []
            def guard(self, scope): pass
            def pin(self, path, digest, normalized=False): pass
            def run(self, command, timeout=25, environment=None):
                self.actions.append("database_command")
                return self.output
            def stop_owned_worker(self, scope):
                self.actions.append("stop_owned_worker")
        for output in ("not-json", "", "null", "[]", '"closed"', "123", '{"posting": "false", "state": "closed"}'):
            with self.subTest(output=output):
                boundary = InvalidDatabaseOutput(output)
                result = watchdog.rollback(control(), boundary)
                self.assertEqual(boundary.actions, ["database_command", "stop_owned_worker"])
                self.assertFalse(result["postingOffConfirmed"])
                self.assertTrue(result["workerStoppedConfirmed"])
                self.assertFalse(result["apiRestored"])
                self.assertEqual(result["blockers"], ["GuardError:DATABASE_OFF_UNCONFIRMED"])

    def test_wrong_type_closure_receipt_still_stops_owned_writer(self):
        for receipt in (None, [], "closed", 123):
            with self.subTest(receipt=receipt):
                boundary = RecordingBoundary()
                boundary.closed = receipt
                result = watchdog.rollback(control(), boundary)
                self.assertEqual(boundary.actions, ["guard", "close_epoch", "stop_owned_worker"])
                self.assertFalse(result["postingOffConfirmed"])
                self.assertTrue(result["workerStoppedConfirmed"])
                self.assertFalse(result["apiRestored"])
                self.assertEqual(result["blockers"], ["GuardError:DATABASE_OFF_UNCONFIRMED"])

    def test_prepared_arming_can_observe_active_then_completion_without_activation(self):
        class ArmingBoundary:
            def __init__(self): self.states = iter(("prepared", "active", "closed"))
            def snapshot(self, scope):
                state = next(self.states)
                return {"scopeValid": True, "state": state, "posting": state == "active", "committed": 0,
                        "apiReady": state == "active", "workerHealthy": state == "active"}
        moment = [NOW]
        announcements = []
        reason = watchdog.monitor(control(), ArmingBoundary(), lambda: moment[0], lambda seconds: moment.__setitem__(0, moment[0] + seconds), announcements.append)
        self.assertEqual(reason, "normal_closure")
        self.assertEqual(moment[0], NOW + 10)
        self.assertEqual(announcements, [{"status": "WATCHDOG_ARMED"}])

    def test_never_activated_prepared_epoch_closes_after_30_seconds_without_extension(self):
        class PreparedBoundary(RecordingBoundary):
            def snapshot(self, scope):
                self.step("status")
                return {"scopeValid": True, "state": "prepared", "posting": False, "committed": 0}
        boundary = PreparedBoundary()
        moment = [NOW]
        scope = control()
        original = copy.deepcopy(scope)
        reason = watchdog.monitor(scope, boundary, lambda: moment[0], lambda seconds: moment.__setitem__(0, moment[0] + seconds))
        self.assertEqual(reason, "arming_timeout")
        self.assertEqual(moment[0], NOW + 30)
        result = watchdog.rollback(scope, boundary)
        self.assertTrue(result["postingOffConfirmed"])
        self.assertTrue(result["workerStoppedConfirmed"])
        self.assertEqual(scope, original)
        self.assertNotIn("activate", boundary.actions)

    def test_prepared_arming_rejects_scope_posting_and_deadline_changes_immediately(self):
        prepared = {"scopeValid": True, "state": "prepared", "posting": False, "committed": 0}
        for changes, elapsed, expected in (({"scopeValid": False}, 0, "scope_failure"), ({"posting": True}, 0, "scope_failure"), ({}, 300, "deadline")):
            with self.subTest(changes=changes):
                reason, _ = watchdog.closure_reason({**prepared, **changes}, NOW + elapsed, NOW, NOW + 300, 0, NOW)
                self.assertEqual(reason, expected)
        # A restart cannot grant a new 30-second wait beyond packet start+30.
        reason, _ = watchdog.closure_reason(prepared, NOW + 35, NOW, NOW + 300, 0, NOW + 35)
        self.assertEqual(reason, "arming_timeout")
        class ChangedDeadline:
            def snapshot(self, scope):
                raise watchdog.GuardError("EPOCH_DEADLINE_CHANGED")
        self.assertEqual(watchdog.monitor(control(), ChangedDeadline(), lambda: NOW, lambda seconds: self.fail("must not wait")), "scope_failure")

    def test_prepared_snapshot_reads_database_status_without_probing_financial_worker(self):
        class PreparedHost(watchdog.LocalHost):
            def api_ready(self):
                raise AssertionError("PREPARED must only read status")
            def db(self, scope, action):
                self.action = action
                return {"state": "prepared", "posting": False, "committed": 0, "deadline": None, "heartbeatAt": None}
        host = PreparedHost("/test")
        result = host.snapshot(control())
        self.assertEqual(result["state"], "prepared")
        self.assertEqual(host.action, "status")
        self.assertFalse(result["workerHealthy"])

    def test_only_prepared_or_closed_unactivated_epochs_allow_null_database_deadline(self):
        class ReceiptHost(watchdog.LocalHost):
            def db(self, scope, action): return self.receipt
            def api_ready(self): raise AssertionError("invalid active receipt must fail before health probe")
        host = ReceiptHost("/test")
        for state in ("prepared", "closed"):
            host.receipt = {"state": state, "posting": False, "committed": 0, "deadline": None, "heartbeatAt": None}
            self.assertEqual(host.snapshot(control())["state"], state)
        for state, deadline in (("active", None), ("active", "2026-10-11T01:04:59.000Z"), ("prepared", "2026-10-11T01:04:59.000Z")):
            host.receipt = {"state": state, "posting": state == "active", "committed": 0, "deadline": deadline, "heartbeatAt": None}
            with self.subTest(state=state, deadline=deadline), self.assertRaisesRegex(watchdog.GuardError, "EPOCH_DEADLINE_CHANGED"):
                host.snapshot(control())

    def test_restoration_requires_api_provider_and_analysis_mode_provider_and_preserved_id(self):
        class RestoreHost(watchdog.LocalHost):
            def __init__(self):
                super().__init__("/test")
                self.api_env = {"MASARIFI_VOICE_ANALYSIS_ONLY": "true", "MASARIFI_AI_PROVIDER_ENABLED": "true"}
                self.analysis = container("masarifi-staging-analysis-worker-1", "analysis-worker", watchdog.ANALYSIS_ID)
                self.analysis["Config"]["Env"] += ["MASARIFI_VOICE_ANALYSIS_ONLY=true", "MASARIFI_AI_PROVIDER_ENABLED=true"]
            def restore_guard(self, scope): pass
            def api_ready(self): return self.api_env
            def inspect(self, identity):
                self.inspected = identity
                return self.analysis
        valid = RestoreHost()
        valid.verify_restored(control())
        self.assertEqual(valid.inspected, watchdog.ANALYSIS_ID)
        for drift in ("api_provider", "analysis_mode", "analysis_provider", "analysis_id", "analysis_stopped"):
            host = RestoreHost()
            if drift == "api_provider": host.api_env["MASARIFI_AI_PROVIDER_ENABLED"] = "false"
            elif drift == "analysis_mode": host.analysis["Config"]["Env"][-2] = "MASARIFI_VOICE_ANALYSIS_ONLY=false"
            elif drift == "analysis_provider": host.analysis["Config"]["Env"][-1] = "MASARIFI_AI_PROVIDER_ENABLED=false"
            elif drift == "analysis_id": host.analysis["Id"] = "b" * 64
            else: host.analysis["State"]["Running"] = False
            with self.subTest(drift=drift), patch.object(watchdog.time, "monotonic", side_effect=(0, 31)), self.assertRaisesRegex(watchdog.GuardError, "RESTORATION_READINESS_UNCONFIRMED"):
                host.verify_restored(control())

    def test_failed_final_readiness_does_not_claim_restoration(self):
        result = watchdog.rollback(control(), RecordingBoundary("verify_restored"))
        self.assertFalse(result["apiRestored"])
        self.assertFalse(result["analysisRestored"])

    def test_wrong_approval_descriptor_or_root_cannot_select_any_mutation(self):
        for field, replacement in (("scopeHash", "b" * 64), ("approval", None)):
            scope = control(); scope[field] = replacement
            boundary = RecordingBoundary()
            with self.subTest(field=field), self.assertRaises((watchdog.GuardError, TypeError)):
                watchdog.rollback(scope, boundary)
            self.assertEqual(boundary.actions, ["guard"])
        scope = control(); scope["rollback"]["originalAssistantID"] = "b" * 64
        with self.assertRaises(watchdog.GuardError):
            watchdog.validate_control(scope, NOW + 3600)
        directory = SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=0)
        guarded_file = SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0)
        watchdog.validate_root_location("/opt/masarifi/redmi-voice-fixture", watchdog.HOST, 0, directory, guarded_file)
        for wrong_file in (SimpleNamespace(st_mode=stat.S_IFREG | 0o644, st_uid=0), SimpleNamespace(st_mode=stat.S_IFLNK | 0o600, st_uid=0), SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=1000)):
            with self.subTest(mode=wrong_file.st_mode), self.assertRaises(watchdog.GuardError):
                watchdog.validate_root_location("/opt/masarifi/redmi-voice-fixture", watchdog.HOST, 0, directory, wrong_file)

    def test_candidate_artifact_drift_does_not_block_closure_but_blocks_restore(self):
        class ChangedCandidate(watchdog.LocalHost):
            def guard(self, scope):
                pass
            def pin(self, path, digest, normalized=False):
                if Path(path).name == "redmi-voice-compose.yml":
                    raise watchdog.GuardError("PIN_CHANGED")
            def inspect(self, identity):
                return container("masarifi-staging-api-1", "api")
        # The restoration guard must validate the candidate file before any
        # composition changes; the general provenance guard must not require it.
        with self.assertRaisesRegex(watchdog.GuardError, "PIN_CHANGED"):
            ChangedCandidate("/test").restore_guard(control())

    def test_shared_or_replaced_container_is_never_a_stop_target(self):
        scope = control()
        worker = container(watchdog.WORKER_NAME, "voice-redmi-acceptance", scoped=scope["rollback"]["scope"], epoch=scope["epochId"])
        watchdog.checked_container(worker, watchdog.WORKER_NAME, "voice-redmi-acceptance", scope["workerID"], scope["rollback"]["scope"], scope["epochId"])
        for changed in ("Id", "Name", "image", "scope", "project", "service", "epoch"):
            drift = copy.deepcopy(worker)
            if changed in ("Id", "Name"): drift[changed] = "foreign"
            elif changed == "image": drift["Config"]["Image"] = "foreign"
            elif changed == "epoch": drift["Config"]["Env"][-1] = "MASARIFI_STAGING_VOICE_EPOCH_ID=foreign"
            else: drift["Config"]["Labels"]["org.masarifi.scope" if changed == "scope" else "com.docker.compose." + changed] = "foreign"
            with self.subTest(changed=changed), self.assertRaises(watchdog.GuardError):
                watchdog.checked_container(drift, watchdog.WORKER_NAME, "voice-redmi-acceptance", scope["workerID"], scope["rollback"]["scope"], scope["epochId"])

    def test_actual_stop_and_restore_commands_select_only_new_writer_api_and_original_analysis_id(self):
        scope = control()
        class HostCommands(watchdog.LocalHost):
            def __init__(self):
                super().__init__("/test")
                self.commands = []
                self.running = True
            def guard(self, scope): pass
            def restore_guard(self, scope): pass
            def run(self, command, timeout=25, environment=None):
                self.commands.append(command)
                if command[:2] == ["docker", "stop"]: self.running = False
                return ""
            def inspect(self, identity):
                if identity == watchdog.ANALYSIS_ID:
                    result = container("masarifi-staging-analysis-worker-1", "analysis-worker", watchdog.ANALYSIS_ID)
                    result["State"]["Running"] = False
                    return result
                result = container(watchdog.WORKER_NAME, "voice-redmi-acceptance", scoped=scope["rollback"]["scope"], epoch=scope["epochId"])
                result["State"]["Running"] = self.running
                return result
        host = HostCommands()
        host.stop_owned_worker(scope)
        host.restore_api(scope)
        host.start_preserved_analysis(scope)
        self.assertEqual(host.commands[0], ["docker", "stop", "--time", "5", scope["workerID"]])
        self.assertEqual(host.commands[-1], ["docker", "start", watchdog.ANALYSIS_ID])
        self.assertEqual(host.commands[-2][-4:], ["up", "-d", "--no-deps", "api"])
        self.assertNotIn(watchdog.ASSISTANT_ID, str(host.commands))
        self.assertNotIn("masarifi-staging-voice-epoch-1", str(host.commands))

    def test_multiple_commits_are_scope_failure_instead_of_running_another_probe(self):
        reason, _ = watchdog.closure_reason({"scopeValid": True, "state": "active", "committed": 2, "apiReady": True, "workerHealthy": True}, NOW + 1, NOW, NOW + 300, 0)
        self.assertEqual(reason, "scope_failure")

    def test_local_command_timeout_and_stderr_are_sanitized_before_monitor_classification(self):
        host = watchdog.LocalHost("/test")
        with self.assertRaisesRegex(watchdog.GuardError, "HOST_COMMAND_TIMEOUT"):
            host.run([sys.executable, "-c", "import time;time.sleep(1)"], timeout=0.01)
        with self.assertRaises(watchdog.GuardError) as failed:
            host.run([sys.executable, "-c", "import sys;print('LOCAL_PRIVATE_DETAIL',file=sys.stderr);sys.exit(1)"])
        self.assertEqual(str(failed.exception), "HOST_COMMAND_FAILED")

    def test_python_approval_hash_matches_the_actual_redmi_control_module(self):
        module = str(Path(__file__).with_name("redmi-controls.cjs"))
        script = "const g=require(process.argv[1]);let s='';process.stdin.on('data',x=>s+=x).on('end',()=>console.log(g.scopeHash(JSON.parse(s))));"
        packet = control()["packet"]
        completed = subprocess.run(["node", "-e", script, module], input=json.dumps(packet), text=True, capture_output=True, timeout=10)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout.strip(), watchdog.scope_hash(packet))

    def test_embedded_database_closure_helper_parses_without_executing_it(self):
        checked = subprocess.run(["node", "--check"], input=watchdog.DB_SCRIPT, text=True, capture_output=True, timeout=10)
        self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_normal_completion_deadline_scope_and_consecutive_failures_select_closure(self):
        healthy = {"scopeValid": True, "state": "active", "committed": 0, "apiReady": True, "workerHealthy": True}
        for change, elapsed, previous, expected in (({"state": "closed", "workerHealthy": False}, 1, 0, "normal_closure"), ({"committed": 1}, 1, 0, "normal_closure"), ({}, 300, 0, "deadline"), ({"scopeValid": False}, 1, 0, "scope_failure"), ({"workerHealthy": False}, 10, 2, None), ({"apiReady": False}, 31, 0, None), ({"workerHealthy": False}, 31, 2, "health_failed"), ({}, 31, 2, None)):
            with self.subTest(change=change, elapsed=elapsed):
                reason, failures = watchdog.closure_reason({**healthy, **change}, NOW + elapsed, NOW, NOW + 300, previous)
                self.assertEqual(reason, expected)
                if not change: self.assertEqual(failures, 0)

    def test_descriptor_and_approved_financial_hashes_are_bound(self):
        scope = control()
        watchdog.validate_control(scope, NOW + 3600)
        for section, field in (("rollback", "watchdogHash"), ("rollback", "candidateComposeHash"), ("rollback", "originalAnalysisID"), ("packet", "ownerId")):
            drift = copy.deepcopy(scope); drift[section][field] = "b" * 64
            with self.subTest(field=field), self.assertRaises(watchdog.GuardError):
                watchdog.validate_control(drift, NOW + 3600)
        drift = copy.deepcopy(scope); drift["packet"]["baseline"]["balancesHash"] = "b" * 64
        with self.assertRaisesRegex(watchdog.GuardError, "APPROVAL_SCOPE_MISMATCH"):
            watchdog.validate_control(drift, NOW + 3600)

    def test_rendered_systemd_unit_pin_rejects_restart_or_stop_command_drift(self):
        template = Path(__file__).with_name("redmi-voice-watchdog.service.template").read_bytes().replace(b"\r\n", b"\n")
        digest = watchdog.hashlib.sha256(template).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            host = watchdog.LocalHost(directory)
            target = Path(directory) / "redmi-voice-watchdog.service"
            rendered = template.replace(b"%SCOPE_ROOT%", str(host.root).encode())
            target.write_bytes(rendered)
            host.pin(target, digest, True, str(host.root))
            for original, changed in ((b"RestartSec=1s", b"RestartSec=60s"), (b" rollback", b" activate")):
                target.write_bytes(rendered.replace(original, changed))
                with self.subTest(changed=changed), self.assertRaisesRegex(watchdog.GuardError, "PIN_CHANGED"):
                    host.pin(target, digest, True, str(host.root))


if __name__ == "__main__":
    unittest.main()
