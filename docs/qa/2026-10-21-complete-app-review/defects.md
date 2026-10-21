# Defects and retests
Baseline `61117eaf07323ffa63c00f867d5d65e6f3142ece`; generated 2026-10-21T19:25:31+00:00 (timestamps UTC unless offset is explicit). Review date 2026-10-21, Asia/Riyadh. Worktree `D:/Masarifi-integration-2026-10-10`; branch `codex/voice-promoted-operating-2026-10-13`.

Severity: P0 data/financial/security critical; P1 intended critical feature/release-blocking; P2 material secondary behavior; P3 minor. Source-confirmed findings are separated from physically reproduced failures. No repair is accepted until its original scenario is retested in the affected environment.

## DEF-001 — Ordinary immediate-deletion parity unproven

- Severity/state: P1; confirmed source-path difference; ordinary runtime policy NOT VERIFIED.
- Reproduction: Compare DEV variant selection and ordinary AccountDeletionPanel path, then exercise controlled disposable identity on affected ordinary path when safely available.
- Actual: DEV alone selects /dev-account-deletion; ordinary client uses OwnedAccountDeletionPanel and server security policy.
- Expected: Requested immediate deletion with one confirmation and opaque progress on ordinary client too.
- Cause: Source branching confirmed; deployed ordinary policy/cooling behavior remains to be checked, not inferred from historical DEV repair.
- Affected source: [apps/mobile/src/config/client-runtime.ts:28](../../../apps/mobile/src/config/client-runtime.ts#L28); [apps/mobile/src/features/settings/AccountDeletionPanel.tsx:37](../../../apps/mobile/src/features/settings/AccountDeletionPanel.tsx#L37)
- Repair commit: none. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: PRIV-001–009; previous DEV evidence is historical and does not close this finding.

## DEF-002 — Support child routes unavailable to live users

- Severity/state: P1; confirmed source gating; physical NOT RUN.
- Reproduction: Use live mode and open /support/new, /support/tickets and /support/tickets/:id with an owned controlled fixture.
- Actual: Route implementations return BackendUnavailableState outside fixture mode despite live support adapter existence.
- Expected: Intended supported ticket/feedback/history/detail flows must be usable by ordinary live identities.
- Cause: Explicit isFixtureModeEnabled route guards; do not simply remove them before validating adapter ownership/contracts/response shape.
- Affected source: [apps/mobile/app/support/new.tsx:13](../../../apps/mobile/app/support/new.tsx#L13); [apps/mobile/app/support/tickets/index.tsx:7](../../../apps/mobile/app/support/tickets/index.tsx#L7); [apps/mobile/app/support/tickets/[id].tsx:9](../../../apps/mobile/app/support/tickets/[id].tsx#L9)
- Repair commit: none. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: SUP-001–008; no external ticket submission authorized during review.

## DEF-003 — Security-event route unavailable to live users

- Severity/state: P2; confirmed source gating; physical NOT RUN.
- Reproduction: In live mode open /security/events.
- Actual: Route returns settings.securityEvents.error outside fixture mode.
- Expected: Owned security-event history accessible if part of intended release; app-lock exclusion does not remove session/event review.
- Cause: Explicit fixture-only gate; underlying live capability must be validated before enabling UI.
- Affected source: [apps/mobile/app/security/events.tsx:7](../../../apps/mobile/app/security/events.tsx#L7)
- Repair commit: none. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: SEC-004; investigate live service support and safely repair/retest.

## DEF-004 — Standalone app lock disagreed with current release scope

- Severity/state: P2; configuration repaired locally; no APK built.
- Reproduction: Inspect staging-client eas env and runtime enablement policy.
- Actual: Before review profile requested true; review changed only that profile value to false.
- Expected: App lock disabled for this standalone release; code preserved; no PIN/biometric/unlock acceptance.
- Cause: Static profile setting disagreed with explicit user scope.
- Affected source: [apps/mobile/eas.json:1](../../../apps/mobile/eas.json#L1)
- Repair commit: `61117eaf07323ffa63c00f867d5d65e6f3142ece`. Existing config/runtime tests PASS; future standalone embedding NOT RUN. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: SEC-006; existing runtime/config tests and future embedded-bundle check required; no new app-lock tests requested.

## DEF-005 — Normal-user AI/voice operating admission not established

- Severity/state: P1; risk under investigation, not a reproduced denial.
- Reproduction: Read current route/worker/epoch/provider eligibility and compare two independent normal owners with fresh provider/posting results.
- Actual: Source exposes owner/epoch/admission modes; current deployed values and actual ordinary-user success unknown.
- Expected: Durable eligible ordinary users can post voice and get real assistant replies without developer restrictions.
- Cause: Do not treat existence of config knobs as proof of active restriction; verify actual deployed ingress/worker policy.
- Affected source: [apps/api/src/platform/config/environment.types.ts:1](../../../apps/api/src/platform/config/environment.types.ts#L1); [apps/api/src/ai/ai.service.ts:504](../../../apps/api/src/ai/ai.service.ts#L504)
- Repair commit: none. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: VOICE-021; AI-014; OPS-004/005; do not activate/drain workers to manufacture evidence.

## INFRA-001 — Broad test batch exhausted host memory

- Severity/state: P2; test infrastructure interruption; bounded reruns completed; original failed attempts retained.
- Reproduction: Initial parallel mobile Jest, API ts-jest and default-worker Admin Vitest runs on host with about 14 GB RAM.
- Actual: Node/PowerShell out-of-memory terminated runs; no complete passing results accepted.
- Expected: Checks complete within available host resources and report all failures/skips honestly.
- Cause: Too much concurrent compilation/test-worker memory; rerun sequentially with explicit worker/heap limits.
- Affected source: Private mobile-jest.log, api-jest.log, admin-vitest.log
- Repair commit: none. Retest: NOT RUN DEV; NOT RUN standalone.
- Evidence/follow-up: Keep original interrupted logs; record bounded retries as new attempts, not replacement passes.


<!-- current-review-evidence -->
## DEF-006 — Deployed migration/source compatibility gap

- Severity/state: P1 compatibility blocker; confirmed read-only deployment/source difference; physical failure NOT RUN.
- Reproduce: compare reviewed SQL migration names/versions with Supabase migration registry and read pg_proc for their newly declared helper functions.
- Expected: reviewed planning-payment and reminder correction contracts are present/equivalent in the deployed database.
- Actual: 144 tracked SQL migrations and 144 deployed migration rows; the 145th tracked migration-directory file is `.gitkeep`. Counts agree, contents/version identities do not.

| Source migration name | Source version | Deployed state |
|---|---|---|
| planning_payment_version_salary_date_corrections | 20261018145544 | No deployed migration with this name |
| normalize_reminder_cycle_baseline | 20261020220455 | No deployed migration with this name |
| automatic_salary_detection | 20261017140043 | Same name recorded under 20261017141513; SQL equivalence/checksum NOT VERIFIED |
| atomic_obligation_payment_create | 20261017144514 | Same name recorded under 20261017145825; SQL equivalence/checksum NOT VERIFIED |
| account_idempotency_erasure_guard | 20261020131349 | Same name recorded under 20261020131934; SQL equivalence/checksum NOT VERIFIED |
| manual_transaction_kind_revision | 20261021122922 | Same name recorded under 20261021125639; SQL equivalence/checksum NOT VERIFIED |
| voice_capture_account_context | 20261021122923 | Same name recorded under 20261021125643; SQL equivalence/checksum NOT VERIFIED |
| staging_automatic_salary_schedule | Not tracked with this name | Deployed version 20261017141555; reconcile purpose and source |
| renew_approved_dev_tracking_single_device_20261020 | Not tracked with this name | Deployed version 20261020062210; reconcile purpose and source |

Read-only pg_proc inspection confirmed `private.allocate_obligation_payment_core` and `private.reminder_baseline` are absent. Existing payment/salary/reminder functions are present, but current definitions differ from the reviewed correction path until equivalence is proven. This is a source/deployment compatibility finding, not a physical financial-failure reproduction. No migration was applied and no queue was replayed. Evidence: Supabase read-only tool results at approximately 2026-10-21T18:27–18:32Z; `deployed-migrations.json` private.

- Cause: these source corrections are not recorded under matching migration names and their new helper functions are missing. Full SQL equivalence and routing compatibility require isolated verification before an approved forward migration.
- Affected source: `supabase/migrations/20261018145544_planning_payment_version_salary_date_corrections.sql` and `20261020220455_normalize_reminder_cycle_baseline.sql`.
- Repair commit: none. Database changes: none. Retest: NOT RUN; cases OPS-003, OBL payment/reversal, SAL date/receipt and NOTIF reminder cycles.

## Investigation updates

- DEF-003 root cause extends beyond the route guard: live `createLiveIdentityService.listSecurityEvents` throws `provider_unavailable` (auth-service.ts:705). Backend owner route exists at `/api/v1/me/security/events`; a safe client mapping is required, not fake events or removing the error surface alone.
- DEF-005 is partly narrowed by current voice readiness evidence below. Fresh ordinary-owner/ordinary-package success and assistant worker/provider readiness are still open.
- DEF-007 (P2, source-confirmed live capability gaps, physical NOT RUN): `revokeAllSessions` and support `rate` explicitly throw unavailable. Source SEC-003 / SUP-007; preserve in coverage and do not mark supported based on mock tests.

Read-only Staging observation at 2026-10-21T18:27:49Z: voice analysis enabled, audience `authenticated`, owner policy restriction absent; automatic posting enabled; enforced operating epoch active with no expiry and heartbeat about 0.34 seconds old. Manifest declares `normalEligibility=true`, `continuous=true`, `newCapturesOnly=true`, `clientVariant=staging-development` and source `d02f03df7ab49260c57800d7576f1cd2c2a1ca24`. Manifest audit owner presence alone is not evidence of a restrictive policy. Ordinary-package runtime still needs proof. Assistant-agent job table had no rows; this neither proves worker readiness nor failure. Provider shallow health records were dated 2026-10-04 and are too old to establish current provider readiness. No provider charge or fresh financial action was triggered.

| Check | Passed / failed / skipped | Test files | Result | Private evidence |
|---|---|---|---|---|
| Admin complete Vitest run, maxWorkers=1/no-file-parallelism | 946 / 0 / 0 | 89 | PASS automated only | `admin-bounded.json` |
| Mobile latest complete per-file aggregation; 91 bounded batches plus focused retests | 3878 / 0 / 0 | 551 | PASS automated only | `mobile-final-results.json` |
| API unit/contract/security latest complete per-file aggregation | 234 / 0 / 8 | 50 | PASS automated only | `api-final-results.json` |

<!-- physical-review-ledger -->
## DEF-008 — Budget notification view used a nonexistent route

- Severity/state: P2; source-confirmed and reproduced by regression tests; local source repaired, physical retest **NOT RUN**.
- Entry/steps: Open a budget notification using View/default action in Notification Center or OS-response controller. Edit is a separate action.
- Expected: `/budgets/transactions/:budgetId` for view, `/budgets/edit/:budgetId` for edit; no automatic posting.
- Actual before repair: both view handlers constructed `/budgets/:budgetId`, absent from Expo inventory.
- Cause/source: `NotificationCenterScreen.tsx` and `notification-response-controller.ts` budget target switch branches.
- Repair: exact two view destinations corrected; relevant tests 26/26 after RED → GREEN. Repair commit `61117eaf07323ffa63c00f867d5d65e6f3142ece`. Installed base APK is older; no physical pass inferred.

## DEF-009 — Back did not leave Accounts after account creation

- Severity/state: P2; physical observed failure, cause under investigation.
- Reproduction/actual/evidence: PHY-006. Repeated Android Back left list visible; no visible back affordance. A DEV Home deep link recovered review navigation.
- Expected: reliable customer return path. Investigate route history after `AccountForm` replaces `/accounts`, native Back handling and user gesture comparison.
- Repair: none. Retest **NOT RUN**. This finding is separate from proof that created accounts persisted correctly.

## DEF-010 — Opening balances break ledger reads and post-save refresh

- Severity/state: P1, physically reproduced read/refresh failure and source-contract cause; local source repaired, installed-app retest pending.
- Reproduction: U-A creates A-EGP and A-SAR with nonzero opening balances, posts 25 EGP manual expense, observes “Saved. Retry to refresh the list and finish cleanup” and Home feed read error. Save retry retains warning; no duplicate expense.
- Expected: opening and subsequent normal transactions load; successful saves refresh the owned ledger without implying posting failed.
- Cause: database opening rows have source `account_opening`; mobile `ledgerSummarySchema` rejects that source before the existing opening→adjustment projection. An otherwise valid page/detail therefore fails contract validation. Two read regressions reproduce this with the server source observed in the owned database.
- Repair commit: `61117eaf07323ffa63c00f867d5d65e6f3142ece`. Accept this wire source only when kind is opening, then normalize to the existing local adjustment source. Strict source rejection for other kinds, strict fields, safe money and owner checks remain. No database write/API redesign.
- Automated: corrected RED two fail / one pass; final five-suite regression **205/205 PASS** and final typecheck/lint pass. Source: `apps/mobile/src/services/live/ledger-api-contract.ts`; regression in `core-finance-service.test.ts`.
- Physical: PHY-005 **FAIL**, original evidence retained. Retest must load corrected DEV JS, read existing records and retry the saved draft without reposting. No second 25 EGP expense. Later exact standalone acceptance **NOT RUN**.

## DEF-011 — Reported voice-analysis error despite confirmed posting

- Severity/state: P1 user-facing inconsistency under investigation; reported error versus captured later state explicitly distinguished.
- Reproduction/actual: PHY-008. User reported “تعذر تحليل الصوت” after the agreed Arabic recording; current screenshot at 19:12:28Z instead shows a financial-feed error and 965 EGP. Provider/session/batch/event/transaction evidence proves one successful 10 EGP posting with selected-account context.
- Expected: a confirmed posted event is communicated honestly and retry/recovery cannot invite a duplicate recording.
- Cause: DEF-010 confirms a financial read-contract failure, but the earlier analysis-error message itself and its exact state are not yet captured. Do not claim a speech-provider outage or declare that reported error repaired solely from the parser fix.
- Repair/retest: source read fix tracked in DEF-010. Original voice record preserved; retest existing result first, then a separately labeled fresh recording only when instructed. Do not replay historical audio. Full DEV result **FAIL**; standalone **NOT RUN**.

## Remaining source risk and infrastructure limits

- BUD-006: budget transaction drill-down appears to filter period/categories without an explicit currency filter while formatting using budget currency. EGP/SAR negative reproduction **NOT RUN**; no speculative patch.
- Current Staging SSH read attempt at 19:13Z timed out on port 22. No remote mutation was attempted. Root-cause investigation uses read-only owned database evidence and local contract tests; per-ingress deployment identity still requires access.
- UI capture tooling now treats a failed UIAutomator idle dump as invalid XML evidence; the two stale copies from the exploratory recording are excluded. Screenshots retain their original timing.

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
