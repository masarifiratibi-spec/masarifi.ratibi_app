"""Offline preparation. Installing/running this artifact requires separate approval.

The root-only control binds an approved packet to its immutable rollback descriptor.
Only closure, stopping the new owned worker, API restoration and starting the
preserved Analysis identity exist here. No activation or financial creation path.
Rollback remains permitted after expiry; it never extends the activation window.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import socket
import stat
import subprocess
import sys
import time
import urllib.request

HOST = "srv2006836"
PROJECT = "qcffvfbpzvpwcwxwjyro"
SOURCE = "ac7bc92ab2e6e6c2e50a969de6c69463688febae"
DIGEST = "a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383"
IMAGE = "ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:" + DIGEST
COHORT = "/opt/masarifi/staging-cohort-ac7bc92-client-recovery-20261010"
WORKER_NAME = "masarifi-staging-voice-redmi-acceptance-1"
ANALYSIS_ID = "53ece64ce47252042e4d9462096079a9966c4f09098356ce269601d16b4e681c"
ASSISTANT_ID = "fe86e4ed35d461495e293bb5f01f15a9f3562f35bd44de4f0c0c7fe17b83e4f2"
UUID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\Z")
HEX = re.compile(r"[a-f0-9]{64}\Z")
ENV_NAMES = {"api.env", "worker.env", "migration.env", "compose.env", "admin.env"}


class GuardError(RuntimeError):
    pass


def require(condition, code):
    if not condition:
        raise GuardError(code)


def canonical_hash(evidence):
    encoded = json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def scope_hash(packet):
    immutable = dict(packet)
    immutable.pop("startsAt", None)
    immutable.pop("deadline", None)
    immutable["baseline"] = dict(packet["baseline"])
    immutable["baseline"].pop("observedAt", None)
    return canonical_hash(immutable)


def instant(iso_time):
    require(isinstance(iso_time, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z", iso_time), "TIME_INVALID")
    return datetime.datetime.fromisoformat(iso_time.replace("Z", "+00:00")).timestamp()


def validate_control(control, now):
    packet, descriptor, approval = control["packet"], control["rollback"], control["approval"]
    require(packet["project"] == PROJECT and packet["device"] == "f66a40694eca", "TARGET_INVALID")
    require(type(packet["version"]) is int and packet["version"] == 2 and packet["mode"] == "canary", "SCOPE_INVALID")
    for key, expected in {"kind": "expense", "expenseMinor": 1000, "maxExpenseMinor": 1000, "maxTransactions": 1, "maxPostings": 1, "currency": "SAR", "locale": "ar"}.items():
        require(type(packet[key]) is type(expected) and packet[key] == expected, "SCOPE_INVALID")
    require(packet["sourceSha"] == SOURCE and packet["imageDigest"] == DIGEST, "IMAGE_INVALID")
    require(UUID.fullmatch(packet["attemptId"]) and UUID.fullmatch(control["epochId"]), "IDENTITY_INVALID")
    require(HEX.fullmatch(control["workerID"]) and HEX.fullmatch(control["manifestHash"]), "IDENTITY_INVALID")
    require(descriptor["host"] == HOST and descriptor["project"] == PROJECT, "TARGET_INVALID")
    require(descriptor["scope"] == "redmi-voice-" + packet["attemptId"] and descriptor["workerName"] == WORKER_NAME, "WORKER_SCOPE_INVALID")
    require(descriptor["originalAnalysisID"] == ANALYSIS_ID and descriptor["originalAssistantID"] == ASSISTANT_ID, "ORIGINAL_ID_INVALID")
    require(packet["controlHash"] == canonical_hash(descriptor), "ROLLBACK_DESCRIPTOR_CHANGED")
    require(control["scopeHash"] == scope_hash(packet) == approval["packetHash"], "APPROVAL_SCOPE_MISMATCH")
    require(approval["kind"] == "direct-human-financial-approval", "HUMAN_APPROVAL_REQUIRED")
    for key, maximum in (("messageReference", 256), ("verbatimMessage", 4096)):
        require(isinstance(approval[key], str) and 8 <= len(approval[key].strip()) <= maximum, "HUMAN_EVIDENCE_REQUIRED")
    require(instant(approval["receivedAt"]) <= now, "APPROVAL_FUTURE")
    start, deadline = instant(packet["startsAt"]), instant(packet["deadline"])
    require(0 < deadline - start <= 300 and control["deadline"] == packet["deadline"], "WINDOW_INVALID")
    require(set(descriptor["envHashes"]) == ENV_NAMES and all(HEX.fullmatch(h) for h in descriptor["envHashes"].values()), "ENV_PINS_REQUIRED")
    original_files = descriptor["originalAPIComposeFiles"]
    require(isinstance(original_files, list) and len(original_files) >= 1, "ORIGINAL_COMPOSE_REQUIRED")
    paths = [entry["path"] for entry in original_files]
    require(len(paths) == len(set(paths)), "ORIGINAL_COMPOSE_DUPLICATE")
    for entry in original_files:
        path = PurePosixPath(entry["path"])
        require(path.is_absolute() and str(path).startswith(COHORT + "/") and ".." not in path.parts and HEX.fullmatch(entry["sha256"]), "ORIGINAL_COMPOSE_PATH_INVALID")
    for field in ("watchdogHash", "watchdogUnitHash", "redmiControlsHash", "candidateComposeHash", "databaseCAHash"):
        require(HEX.fullmatch(descriptor[field]), "ARTIFACT_PIN_REQUIRED")
    return control


def validate_root_location(root, hostname, uid, directory_stat, control_stat):
    require(hostname == HOST and uid == 0 and root.startswith("/opt/masarifi/redmi-voice-"), "ROOT_TARGET_REQUIRED")
    require(stat.S_ISDIR(directory_stat.st_mode) and directory_stat.st_uid == 0 and stat.S_IMODE(directory_stat.st_mode) == 0o700, "ROOT_DIRECTORY_REQUIRED")
    require(stat.S_ISREG(control_stat.st_mode) and control_stat.st_uid == 0 and stat.S_IMODE(control_stat.st_mode) == 0o600, "ROOT_CONTROL_600_REQUIRED")


def checked_container(container, name, service, expected_id=None, scope=None, epoch=None):
    require(container["Name"] == "/" + name and (expected_id is None or container["Id"] == expected_id), "CONTAINER_ID_CHANGED")
    config = container["Config"]
    labels = config.get("Labels") or {}
    require(config["Image"] == IMAGE and labels.get("com.docker.compose.project") == "masarifi-staging" and labels.get("com.docker.compose.service") == service, "CONTAINER_IMAGE_OR_PROJECT_CHANGED")
    require(container["HostConfig"]["NetworkMode"] == "masarifi-staging_backend", "CONTAINER_NETWORK_CHANGED")
    environment = dict(entry.split("=", 1) for entry in config["Env"])
    require(environment.get("MASARIFI_RELEASE_VERSION") == SOURCE and environment.get("SUPABASE_URL") == "https://" + PROJECT + ".supabase.co", "CONTAINER_ENV_CHANGED")
    if scope:
        require(labels.get("org.masarifi.scope") == scope and environment.get("MASARIFI_STAGING_VOICE_EPOCH_ID") == epoch, "CONTAINER_SCOPE_CHANGED")
    return environment


def closure_reason(snapshot, now, start, deadline, previous_failures, armed_at=None):
    # Normal completion precedes worker health: a completed worker may stop or
    # become unhealthy after the database already closed its financial epoch.
    if not snapshot.get("scopeValid"):
        return "scope_failure", previous_failures
    if snapshot.get("committed", 0) not in (0, 1):
        return "scope_failure", previous_failures
    if snapshot.get("state") == "closed" or snapshot.get("committed") == 1:
        return "normal_closure", 0
    if now >= deadline:
        return "deadline", 0
    if snapshot.get("state") == "prepared":
        if snapshot.get("posting") is not False:
            return "scope_failure", previous_failures
        # Initial arming may wait only 30 seconds from this monitor start;
        # it never moves the approved packet or database deadline.
        arming_end = min(start, start if armed_at is None else armed_at) + 30
        return ("arming_timeout" if now >= arming_end else None), 0
    if snapshot.get("state") != "active":
        return "scope_failure", previous_failures
    if snapshot.get("apiReady") and snapshot.get("workerHealthy"):
        return None, 0
    failures = 0 if now - start < 30 else previous_failures + 1
    return ("health_failed" if failures >= 3 else None), failures


def rollback(control, boundary):
    # Provenance is checked before every mutation. Expiration is deliberately
    # not an approval revocation for closure of this already-approved scope.
    boundary.guard(control)
    report = {"postingOffConfirmed": False, "workerStoppedConfirmed": False, "apiRestored": False, "analysisRestored": False, "blockers": []}
    try:
        closed = boundary.close_epoch(control)
        require(type(closed) is dict, "DATABASE_RECEIPT_INVALID")
        require(closed.get("posting") is False and closed.get("state") == "closed", "DATABASE_OFF_UNCONFIRMED")
        report["postingOffConfirmed"] = True
    except (GuardError, RuntimeError, OSError) as error:
        report["blockers"].append(type(error).__name__ + ":DATABASE_OFF_UNCONFIRMED")
    try:
        boundary.stop_owned_worker(control)
        report["workerStoppedConfirmed"] = True
    except (GuardError, RuntimeError, OSError) as error:
        report["blockers"].append(type(error).__name__ + ":OWNED_WORKER_STOP_UNCONFIRMED")
    if not (report["postingOffConfirmed"] and report["workerStoppedConfirmed"]):
        return report
    try:
        boundary.restore_guard(control)
        boundary.restore_api(control)
        boundary.start_preserved_analysis(control)
        boundary.verify_restored(control)
        report["apiRestored"] = True
        report["analysisRestored"] = True
    except (GuardError, RuntimeError, OSError) as error:
        report["blockers"].append(type(error).__name__ + ":RESTORATION_UNCONFIRMED")
    return report


DB_SCRIPT = r"""
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {Pool}=createRequire('/app/dist/src/ai/ai.worker.js')('pg');
const c=JSON.parse(fs.readFileSync('/control/control.json','utf8'));
assert.equal(process.env.MASARIFI_PROCESS_KIND,'migration');
const url=new URL(process.env.DATABASE_URL);
assert(url.hostname.endsWith('.supabase.com')&&decodeURIComponent(url.username).endsWith('.qcffvfbpzvpwcwxwjyro'));
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,query_timeout:15000});
(async()=>{const db=await pool.connect();try{
 await db.query('begin');await db.query("set local statement_timeout='15s'");
 await db.query('grant masarifi_migration to current_user with set true, inherit false');
 await db.query('set local role masarifi_migration');
 const checked=(await db.query("select manifest_hash,manifest=$2::jsonb matches from private.staging_voice_epochs where id=$1::uuid for update",[c.epochId,JSON.stringify(c.packet)])).rows[0];
 assert(checked&&checked.matches&&checked.manifest_hash===c.manifestHash);
 if(process.env.WATCHDOG_ACTION==='close')await db.query("select private.close_staging_voice_epoch($1::uuid,'redmi_watchdog_closed')",[c.epochId]);
 else assert.equal(process.env.WATCHDOG_ACTION,'status');
 const receipt=(await db.query(`select e.state,e.heartbeat_at as "heartbeatAt",e.expires_at as deadline,
  (select enabled from private.voice_automatic_policy) posting,
  (select count(*)::int from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=e.id and v.status='committed') committed
  from private.staging_voice_epochs e where e.id=$1::uuid`,[c.epochId])).rows[0];
 await db.query('reset role');await db.query('revoke masarifi_migration from current_user granted by current_user');await db.query('commit');
 console.log(JSON.stringify(receipt));
 }catch(error){await db.query('rollback');throw error;}finally{db.release();await pool.end();}})().catch(()=>{console.error('WATCHDOG_DATABASE_FAILED');process.exitCode=1;});
