"""Exercise disconnect, expiry and interrupted switch using a virtual clock only."""
from copy import deepcopy
import unittest

from trial_watchdog import WatchRuntime, watch


class Clock:
    def __init__(self):
        self.value = 0

    def now(self):
        return self.value

    def sleep(self, seconds):
        self.value += seconds


class Fixture:
    def __init__(self):
        self.events = []
        self.records = {}
        self.route = "original"
        self.fail_health = False
        self.fail_install = False
        self.fail_restore_once = False
        self.allow_evidence = True

    def emit(self, name, value):
        self.records[name] = deepcopy(value)

    def read(self, name):
        return self.records.get(name)

    def protected(self):
        self.events.append("protected")

    def healthy(self):
        if self.fail_health:
            raise ValueError("CANDIDATE_UNHEALTHY")

    def prove_original(self):
        if self.route != "original":
            raise ValueError("WRONG_ORIGINAL")
        self.events.append("original-proved")

    def prove_candidate(self):
        if self.route != "candidate":
            raise ValueError("WRONG_CANDIDATE")

    def install(self):
        self.route = "candidate"
        if self.fail_install:
            raise OSError("RELOAD_INTERRUPTED")

    def finalize(self, receipt):
        if not self.allow_evidence:
            raise ValueError("INDEPENDENT_EVIDENCE_MISSING")
        self.events.append("durable-acceptance")

    def restore(self):
        self.route = "original"
        self.events.append("restore")
        if self.fail_restore_once:
            self.fail_restore_once = False
            raise OSError("RELOAD_INTERRUPTED")

    def quiesce(self):
        self.events.append("quiesce")


class WatchdogTests(unittest.TestCase):
    def setUp(self):
        self.clock, self.f = Clock(), Fixture()
        self.ticket = dict(nonce="n" * 64, packetSha256="a" * 64,
                           bootId="boot", deadline=60,
                           candidates={"admin": "1" * 64, "api": "2" * 64})
        self.identity = dict(self.ticket, watchdogPid=321)

    def drive(self, step=lambda: None):
        def sleep(seconds):
            self.clock.sleep(seconds)
            step()
        return watch(self.ticket, self.f, WatchRuntime(321, "boot", self.clock.now, sleep))

    def switch(self):
        self.f.records["switch"] = self.identity

    def accept(self):
        self.f.records["accept"] = dict(self.identity, evidenceSha256="e" * 64)

    def assert_restored(self):
        self.assertEqual(self.f.route, "original")
        self.assertIn("restored", self.f.records)
        self.assertNotIn("accepted", self.f.records)
        self.assertLess(self.f.events.index("original-proved"), self.f.events.index("quiesce"))

    def test_console_disconnection_without_acceptance_expires(self):
        self.switch()
        self.drive()
        self.assert_restored()
        self.assertGreaterEqual(self.clock.value, 60)

    def test_already_expired_stage_is_quiesced_without_switching(self):
        self.clock.value = 61
        self.switch()
        self.drive()
        self.assert_restored()
        self.assertNotIn("armed", self.f.records)
        self.assertNotIn("switched", self.f.records)

    def test_slow_install_cannot_acknowledge_a_switch_after_deadline(self):
        self.switch()
        def install():
            self.f.route = "candidate"
            self.clock.value = 61
        self.f.install = install
        self.drive()
        self.assert_restored()
        self.assertNotIn("switched", self.f.records)

    def test_abort_during_install_cannot_acknowledge_a_switch(self):
        self.switch()
        def install():
            self.f.route = "candidate"
            self.f.records["abort"] = self.identity
        self.f.install = install
        self.drive()
        self.assert_restored()
        self.assertNotIn("switched", self.f.records)

    def test_old_pid_acceptance_cannot_outlive_new_watchdog(self):
        self.switch()
        self.accept()
        self.f.records["accept"]["watchdogPid"] = 320
        self.drive()
        self.assert_restored()

    def test_restart_restores_without_repeating_install_or_accept(self):
        self.f.records["armed"] = dict(self.identity, watchdogPid=320)
        self.f.route = "candidate"
        self.accept()
        self.drive()
        self.assert_restored()
        self.assertNotIn("switched", self.f.records)

    def test_interrupted_reload_restores_and_retry_proves_served_original(self):
        self.switch()
        self.f.fail_install = self.f.fail_restore_once = True
        self.drive()
        self.assert_restored()
        self.assertEqual(self.f.events.count("restore"), 2)

    def test_unhealthy_candidate_aborts_before_deadline(self):
        self.switch()
        def step():
            self.f.fail_health = True
        self.drive(step)
        self.assert_restored()
        self.assertLess(self.clock.value, 60)

    def test_matching_acceptance_requires_independent_evidence(self):
        self.switch()
        self.accept()
        self.f.allow_evidence = False
        self.drive()
        self.assert_restored()

    def test_acceptance_after_switch_is_bound_to_ticket_and_evidence(self):
        self.switch()
        self.drive(self.accept)
        self.assertEqual(self.f.route, "candidate")
        self.assertEqual(self.f.records["accepted"]["evidenceSha256"], "e" * 64)
        self.assertIn("durable-acceptance", self.f.events)
        self.assertNotIn("restored", self.f.records)

    def test_abort_wins_over_acceptance(self):
        self.switch()
        def step():
            self.accept()
            self.f.records["abort"] = self.identity
        self.drive(step)
        self.assert_restored()

    def test_deadline_crossed_inside_finalization_restores_instead_of_accepting(self):
        self.switch()
        def finalize(_):
            self.clock.value = 61
        self.f.finalize = finalize
        self.drive(self.accept)
        self.assert_restored()

    def test_abort_arriving_inside_finalization_restores_instead_of_accepting(self):
        self.switch()
        def finalize(_):
            self.f.records["abort"] = self.identity
        self.f.finalize = finalize
        self.drive(self.accept)
        self.assert_restored()

    def test_abort_during_candidate_proof_prevents_durable_acceptance(self):
        self.switch()
        original = self.f.prove_candidate
        def prove():
            original()
            if self.f.read("accept") is not None:
                self.f.records["abort"] = self.identity
        self.f.prove_candidate = prove
        self.drive(self.accept)
        self.assert_restored()
        self.assertNotIn("durable-acceptance", self.f.events)

    def test_final_proof_crossing_deadline_has_no_accepted_acknowledgment(self):
        self.switch()
        original = self.f.prove_candidate
        def prove():
            original()
            if "durable-acceptance" in self.f.events:
                self.clock.value = 61
        self.f.prove_candidate = prove
        self.drive(self.accept)
        self.assert_restored()

    def test_acceptance_placed_before_switch_is_rejected(self):
        self.switch()
        self.accept()
        self.drive()
        self.assert_restored()

    def test_foreign_ticket_and_invalid_deadline_are_rejected(self):
        for field, value in (("bootId", "another-boot"), ("deadline", 1201),
                             ("deadline", float("nan")), ("deadline", -1)):
            with self.subTest(field=field, value=value):
                ticket = dict(self.ticket, **{field: value})
                with self.assertRaises(ValueError):
                    watch(ticket, self.f, WatchRuntime(321, "boot", self.clock.now, self.clock.sleep))
        self.assertFalse(self.f.records)


if __name__ == "__main__":
    unittest.main()
