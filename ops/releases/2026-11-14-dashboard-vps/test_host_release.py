"""Critical adapter failure paths with all host effects replaced by fixtures."""
from copy import deepcopy
import json
import unittest
from unittest.mock import patch

import host_release as host
from runtime_plan import NAMES


class HostControls(unittest.TestCase):
    def test_blocked_packet_cannot_dispatch_even_with_correct_manifest_hash(self):
        raw = json.dumps({"status": "blocked", "blockers": ["fixture"]}).encode()
        digest = host.files.sha(raw)
        with patch.object(host.os, "name", "posix"), patch.object(host.os, "geteuid", return_value=0, create=True), \
             patch.object(host.files, "exact_file", return_value=raw), \
             patch.object(host, "run") as command:
            with self.assertRaisesRegex(ValueError, "PACKET_BLOCKED"):
                host.admitted(digest)
            command.assert_not_called()

    def fixture(self, running=True):
        return {"Id": "candidate", "Name": "/" + NAMES["api"], "Image": "sha256:" + "2" * 64,
                "State": {"Running": running}, "HostConfig": {"RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0}},
                "Config": {"Labels": {"masarifi.dashboard.base-container": "original"}}}

    def test_stopped_trial_still_has_automatic_restart_disabled(self):
        row = self.fixture(running=False)
        calls = []
        def command(argv, **_):
            calls.append(argv)
            row["HostConfig"]["RestartPolicy"]["Name"] = "no"
        with patch.object(host, "inspect", return_value=row), patch.object(host, "run", side_effect=command), \
             patch.object(host, "baseline", return_value={"originals": {"api": {"imageId": row["Image"], "containerId": "original"}}}):
            host.quiesce({}, {"candidates": {"api": "candidate"}})
        self.assertEqual(calls, [["docker", "update", "--restart", "no", "candidate"]])

    def test_foreign_candidate_is_not_stopped_or_reconfigured(self):
        row = self.fixture()
        row["Config"]["Labels"]["masarifi.dashboard.base-container"] = "foreign"
        with patch.object(host, "inspect", return_value=row), patch.object(host, "run") as command, \
             patch.object(host, "baseline", return_value={"originals": {"api": {"imageId": row["Image"], "containerId": "original"}}}):
            with self.assertRaisesRegex(ValueError, "REFUSE_FOREIGN_CANDIDATE"):
                host.quiesce({}, {"candidates": {"api": "candidate"}})
            command.assert_not_called()

    def test_unknown_stop_result_has_no_success_acknowledgment(self):
        row = self.fixture()
        row["HostConfig"]["RestartPolicy"]["Name"] = "no"
        with patch.object(host, "inspect", return_value=row), patch.object(host, "run"), \
             patch.object(host, "baseline", return_value={"originals": {"api": {"imageId": row["Image"], "containerId": "original"}}}):
            with self.assertRaisesRegex(ValueError, "CANDIDATE_NOT_QUIESCED"):
                host.quiesce({}, {"candidates": {"api": "candidate"}})

    def test_durable_acceptance_is_written_before_persistent_routing(self):
        events = []
        t = dict(ticket="t", packetSha256="a" * 64, deadline=100, candidates={"api": "candidate"})
        before = self.fixture()
        before["State"]["StartedAt"] = "same-start"
        before["RestartCount"] = 0
        before["Mounts"] = []
        before["HostConfig"]["RestartPolicy"]["Name"] = "no"
        after = deepcopy(before)
        after["HostConfig"]["RestartPolicy"]["Name"] = "unless-stopped"
        with patch.object(host, "private_json", return_value={"switchedUnix": 1}), \
             patch.object(host.acceptance_receipt, "verify"), patch.object(host.Adapter, "healthy"), \
             patch.object(host.time, "monotonic", return_value=0), \
             patch.object(host, "inspect", side_effect=[before, after]), \
             patch.object(host, "run", side_effect=lambda *a, **kw: events.append("policy")), \
             patch.object(host.files, "emit", side_effect=lambda path, value: events.append(path.name)), \
             patch.object(host.files, "finalize_trial", side_effect=OSError("interrupted")):
            with self.assertRaises(OSError):
                host.Adapter({}, t).finalize("e" * 64)
        self.assertEqual(events, ["commit.json", "policy", "accepted-configs.json"])


if __name__ == "__main__":
    unittest.main()