"""


class LocalHost:
    def __init__(self, root):
        self.root = Path(root)

    def run(self, command, timeout=25, environment=None):
        # Force the local daemon; inherited Docker contexts cannot redirect an
        # approved Staging identity check or mutation to another machine.
        guarded_environment = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "DOCKER_HOST": "unix:///var/run/docker.sock"}
        if environment:
            guarded_environment.update({key: environment[key] for key in ("MASARIFI_BACKEND_REPOSITORY", "MASARIFI_BACKEND_DIGEST", "MASARIFI_RELEASE_VERSION")})
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, env=guarded_environment)
        except subprocess.SubprocessError as error:
            raise GuardError("HOST_COMMAND_TIMEOUT") from error
        require(completed.returncode == 0, "HOST_COMMAND_FAILED")
        return completed.stdout.strip()

    def inspect(self, identity):
        containers = json.loads(self.run(["docker", "inspect", identity]))
        require(len(containers) == 1, "CONTAINER_MISSING")
        return containers[0]

    def pin(self, path, digest, normalized=False, rendered_root=None):
        target = Path(path)
        require(not target.is_symlink() and target.resolve() == target.absolute(), "PIN_SYMLINK_INVALID")
        content = target.read_bytes()
        if normalized:
            content = content.replace(b"\r\n", b"\n")
        if rendered_root is not None:
            content = content.replace(rendered_root.encode("utf-8"), b"%SCOPE_ROOT%")
        require(hashlib.sha256(content).hexdigest() == digest, "PIN_CHANGED")

    def guard(self, control):
        validate_root_location(str(self.root), socket.gethostname(), os.getuid(), self.root.lstat(), (self.root / "control.json").lstat())
        require(self.root.resolve() == self.root and str(self.root) == "/opt/masarifi/" + control["rollback"]["scope"], "ROOT_SCOPE_MISMATCH")
        validate_control(control, time.time())
        require(load_control(self.root / "control.json") == control, "CONTROL_CHANGED")
        descriptor = control["rollback"]
        self.pin(self.root / "redmi-voice-rollback-watchdog.py", descriptor["watchdogHash"], True)
        self.pin(self.root / "redmi-controls.cjs", descriptor["redmiControlsHash"], True)
        self.pin(self.root / "redmi-voice-watchdog.service", descriptor["watchdogUnitHash"], True, str(self.root))

    def db(self, control, action):
        self.guard(control)
        self.pin("/etc/masarifi/migration.env", control["rollback"]["envHashes"]["migration.env"])
        self.pin("/etc/masarifi/supabase-ca.crt", control["rollback"]["databaseCAHash"])
        # Root inside this read-only, capability-free helper can read root600
        # control evidence without relaxing ownership or permissions on the host.
        command = ["docker", "run", "--rm", "--user", "0:0", "--network", "masarifi-staging_backend", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit", "128", "--memory", "512m", "--env-file", "/etc/masarifi/migration.env", "-e", "MASARIFI_PROCESS_KIND=migration", "-e", "WATCHDOG_ACTION=" + action, "-v", "/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro", "-v", str(self.root) + ":/control:ro", IMAGE, "-e", DB_SCRIPT]
        try:
            receipt = json.loads(self.run(command))
        except json.JSONDecodeError as error:
            raise GuardError("DATABASE_RECEIPT_INVALID") from error
        require(type(receipt) is dict and type(receipt.get("posting")) is bool and receipt.get("state") in ("prepared", "active", "closed"), "DATABASE_RECEIPT_INVALID")
        return receipt

    def close_epoch(self, control):
        return self.db(control, "close")

    def stop_owned_worker(self, control):
        self.guard(control)
        worker = self.inspect(control["rollback"]["workerName"])
        checked_container(worker, WORKER_NAME, "voice-redmi-acceptance", control["workerID"], control["rollback"]["scope"], control["epochId"])
        if worker["State"]["Running"]:
            self.run(["docker", "stop", "--time", "5", worker["Id"]])
        require(self.inspect(worker["Id"])["State"]["Running"] is False, "WORKER_STILL_RUNNING")

    def restore_guard(self, control):
        self.guard(control)
        descriptor = control["rollback"]
        self.pin(self.root / "redmi-voice-compose.yml", descriptor["candidateComposeHash"], True)
        for name, digest in descriptor["envHashes"].items():
            self.pin("/etc/masarifi/" + name, digest)
        for entry in descriptor["originalAPIComposeFiles"]:
            self.pin(entry["path"], entry["sha256"])
        checked_container(self.inspect("masarifi-staging-api-1"), "masarifi-staging-api-1", "api")
        analysis_env = checked_container(self.inspect(ANALYSIS_ID), "masarifi-staging-analysis-worker-1", "analysis-worker", ANALYSIS_ID)
        require(analysis_env.get("MASARIFI_VOICE_ANALYSIS_ONLY") == "true" and analysis_env.get("MASARIFI_AI_PROVIDER_ENABLED") == "true", "ANALYSIS_ENV_CHANGED")
        assistant = self.inspect(ASSISTANT_ID)
        checked_container(assistant, "masarifi-staging-assistant-worker-1", "assistant-worker", ASSISTANT_ID)
        require(assistant["State"]["Running"] is True, "ASSISTANT_STATE_CHANGED")
        for name in ("masarifi-staging-voice-epoch-1", "masarifi-staging-worker-1"):
            require(self.inspect(name)["State"]["Running"] is False, "OLD_WORKER_STATE_CHANGED")

    def restore_api(self, control):
        self.restore_guard(control)
        command = ["docker", "compose", "--project-name", "masarifi-staging", "--env-file", "/etc/masarifi/compose.env"]
        for entry in control["rollback"]["originalAPIComposeFiles"]:
            command += ["-f", entry["path"]]
        environment = dict(os.environ, MASARIFI_BACKEND_REPOSITORY="ghcr.io/masarifiratibi-spec/masarifi-backend", MASARIFI_BACKEND_DIGEST=DIGEST, MASARIFI_RELEASE_VERSION=SOURCE)
        self.run(command + ["config", "--quiet"], environment=environment)
        self.run(command + ["up", "-d", "--no-deps", "api"], timeout=60, environment=environment)

    def start_preserved_analysis(self, control):
        self.restore_guard(control)
        analysis = self.inspect(ANALYSIS_ID)
        if not analysis["State"]["Running"]:
            self.run(["docker", "start", ANALYSIS_ID])

    def api_ready(self):
        api = self.inspect("masarifi-staging-api-1")
        environment = checked_container(api, "masarifi-staging-api-1", "api")
        require(api["State"]["Running"] is True and api["State"].get("Health", {}).get("Status") == "healthy", "API_UNHEALTHY")
        with urllib.request.urlopen("http://127.0.0.1:3000/health/ready", timeout=3) as response:
            require(json.load(response).get("status") == "ready", "API_NOT_READY")
        return environment

    def verify_restored(self, control):
        self.restore_guard(control)
        grace_end = time.monotonic() + 30
        while True:
            try:
                api_env = self.api_ready()
                require(api_env.get("MASARIFI_VOICE_ANALYSIS_ONLY") == "true" and api_env.get("MASARIFI_AI_PROVIDER_ENABLED") == "true", "API_ANALYSIS_NOT_RESTORED")
                analysis = self.inspect(ANALYSIS_ID)
                analysis_env = checked_container(analysis, "masarifi-staging-analysis-worker-1", "analysis-worker", ANALYSIS_ID)
                require(analysis_env.get("MASARIFI_VOICE_ANALYSIS_ONLY") == "true" and analysis_env.get("MASARIFI_AI_PROVIDER_ENABLED") == "true", "ANALYSIS_ENV_CHANGED")
                require(analysis["State"]["Running"] is True, "ANALYSIS_NOT_RUNNING")
                self.restore_guard(control)
                return
            except (GuardError, RuntimeError, OSError):
                require(time.monotonic() < grace_end, "RESTORATION_READINESS_UNCONFIRMED")
                time.sleep(1)

    def snapshot(self, control):
        receipt = self.db(control, "status")
        # Preparation leaves expires_at NULL until activation. Closing such an
        # epoch also leaves it NULL; the packet deadline still bounds arming.
        if receipt.get("deadline") is None:
            require(receipt["state"] in ("prepared", "closed"), "EPOCH_DEADLINE_CHANGED")
        else:
            require(instant(receipt["deadline"]) == instant(control["deadline"]), "EPOCH_DEADLINE_CHANGED")
        receipt["scopeValid"] = True
        receipt["apiReady"] = False
        receipt["workerHealthy"] = False
        if receipt["state"] in ("prepared", "closed") or receipt["committed"] == 1:
            return receipt
        try:
            require(self.api_ready().get("MASARIFI_VOICE_ANALYSIS_ONLY") == "false", "API_FINANCIAL_MODE_CHANGED")
            receipt["apiReady"] = True
            worker = self.inspect(WORKER_NAME)
            checked_container(worker, WORKER_NAME, "voice-redmi-acceptance", control["workerID"], control["rollback"]["scope"], control["epochId"])
            require(worker["State"]["Running"] and worker["State"].get("Health", {}).get("Status") == "healthy", "WORKER_UNHEALTHY")
            self.run(["docker", "exec", worker["Id"], "/nodejs/bin/node", "dist/src/staging-voice-healthcheck.js"], timeout=5)
            require(receipt["heartbeatAt"] and 0 <= time.time() - instant(receipt["heartbeatAt"]) <= 15, "HEARTBEAT_STALE")
            receipt["workerHealthy"] = True
        except GuardError as error:
            if str(error) in ("CONTAINER_ID_CHANGED", "CONTAINER_IMAGE_OR_PROJECT_CHANGED", "CONTAINER_NETWORK_CHANGED", "CONTAINER_ENV_CHANGED", "CONTAINER_SCOPE_CHANGED"):
                receipt["scopeValid"] = False
        except (RuntimeError, OSError, ValueError, KeyError, TypeError):
            pass  # A bounded probe failure is counted, never reported as healthy.
        return receipt


def load_control(path):
    def unique_keys(pairs):
        record = {}
        for key, entry in pairs:
            require(key not in record, "DUPLICATE_CONTROL_KEY")
            record[key] = entry
        return record
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique_keys)


def monitor(control, boundary, clock=time.time, pause=time.sleep, announce=None):
    failures = 0
    armed_at = clock()
    armed_reported = False
    start, deadline = instant(control["packet"]["startsAt"]), instant(control["deadline"])
    while True:
        if clock() >= deadline:
            return "deadline"
        try:
            snapshot = boundary.snapshot(control)
        except GuardError:
            # Database/provenance/deadline guards are required for continuing.
            # A failed guard selects closure immediately, even during arming.
            return "scope_failure"
        except (RuntimeError, OSError, ValueError, KeyError, TypeError):
            snapshot = {"scopeValid": True, "state": "active", "apiReady": False, "workerHealthy": False}
        reason, failures = closure_reason(snapshot, clock(), start, deadline, failures, armed_at)
        if reason:
            return reason
        if snapshot.get("state") == "prepared" and not armed_reported:
            if announce:
                announce({"status": "WATCHDOG_ARMED"})
            armed_reported = True
        pause(5)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ("monitor", "rollback"), "CLOSURE_MODE_REQUIRED")
    root = Path(__file__).resolve().parent
    boundary = LocalHost(root)
    control = load_control(root / "control.json")
    boundary.guard(control)
    if sys.argv[1] == "monitor":
        reason = monitor(control, boundary, announce=lambda status: print(json.dumps(status), flush=True))
        print(json.dumps({"closing": True, "reason": reason}), flush=True)
    receipt = rollback(control, boundary)
    print(json.dumps(receipt), flush=True)
    return 0 if not receipt["blockers"] else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (GuardError, RuntimeError, OSError, KeyError, TypeError, ValueError):
        print(json.dumps({"status": "WATCHDOG_GUARD_OR_CLOSURE_UNCONFIRMED"}), flush=True)
        sys.exit(1)
