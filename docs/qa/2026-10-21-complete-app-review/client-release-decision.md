# Client release decision

Updated 2026-10-21T19:26:56+00:00; baseline `9b380dfc8e42c3a484df3ac838e3ff91d9b14a48` on `codex/voice-promoted-operating-2026-10-13`, `D:/Masarifi-integration-2026-10-10`.

**NOT READY for client delivery. Review is in progress. No client APK build or distribution has occurred.** DEV and exact standalone gates remain independent.

The source-derived inventory covers **98 mobile route/intent sources, 16 layouts, 105 Admin pages, 1151 callable UI bindings, 231 functional cases, 15 notification targets, 376 API/dispatch entries and 144 SQL migrations**. The 145th tracked migration-directory file is `.gitkeep`. Joined traces connect 218 client adapter operations and 15 delegated integration bridges to actual route/controller/database dependencies. Coverage counts are not acceptance passes. Source repairs/configuration/test maintenance are committed at `61117eaf07323ffa63c00f867d5d65e6f3142ece`.

The user completed current-owner SAR setup and confirmed the account is disposable. Two synthetic accounts saved correctly. One manual expense and one provider-backed Arabic voice expense posted exactly once: EGP wallet **1000 → 975 → 965 EGP**; SAR bank/debit fixture remains **2000 SAR**, non-default. The user reported a voice-analysis error and the app failed to refresh financial data. These are failed visible-result cases despite correct persisted financial effects.

## Release-critical work still open

- Genuine unused Google registration and the second independent normal owner remain **NOT RUN**; the user is preparing an unused identity. Current-owner success does not establish ordinary-new-user eligibility.
- DEF-010: opening-balance source broke client ledger reads. Source repair and automated regression pass; installed-app retest remains pending. DEF-011: reported analysis error after successful posting needs exact earlier-error evidence and visible-result retest.
- DEF-006: 144 source/deployed migration counts conceal two missing-by-name corrections and five version differences. New payment/reminder helpers are absent. SQL equivalence and isolated integration/recovery proof remain required; no migration was applied.
- DEF-001: ordinary immediate-deletion path differs from DEV and remains unproven. Disposable deletion is last and requires deliberate user confirmation.
- DEF-002/003/007: live support routes, security-event mapping, revoke-all sessions and support rating contain unavailable paths. They remain intended-feature defects, not exclusions.
- Real OS SMS/notification capture, pause/revoke/restart/dedup/owner isolation, opt-in delivery and every target/action, provider-backed assistant/history/confirmed actions, planning/reversal/report correctness and authenticated customer-impacting Admin acceptance remain **NOT RUN** or **BLOCKED** as recorded.
- DEF-009: repeated Back from Accounts did not return; root cause and retest remain open. DEF-008 budget-notification route fixed locally, physical retest pending.
- Per-ingress API versions, ordinary-package provider/worker durability and independent-device coverage remain unproven. Voice policy currently permits authenticated users with no owner policy restriction and an active worker heartbeat; one U-A recording completed, not a complete eligibility gate.

## Agreed scope and protections

Payment gateway/checkout/subscription activation is excluded and nonblocking; preserve code and verify honest unavailable messaging. Standalone app lock is disabled in the local staging-client configuration with code retained; PIN/biometric/unlock acceptance is excluded. Authentication, session security and ownership remain required. No Production change, shared-database reset, historical audio/queue replay, external campaign or account deletion occurred. Private evidence and cleanup records remain outside Git.

## Review records and order

1. [Complete feature/action/integration inventory](feature-inventory.md) and [route matrix](route-matrix.md).
2. [Executable checklist, physical results and cleanup ledger](acceptance-checklist.md): complete current manual/voice defect retests; prove unused U-NEW and independent U-B initialization; continue accounts/categories/correction, SAR and second-owner voice, actual tracking, notification targets/actions, assistant, planning/reports, settings/Admin, then disposable deletion.
3. [Defects and original failure/retest provenance](defects.md).
4. [DEV versus standalone acceptance](dev-apk-parity.md).

For each user step, give one concrete action and expected observation, capture the result, then continue. User handles identity choice, secrets, microphone speech, OS permission decisions and destructive confirmation. Never request passwords or OTPs.

DEV gate cannot pass while critical visible-result failures and intended capabilities remain unresolved. A later user build request is required before preparing a standalone artifact. Standalone gate must identify exact package/signature/hash/embedded settings and repeat critical cases with Metro stopped, USB/reverse/local proxies absent and ordinary internet; preferably on a second independent Android device. No READY claim from DEV or automated results alone.

## Verification provenance

- Mobile latest complete per-file aggregation: **551 files, 3878 passed, 0 failed, 0 skipped** after the three new opening-source cases. This combines completed bounded batches with later complete per-file retests, not one monolithic run. Private `mobile-final-results.json` lists every attempt/file.
- API: **50 files, 234 passed, 0 failed, 8 skipped**; `api-final-results.json`. Skipped database integration/recovery scenarios are **BLOCKED** until an isolated disposable database is prepared. Docker daemon was unavailable and local 54322 absent; unrelated PostgreSQL on 5432 was left untouched. Shared Staging was not reset.
- Admin: **89 files, 946 passed**, bounded single-worker Vitest; typecheck and lint passed. Authenticated Admin browser acceptance **BLOCKED** at Clerk sign-in; no credentials entered by reviewer.
- Mobile final typecheck, API typecheck, scoped lint, 18 Node configuration cases and frontend/runtime boundary checks passed at the recorded attempts. A 768 MB mobile typecheck exhausted its heap; 1536 MB rerun passed. Original infrastructure failures remain preserved.
- Budget routing: original view failed; exact view/edit tests RED → GREEN, 26/26 in the affected two suites. View now targets `/budgets/transactions/:budgetId`; edit remains `/budgets/edit/:budgetId`; no financial action runs on view/edit.
- Navigation test maintenance: stale Clerk mock initially caused 27 failures; adding the already-required session-key mock exposed four outdated signed-out notification expectations. Tests now assert auth-pending and no remote resolution before authentication; no production auth guard changed. Three-suite retest 47/47 passed.
- API ownership maintenance: exact two existing authenticated automation aliases were missing from endpoint inventory. Added exact register/sign-out entries without wildcard/guard changes; ownership retest 6/6 passed after initial one failure.
- Opening-source regression: first RED had two real failures and an incorrect negative-error expectation. Corrected RED: two failures, one negative PASS. The first implementation passed runtime tests but failed type inference; final schema keeps a typed object, permits `account_opening` only for opening rows and normalizes its local projection to adjustment. Final relevant regression run 205/205 across five suites passed; final typecheck passed. Original logs and intermediate attempt remain private.
- Fresh independent reviewer found three material record defects: mutation callbacks mislabeled draft-only, vague budget destination, and disconnected integration inventory. Resolved by mutation-first expected effects, exact budget routes plus regression repair, and 218 joined adapter operation traces with 15 delegated integration bridges. Source/route/link verification ran after corrections. Clean-code/test-guard review retained boundary-based regression tests and strict money/owner/source validation.

