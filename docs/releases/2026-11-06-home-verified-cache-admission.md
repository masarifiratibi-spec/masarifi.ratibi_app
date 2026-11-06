# Home cache after verified session restoration

Physical 120 testing did not meet the user's request: a real new-process reopening still showed balance dashes before -16 SAR, even after earlier real data had loaded. The [120 device report](2026-11-06-home-cache-assistant-device-check.md) and its failed cache acceptance remain authoritative. Do not repeat that consumed build/install/question or claim that passing source tests established the phone behavior.

## Narrow source correction

The existing native lock-storage contract returns null when neither an explicit lock setting nor a legacy credential exists. Corrupt explicit settings fail closed, and any legacy credential presence returns an enabled/locked state. Null is therefore a legitimate no-lock-record state; no key export, preference rewrite or credential deletion is needed.

The existing protected-route policy admits Home after a verified, unexpired SDK restoration with no lock record. The cache provider nevertheless rejected that same state. A genuine integration RED reproduces the discrepancy: the real route policy admits the session, but the real Home balance hook and first-layout boundary display a dash instead of the held local -1600-minor-unit snapshot. Enabled/unlocked and explicitly disabled controls pass.

One production conditional is corrected. Only the null-preference case is added, and it requires completed profile setup, a remotely restored authenticated SDK session with a current owner, a non-null future expiry, hydration and no logout fence. Existing enabled locks still require unlocked status. Local-only access without a lock, expired sessions, incomplete profile verification, active locks and logout remain rejected. The native storage/parser, owner/SDK/route policy, keys, database schema, cache retention, timestamps and authoritative denials are unchanged.

The phone's private preference was not read; this is a proven source mismatch and a plausible cause of the observed phone failure. Actual acceptance still requires a qualified changed artifact and phone observation. Do not assert the phone's private state or a latency gain before that proof.

## Source evidence

One behavioral RED failed with 11 controls passing. Focused correction plus native lock-storage checks passed 26 cases in two suites. Final affected command passed **120 cases in eight suites**, zero failed/skipped cases and natural exit 0. Types, scoped lint and formatting exited 0 with no changed-file lint warnings. The final selection covers the real cache/provider/Home hook and first boundary, native lock-storage behavior, protected routing, expiry/privacy and retained read models.

Exactly one production file and one existing test file changed. Review is direct self review, not independent. The unchanged Assistant code and its 120 physical proof are reused: one completed old-conversation question, responsive native next draft, original empty draft restored, historical/current response limits disclosed. No new Assistant/SMS/Voice question or financial fixture is needed. Prior 381/25 and iOS 125/11 overlap these checks and must not be added to the fresh count.

Prepare one signed 121 artifact from the exact 120 build tree, retaining identity/configuration and the original signer. The user's original complete-package review condition applies before updating the primary. Physical scope is Home only: observe first entry and one ordinary cached reopening after a valid read has populated the cache if needed, preserving all identity/privacy checks and data. No repeated unchanged cold trials, force-stop/kill/reset, new financial fixture, hosted change, draft/history deletion or canonical delivery replacement. Whole-production readiness remains false.
