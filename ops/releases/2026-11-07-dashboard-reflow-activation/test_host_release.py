import copy
import importlib.util
from pathlib import Path, PurePosixPath
import unittest
from unittest.mock import Mock, patch
import json
import subprocess
import sys
import tempfile
import urllib.error
import io
import os
import tarfile

spec = importlib.util.spec_from_file_location("release", Path(__file__).with_name("host_release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def old_container():
    root = "/opt/masarifi/admin-releases/canonical-721a943b-artifact-20261101-01"
    return {"Image": release.MANIFEST["runtimeCandidate"]["targetRuntimeImage"], "Config": {"Hostname": "old-generated", "Image": "mutable-tag", "Env": ["CLERK_SECRET_KEY=synthetic-test-only", "NODE_ENV=production"], "Cmd": ["next", "start"]},
            "HostConfig": {"NetworkMode": "bridge", "ReadonlyRootfs": True, "Memory": 536870912, "NanoCpus": 500000000, "Binds": None, "OomKillDisable": None,
                           "PortBindings": {"3040/tcp": [{"HostIp": "127.0.0.1", "HostPort": "3040"}]},
                           "Mounts": [{"Type": "bind", "Source": root, "Target": "/workspace", "ReadOnly": True}, {"Type": "bind", "Source": root + "/apps/admin-web/.next/cache", "Target": "/workspace/apps/admin-web/.next/cache", "ReadOnly": False}]},
            "Mounts": [{"Source": root, "Destination": "/workspace", "RW": False}, {"Source": root + "/apps/admin-web/.next/cache", "Destination": "/workspace/apps/admin-web/.next/cache", "RW": True}]}


def clone(old):
    return release.clone_payload(old, PurePosixPath("/isolated/runtime"), PurePosixPath("/opt/masarifi/admin-releases/canonical-721a943b-artifact-20261101-01"))


class CloneFences(unittest.TestCase):
    def test_staged_runtime_rejects_changed_generated_js_extra_code_and_link(self):
        for change in ["generated", "extra", "executable", "link", "missing-cache", "cache"]:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory); archive = root / "runtime.tar.gz"; runtime = root / "runtime"; runtime.mkdir()
                with tarfile.open(archive, "w:gz") as bundle:
                    for name, data in [("apps/admin-web/.next/server/page.js", b"reviewed generated JS"), ("apps/admin-web/node_modules/next/cli.js", b"reviewed dependency")]:
                        entry = tarfile.TarInfo(name); entry.mode = 0o644; entry.size = len(data)
                        bundle.addfile(entry, io.BytesIO(data))
                with tarfile.open(archive, "r:gz") as bundle:
                    bundle.extractall(runtime, filter="data")
                cache = runtime / "apps/admin-web/.next/cache"; cache.mkdir()
                if change == "generated": (runtime / "apps/admin-web/.next/server/page.js").write_bytes(b"unreviewed JS")
                if change == "extra": (runtime / "apps/admin-web/node_modules/extra.js").write_bytes(b"extra code")
                if change == "missing-cache": cache.rmdir()
                if change == "executable":
                    if os.name == "nt": continue  # Windows chmod cannot represent POSIX executable bits.
                    (runtime / "apps/admin-web/node_modules/next/cli.js").chmod(0o755)
                if change == "link":
                    if os.name == "nt": continue  # No privileged symlink creation in the Windows test runner.
                    source = runtime / "apps/admin-web/.next/server/page.js"; source.unlink(); source.symlink_to("../../node_modules/next/cli.js")
                if change == "cache":
                    (cache / "legitimate-cache.json").write_bytes(b"writable cache")
                    release.verify_staged_tree(archive, runtime)
                else:
                    with self.assertRaises((AssertionError, FileNotFoundError)): release.verify_staged_tree(archive, runtime)

    def test_unset_oom_default_is_explicit_false_without_ignoring_any_field(self):
        old = old_container(); payload = clone(old)
        candidate = copy.deepcopy(old)
        candidate["Config"] = {key: value for key, value in payload.items() if key != "HostConfig"}
        candidate["HostConfig"] = copy.deepcopy(payload["HostConfig"])
        candidate["Image"] = old["Image"]
        self.assertIsNone(old["HostConfig"]["OomKillDisable"])
        self.assertIs(payload["HostConfig"]["OomKillDisable"], False)
        with patch.dict(release.MANIFEST["observedHosted"], {"environmentPin": release.canonical(old["Config"]["Env"])}):
            release.verify_created(old, candidate, payload)
            for field, value in [("OomKillDisable", True), ("Memory", 0), ("ReadonlyRootfs", False)]:
                changed = copy.deepcopy(candidate); changed["HostConfig"][field] = value
                with self.assertRaisesRegex(AssertionError, "CANDIDATE_HOST_CONFIG_DRIFT"):
                    release.verify_created(old, changed, payload)

    def test_disabled_oom_protection_is_not_normalized_away(self):
        for value in [True, 0, "false"]:
            old = old_container(); old["HostConfig"]["OomKillDisable"] = value
            with self.assertRaisesRegex(AssertionError, "OOM_PROTECTION_DRIFT"):
                clone(old)



    def test_exact_runtime_environment_and_limits_survive_source_and_port_switch(self):
        old = old_container(); before = copy.deepcopy(old)
        payload = clone(old)
        self.assertEqual(old, before)
        self.assertEqual(payload["Env"], old["Config"]["Env"])
        self.assertEqual(payload["Cmd"], old["Config"]["Cmd"])
        self.assertEqual(payload["Image"], old["Image"])
        self.assertEqual(payload["HostConfig"]["Memory"], 536870912)
        self.assertEqual(payload["HostConfig"]["Mounts"][0]["Source"], "/isolated/runtime")
        self.assertTrue(payload["HostConfig"]["Mounts"][0]["ReadOnly"])
        self.assertEqual(payload["HostConfig"]["PortBindings"]["3040/tcp"], [{"HostIp": "127.0.0.1", "HostPort": "3041"}])

    def test_public_or_extra_port_binding_aborts(self):
        for binding in [{"3040/tcp": [{"HostIp": "0.0.0.0", "HostPort": "3040"}]}, {"3040/tcp": [], "3080/tcp": []}]:
            old = old_container(); old["HostConfig"]["PortBindings"] = binding
            with self.assertRaisesRegex(AssertionError, "OLD_PORT_DRIFT"):
                clone(old)

    def test_created_image_must_match_actual_pinned_runtime_before_start(self):
        old = old_container(); candidate = copy.deepcopy(old); candidate["Image"] = "sha256:" + "0" * 64
        with self.assertRaisesRegex(AssertionError, "CANDIDATE_IMAGE_PIN_MISMATCH"):
            release.verify_created(old, candidate, clone(old))

    def test_optimized_python_is_rejected_before_any_host_access(self):
        result = subprocess.run([sys.executable, "-O", str(Path(release.__file__)), "inspect"], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("PYTHON_OPTIMIZATION_FORBIDDEN", result.stderr)

    def test_failed_canary_stops_only_receipt_recorded_candidate(self):
        identity = "synthetic-candidate-id"
        current = {"Name": "/" + release.MANIFEST["candidate"]["name"], "Image": release.MANIFEST["runtimeCandidate"]["targetRuntimeImage"], "State": {"Running": True}}
        with patch.object(release, "canary", side_effect=RuntimeError("fixture probe timeout")), patch.object(release.time, "monotonic", side_effect=[0, 61]), patch.object(release, "inspect_container", return_value=current), patch.object(release.subprocess, "run") as execute:
            with self.assertRaisesRegex(RuntimeError, "fixture probe timeout"):
                release.start_and_qualify(identity)
            self.assertEqual([call.args[0] for call in execute.call_args_list], [["docker", "start", identity], ["docker", "stop", "--time", "15", identity]])

    def test_anonymous_500_public_access_or_foreign_redirect_do_not_qualify(self):
        expected = {"status": 307, "locationPrefix": "https://accounts.staging.masarifiratibi.com/sign-in"}
        for status, location, passes in [(500, "", False), (200, "", False), (307, "https://foreign.invalid/", False), (307, expected["locationPrefix"] + "?redirect_url=fixture", True)]:
            response = Mock(status=status, headers={"Location": location})
            opener = Mock(); opener.open.return_value = response
            with patch.dict(release.MANIFEST, {"anonymousChallenge": expected}), patch.object(release.urllib.request, "build_opener", return_value=opener):
                if passes: release.protected_route_challenge(3041)
                else:
                    with self.assertRaisesRegex(AssertionError, "PROTECTED_ROUTE_CHALLENGE_MISMATCH"):
                        release.protected_route_challenge(3041)

    def test_no_watchdog_ack_cannot_record_handover_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "rollback").mkdir(); target = root / "proxy"; target.write_bytes(b"candidate")
            state = {"phase": "candidate serving; authenticated acceptance pending", "watchdogPid": 123, "containerId": "fixture"}
            (root / "state.json").write_text(json.dumps(state))
            original = root / "rollback/original"; original.write_bytes(b"original")
            with patch.object(release, "ROOT", root), patch.object(release, "TARGET", target), patch.object(release.watchdog, "ORIGINAL", original), patch.object(release.watchdog, "restore", side_effect=lambda data: target.write_bytes(data)) as restore, patch.dict(release.MANIFEST, {"routingCandidateSha256": release.digest(b"candidate")}), patch.object(release, "admission"), patch.object(release, "canary", return_value=state), patch.object(release.time, "monotonic", side_effect=[0, 9]), patch.object(release, "served_probe") as served:
                with self.assertRaisesRegex(RuntimeError, "WATCHDOG_ACCEPTANCE_NOT_ACKNOWLEDGED"):
                    release.accept()
                self.assertEqual(json.loads((root / "state.json").read_text())["phase"], "acceptance failed; old proxy restored")
                self.assertFalse((root / "rollback/acceptance.json").exists())
                self.assertEqual(target.read_bytes(), b"original")
                restore.assert_called_once_with(b"original")
                served.assert_called_once()

    def test_matching_watcher_ack_is_required_before_served_build_is_rechecked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "rollback").mkdir(); target = root / "proxy"; target.write_bytes(b"candidate")
            state = {"phase": "candidate serving; authenticated acceptance pending", "watchdogPid": 123, "containerId": "fixture"}
            (root / "state.json").write_text(json.dumps(state))
            original = root / "rollback/original"; original.write_bytes(b"original")
            ack = {"accepted": True, "sourceCommit": release.MANIFEST["sourceCommit"], "runtimeSha256": release.MANIFEST["runtimeCandidate"]["sha256"], "watchdogPid": 123}
            (root / "rollback/watchdog-ack.json").write_text(json.dumps(ack))
            with patch.object(release, "ROOT", root), patch.object(release, "TARGET", target), patch.object(release.watchdog, "ORIGINAL", original), patch.dict(release.MANIFEST, {"routingCandidateSha256": release.digest(b"candidate")}), patch.object(release, "admission"), patch.object(release, "canary", return_value=state), patch.object(release, "original_rows", return_value=[]), patch.object(release, "served_probe") as served:
                release.accept()
                self.assertEqual(served.call_count, 2)
                self.assertEqual(json.loads((root / "state.json").read_text())["phase"], "accepted after public and authenticated browser verification")

    def test_post_ack_health_failure_withdraws_marker_and_restores_original(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "rollback").mkdir(); target = root / "proxy"; target.write_bytes(b"candidate")
            original = root / "rollback/original"; original.write_bytes(b"original")
            state = {"phase": "candidate serving; authenticated acceptance pending", "watchdogPid": 123, "containerId": "fixture"}
            (root / "state.json").write_text(json.dumps(state))
            ack = {"accepted": True, "sourceCommit": release.MANIFEST["sourceCommit"], "runtimeSha256": release.MANIFEST["runtimeCandidate"]["sha256"], "watchdogPid": 123}
            (root / "rollback/watchdog-ack.json").write_text(json.dumps(ack))
            with patch.object(release, "ROOT", root), patch.object(release, "TARGET", target), patch.object(release.watchdog, "ORIGINAL", original), patch.object(release.watchdog, "restore", side_effect=lambda data: target.write_bytes(data)) as restore, patch.dict(release.MANIFEST, {"routingCandidateSha256": release.digest(b"candidate")}), patch.object(release, "admission"), patch.object(release, "canary", return_value=state), patch.object(release, "served_probe", side_effect=[None, RuntimeError("post-ack served build failed")]):
                with self.assertRaisesRegex(RuntimeError, "post-ack served build failed"):
                    release.accept()
                restore.assert_called_once_with(b"original")
                self.assertFalse((root / "rollback/acceptance.json").exists())
                self.assertEqual(target.read_bytes(), b"original")
                self.assertEqual(json.loads((root / "state.json").read_text())["phase"], "acceptance failed; old proxy restored")

    def test_unreviewed_or_writable_workspace_mount_aborts(self):
        for mutate in [lambda old: old["Mounts"].append({"Source": "/data", "Destination": "/private", "RW": True}), lambda old: old["Mounts"][0].update(RW=True)]:
            old = old_container(); mutate(old)
            with self.assertRaises(AssertionError):
                clone(old)

    def test_hidden_bind_source_and_duplicate_mount_are_rejected(self):
        for mutate in [lambda old: old["HostConfig"]["Mounts"][0].update(Source="/foreign"), lambda old: old["HostConfig"]["Mounts"].append(copy.deepcopy(old["HostConfig"]["Mounts"][0]))]:
            old = old_container(); mutate(old)
            with self.assertRaises(AssertionError):
                clone(old)

    def test_weaker_root_or_network_isolation_aborts(self):
        for field, value in [("ReadonlyRootfs", False), ("NetworkMode", "host")]:
            old = old_container(); old["HostConfig"][field] = value
            with self.assertRaisesRegex(AssertionError, "RUNTIME_ISOLATION_DRIFT"):
                clone(old)


if __name__ == "__main__":
    unittest.main()
