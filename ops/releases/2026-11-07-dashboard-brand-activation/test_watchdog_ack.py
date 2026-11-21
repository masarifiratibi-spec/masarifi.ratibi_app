import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("watchdog", Path(__file__).with_name("rollback_watchdog.py"))
watchdog = importlib.util.module_from_spec(spec); spec.loader.exec_module(watchdog)
manifest = json.loads(Path(__file__).with_name("manifest.json").read_text())
runtime_sha = manifest["runtimeCandidate"]["sha256"]


class WatcherAcknowledgment(unittest.TestCase):
    def test_foreign_pid_or_invalid_json_cannot_disarm_the_watcher(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "acceptance.json"
            with patch.object(watchdog, "ACCEPTANCE", marker), patch.object(watchdog.os, "getpid", return_value=456):
                marker.write_text("{")
                self.assertFalse(watchdog.accepted(runtime_sha))
                marker.write_text(json.dumps({"accepted": True, "sourceCommit": watchdog.SOURCE, "runtimeSha256": runtime_sha, "watchdogPid": 123}))
                self.assertFalse(watchdog.accepted(runtime_sha))

    def test_matching_watcher_acknowledges_before_exiting_without_a_reload(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve(); (root / "rollback").mkdir()
            original = root / "rollback/original"; original.write_bytes(b"proxy_pass http://127.0.0.1:3040;\n")
            target = root / "active"; target.write_bytes(b"proxy_pass http://127.0.0.1:3041;\n")
            marker = root / "rollback/acceptance.json"
            expected = {"accepted": True, "sourceCommit": watchdog.SOURCE, "runtimeSha256": runtime_sha, "watchdogPid": 456}
            marker.write_text(json.dumps(expected)); enabled = Mock(); enabled.resolve.return_value = target
            argv = ["watchdog", "--action", "watch", "--execute-approved", "--runtime-sha256", runtime_sha]
            with patch.object(watchdog, "ROOT", root), patch.object(watchdog, "ORIGINAL", original), patch.object(watchdog, "TARGET", target), patch.object(watchdog, "ENABLED", enabled), patch.object(watchdog, "ACCEPTANCE", marker), patch.object(watchdog, "ORIGINAL_SHA", watchdog.digest(original.read_bytes())), patch.object(watchdog.os, "getpid", return_value=456), patch.object(watchdog.os, "geteuid", return_value=0, create=True), patch("sys.argv", argv), patch.object(watchdog.subprocess, "run") as execute:
                watchdog.main()
                self.assertEqual(json.loads((root / "rollback/watchdog-ack.json").read_text()), expected)
                execute.assert_not_called()


if __name__ == "__main__": unittest.main()
