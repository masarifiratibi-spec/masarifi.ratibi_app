"""Offline safety fences using temporary files and mocked Nginx; no hosted access."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location("watchdog", Path(__file__).with_name("rollback_watchdog.py"))
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


class ProxyFences(unittest.TestCase):
    original = b"location / { proxy_pass http://127.0.0.1:3040; }\nlocation /api { proxy_pass http://127.0.0.1:3080; }\n"

    def test_only_dashboard_upstream_changes(self):
        candidate = watchdog.proposed_proxy(self.original, watchdog.digest(self.original))
        self.assertEqual(candidate, self.original.replace(b":3040;", b":3041;"))
        self.assertEqual(watchdog.validate_current(self.original, candidate, watchdog.digest(self.original)), "candidate")

    def test_original_disk_state_is_identified(self):
        self.assertEqual(watchdog.validate_current(self.original, self.original, watchdog.digest(self.original)), "original")

    def test_original_preimage_drift_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "ORIGINAL_PROXY_PIN_MISMATCH"):
            watchdog.proposed_proxy(self.original)

    def test_unrelated_routing_drift_cannot_be_overwritten(self):
        current = self.original.replace(b":3080;", b":3081;")
        with self.assertRaisesRegex(RuntimeError, "UNREVIEWED_ROUTING_DRIFT"):
            watchdog.validate_current(self.original, current, watchdog.digest(self.original))

    def test_missing_or_multiple_dashboard_upstreams_are_rejected(self):
        for text in [self.original.replace(b":3040;", b":3042;"), self.original + self.original]:
            with self.subTest(text=text):
                with self.assertRaisesRegex(RuntimeError, "DASHBOARD_UPSTREAM_COUNT_MISMATCH"):
                    watchdog.proposed_proxy(text, watchdog.digest(text))

    def test_failed_reload_is_retried_even_after_original_bytes_are_restored(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory).resolve() / "routing"
            original_path = Path(directory) / "backup"
            original_path.write_bytes(self.original)
            target.write_bytes(watchdog.proposed_proxy(self.original, watchdog.digest(self.original)))
            enabled = Mock()
            enabled.resolve.return_value = target
            reloads = []

            def nginx(command, **kwargs):
                if command[-1] == "reload":
                    reloads.append(command)
                    if len(reloads) == 1:
                        raise subprocess.CalledProcessError(1, command)

            with patch.object(watchdog, "TARGET", target), patch.object(watchdog, "ORIGINAL", original_path), patch.object(watchdog, "ENABLED", enabled), patch.object(watchdog, "ORIGINAL_SHA", watchdog.digest(self.original)), patch.object(watchdog.os, "fchmod", create=True), patch.object(watchdog.os, "fchown", create=True), patch.object(watchdog.subprocess, "run", side_effect=nginx):
                with self.assertRaises(subprocess.CalledProcessError):
                    watchdog.restore(self.original)
                self.assertEqual(target.read_bytes(), self.original)
                watchdog.restore(self.original)
                self.assertEqual(len(reloads), 2)

    def test_enabled_link_drift_aborts_before_any_reload(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory).resolve() / "routing"
            target.write_bytes(self.original)
            enabled = Mock()
            enabled.resolve.return_value = target.with_name("different")
            with patch.object(watchdog, "TARGET", target), patch.object(watchdog, "ENABLED", enabled), patch.object(watchdog.subprocess, "run") as execute:
                with self.assertRaisesRegex(RuntimeError, "ROUTING_PATH_DRIFT"):
                    watchdog.restore(self.original)
                execute.assert_not_called()

    def test_invalid_acceptance_never_disarms(self):
        for payload in ["{", "null", "[]", '{"accepted":true}', '{"accepted":true,"sourceCommit":"wrong"}']:
            marker = Mock()
            marker.is_symlink.return_value = False
            marker.read_text.return_value = payload
            with patch.object(watchdog, "ACCEPTANCE", marker):
                self.assertFalse(watchdog.accepted("a" * 64))
        for failure in [OSError("unreadable"), FileNotFoundError("not yet published")]:
            marker.read_text.side_effect = failure
            with patch.object(watchdog, "ACCEPTANCE", marker):
                self.assertFalse(watchdog.accepted("a" * 64))

    def test_symlink_marker_and_wrong_runtime_never_disarm(self):
        marker = Mock()
        marker.is_symlink.return_value = True
        with patch.object(watchdog, "ACCEPTANCE", marker):
            self.assertFalse(watchdog.accepted("a" * 64))
        marker.is_symlink.return_value = False
        marker.read_text.return_value = '{"accepted":true,"sourceCommit":"' + watchdog.SOURCE + '","runtimeSha256":"' + "b" * 64 + '"}'
        with patch.object(watchdog, "ACCEPTANCE", marker):
            self.assertFalse(watchdog.accepted("a" * 64))
            self.assertTrue(watchdog.accepted("b" * 64))


if __name__ == "__main__":
    unittest.main()
