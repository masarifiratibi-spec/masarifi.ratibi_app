# Home cache after verified session restoration

Physical 120 testing did not meet the user's request: a real new-process reopening still showed balance dashes before -16 SAR, even after earlier real data had loaded. The [120 device report](2026-11-06-home-cache-assistant-device-check.md) and its failed cache acceptance remain authoritative. Do not repeat that consumed build/install/question or claim that passing source tests established the phone behavior.

## Narrow source correction

The existing native lock-storage contract returns null when neither an explicit lock setting nor a legacy credential exists. Corrupt explicit settings fail closed. When preference metadata is absent, legacy credential presence returns an enabled/locked state; a valid explicit native preference takes precedence, including a disabled preference with retained obsolete credential bytes. Null is therefore a legitimate no-lock-record state; no key export, preference rewrite or credential deletion is needed.

The existing protected-route policy admits Home after a verified, unexpired SDK restoration with no lock record. The cache provider nevertheless rejected that same state. A genuine integration RED reproduces the discrepancy: the real route policy admits the session, but the real Home balance hook and first-layout boundary display a dash instead of the held local -1600-minor-unit snapshot. Enabled/unlocked and explicitly disabled controls pass.

One production conditional is corrected. Only the null-preference case is added, and it requires completed profile setup, a remotely restored authenticated SDK session with a current owner, a non-null future expiry, hydration and no logout fence. Existing enabled locks still require unlocked status. Local-only access without a lock, expired sessions, incomplete profile verification, active locks and logout remain rejected. The native storage/parser, owner/SDK/route policy, keys, database schema, cache retention, timestamps and authoritative denials are unchanged.

The phone's private preference was not read; this is a proven source mismatch and a plausible cause of the observed phone failure. Actual acceptance still requires a qualified changed artifact and phone observation. Do not assert the phone's private state or a latency gain before that proof.

## Source evidence

One behavioral RED failed with 11 controls passing. Focused correction plus native lock-storage checks passed 26 cases in two suites. Final affected command passed **120 cases in eight suites**, zero failed/skipped cases and natural exit 0. Types, scoped lint and formatting exited 0 with no changed-file lint warnings. The final selection covers the real cache/provider/Home hook and first boundary, native lock-storage behavior, protected routing, expiry/privacy and retained read models.

Exactly one production file and one existing test file changed. Review is direct self review, not independent. The unchanged Assistant code and its 120 physical proof are reused: one completed old-conversation question, responsive native next draft, original empty draft restored, historical/current response limits disclosed. No new Assistant/SMS/Voice question or financial fixture is needed. Prior 381/25 and iOS 125/11 overlap these checks and must not be added to the fresh count.

Prepare one signed 121 artifact from the exact 120 build tree, retaining identity/configuration and the original signer. The user's original complete-package review condition applies before updating the primary. Physical scope is Home only: observe first entry and one ordinary cached reopening after a valid read has populated the cache if needed, preserving all identity/privacy checks and data. No repeated unchanged cold trials, force-stop/kill/reset, new financial fixture, hosted change, draft/history deletion or canonical delivery replacement. Whole-production readiness remains false.

## Signed 121 candidate

ONE 121 build completed with exit 0 at 2026-11-06T15:44:45.072415+00:00, source `76b68aba08629ebe448bb0254c9b2ac1fd544996`. APK `C:\mrc1105\artifacts\task29-customer-121-native.apk`, 49,514,590 bytes; SHA256 `97fd56eb4d4e40d99d171ee6cab33bd269b5507551569b5f129d87caf74e8e08`. Hermes SHA256 `74a6327fb1be0f15154222c0bb55327fc86d0e6d95be0dc95d5d0e00ccd13944`. All 2,975 prior-120 tree pins matched before the two-file overlay, and all 2,975 final pins matched. 120 was preserved without rebuilding.

The same Production signer, Arabic/package identity, version 1.0.0, minimum API 24, arm64 architecture, API/Clerk and automatic Voice policy remain. Signatures for APIs 24/28/32/33/35/36, 16 KB alignment, Record reflection and the actual DEX notification consumer/constructor pass. All 23 native libraries are byte-identical to 120; 0 have only build-ID-note differences. The existing Kotlin metadata advisories are retained and recorded.

The [manifest](../../ops/releases/2026-11-06-home-verified-cache-admission/manifest.json) binds 80 changed/retained source files and the [execution/recovery runbook](../../ops/releases/2026-11-06-home-verified-cache-admission/deployment-runbook.md). Final formatted manifest SHA256 `324e3f1ba2c4d785a8bf7b7b476ee8a4def678dd4a8111c38e7126df09f12d67`. Strict complete-package scan retains one public Clerk client finding and zero unexpected secrets, with exact inherited EAS bytes and unchanged scanner/ignore/key/identity. Owned source, staged changes and new-history scans have zero findings.

**121 is not installed.** Actual approval of this concrete package and Home-only physical observation are required. Phone causality and first-visible cache acceptance remain unproved; 120's real cache failure is retained. No new Assistant question or financial/SMS/Voice fixture is needed. Keep this final review, manifest and runbook frozen; execution is separate. Canonical 111 and broader production gates remain unchanged.
