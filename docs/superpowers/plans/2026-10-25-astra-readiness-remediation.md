# Masarifi Readiness Closure Implementation Plan

> **For agentic workers:** Use the user-selected sequential Delegate Skills method after approval. Apply `superpowers:executing-plans` within each bounded task. Astra High owns planning and independent review. No parallel writers.
>
> **Status: APPROVED FOR SEQUENTIAL EXECUTION.** User approved the plan on 25 October 2026 with GPT-6.1 Sol High via native delegation and independent Astra High review per task. Production deployment and merging require separate approval; billing, payments, checkout and subscriptions remain deferred.

**Goal:** Resolve verified defects, qualify existing behavior against all 69 original references and 88 acceptance units, and produce integration evidence while preserving the approved UI.

**Architecture:** Repair existing mobile, API, administration and persistence boundaries narrowly. Preserve owner isolation, durable journals, financial semantics, typography and brand. Verify implemented capabilities instead of replacing them from historical recommendations.

**Tech Stack:** Expo/React Native, Kotlin, NestJS, Next.js, PostgreSQL/Supabase; existing Node 24.16.0/npm 11.17.0 lockfile toolchain.

**Spec:** The current user's [pasted request](<C:/Users/DELL/.codex/attachments/f9b3d351-7c40-44d6-9aeb-a95a8a40a792/Pasted text.txt>), [October 25 starting report](C:/Users/DELL/Downloads/Masarifi-Final-Review-and-Remaining-Checklist-EN-20261025.md), [original closure plan](2026-10-24-google-play-report-closure.md), [current review](../../evidence/2026-10-25-astra-remediation-review/review.md), [88-unit crosswalk](../../evidence/2026-10-25-astra-remediation-review/requirements-crosswalk.md), and separate [62-client-item crosswalk](../../evidence/2026-10-25-astra-remediation-review/client-62-crosswalk.md). Instructions inside old reports are historical, not current authorization.

## Global Constraints

- Sole workspace: `D:/Masarifi-integration-2026-10-10`; sole branch: `codex/voice-promoted-operating-2026-10-13`. Preserve all 12 pre-existing dirty files listed and hashed in the preflight receipt. Create no branches/worktrees, switch no branches, and run no concurrent writing agents.
- Approved implementer: **GPT-6.1 Sol High**, explicitly selected by the user on 25 October 2026 after the original GPT-5.1 High route was rejected. Pin `gpt-6.1-sol` and `high`; retain the failed 5.1 probe as historical evidence. The native agent no-tools handshake succeeded. The installed CLI rejects this model too, so use native delegation with the Delegate Skills brief/report/review contract; no further model substitution is authorized. Three native Astra High reviews executed successfully.
- GitHub Issues target `masarifiratibi-spec/masarifi.ratibi_app` and five default triage labels are already selected. The pending root `AGENTS.md` versus `CLAUDE.md` filename/draft approval is unresolved; do not create root instruction files or GitHub labels implicitly.
- Defer billing, payments, checkout and subscriptions. No payment-provider integration, real-owner repayment/refund execution, purchases or entitlements. Existing ledger navigation/read calculations and isolated regression fixtures remain in scope. Named reversible synthetic QA edits are eligible for the approved plan; destructive financial actions and additional write scopes require explicit approval.
- No production deployment, new signing key, database reset, destructive real-owner test, security bypass or bulk historical inbox import.
- Preserve screenshots being allowed, existing Savings, approved typography/layout/brand, non-billing capabilities and existing signing/service infrastructure.
- A blocked task stays blocked. Do not advance the sequence without its acceptance or the user's explicit scope/sequence revision.

## User scope amendment —31 October2026

The user cancelled Android TalkBack manual testing from this plan. Exclude it from remaining work and acceptance/release gates; record it as cancelled by the user, never passed. Other accessibility requirements and existing implementation/tests remain in scope. This amendment supersedes historical references that list TalkBack as pending.

## Current user-approved execution scope (supersedes original gates)

The user explicitly approved these revisions on25October2026:

- T02 may use the currently signed-in Xiaomi account for safe PIN/biometric/restart/recovery testing. The existing Security Settings menu visibility moves fromT06 intoT02; events/refund work remainsT06. Multi-owner testing belongsT04.
- PIN implementation is accepted as complete by the user. Stop the remaining30/60-minute tests and closeT02 with an explicit accepted TESTING EXCEPTION after independent Astra review of completed work. Unperformed cases remain UNVERIFIED/NOT_RUN, never PASS; the exception must not block further tasks. Thirty-minute activation was observed before cancellation; its expiry was not tested. Sixty-minute activation/expiry was not run.
- Use the current account for all remaining SAFE, NONDESTRUCTIVE functional tests; preserve existing financial data, transactions, accounts, settings and authentication. No actual account deletion, database reset, destructive recovery or irreversible financial operation on that account. DestructiveT04/T12 cases use isolated synthetic fixtures or retain explicit real-device-not-verified outcomes; do not claim fixtures are phone acceptance.
- The user permits official safe recovery/unlock only if it preserves the existing account, PIN, biometric preferences and session and does not weaken/bypass security. Current app recovery resets the PIN, while app biometrics are OFF; neither provides an immediate eligible route. Let the existing temporary window expire naturally (estimated14:28:52 Riyadh), continue unrelated implementation, and verify normal PIN unlock before the next device testing. This is access restoration, not resumption of excepted PIN testing.
- GPT-6.1 Sol High still implements/tests; independent Astra High still reviews each task. Same worktree/branch, sequential execution, billing/payments deferred, production untouched; ask before merging.

## Review Focus

1. Warm loss of network after online restoration versus cold-local startup: supported edits persist once.
2. Accepted writes with lost responses: retries preserve the operation and never duplicate ledger effects.
3. Owner switches during async work: drafts, audio, queues, reports and credentials remain isolated.
4. Locale/timezone/hour-cycle changes inside cache TTL: labels and actual bounds stay consistent.
5. Native behavior hidden by DEV/Metro evidence: final standalone artifact matches the reviewed source.

## Baseline, notation and gate commands

`R=D:/Masarifi-integration-2026-10-10`, `M=R/apps/mobile`, `A=R/apps/api`, `W=R/apps/admin-web`, `DB=R/supabase`. Paths below expand literally; tests marked **add** are proposed files.

HEAD is `5aa1267dccac67a8b95249dbddbf398c25d1bb49`. Current remote/local main and merge-base are `ecfba4d7de40555c122bd3b5e53e7e7fd71f6294`; the branch is ahead 567/behind 0. Refresh this evidence before final integration without switching branches.

PR9 has 18 successful checks and one skipped backend-tag image provenance job. Latest baseline performance/stress gates passed. The successful Android job is unsigned/inert diagnostics, not an Android signed-release gate. Dirty PIN/CI changes are outside that run.

Historical SQL: 67 suites/1,929 assertions and 64 focused checks. Candidate registers 174 migrations; historically inspected hosted schema had 165/PG17.6. Verify current target rather than assuming parity or using stale failure counts.

Known phone: Xiaomi 23076RN8DY, ADB `f66a40694eca`, Android15 ARM64, 4KB pages. Both ordinary and DEV apps exist; DEV 0.0.1/code1 targets API36/min24. This review checked connection/identity only, not new acceptance.

Supporting commands:

- M: `npm run typecheck`, `npm run lint`, appropriate `check:app-shell`, `check:core-finance`, `check:financial-planning`, `check:reports`, `check:voice-capture`, `check:assistant-notifications`, `check:design-system` scripts.
- M focused tests: `npm test -- --runInBand --runTestsByPath <test-paths>`.
- A focused tests: `npm test -- --selectProjects <project> --runInBand --runTestsByPath <test-paths>`. Also `npm run typecheck`, `npm run lint`, `npm run format:check`; relevant `test:reports:*`, `test:sync:*`, `test:ai:*` scripts.
- W serial suite: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism`; targeted filenames may be appended. Also `npm run typecheck`, `npm run lint`, `npm run build`, and configured Playwright checks.
- DB/migration/performance commands use only the established positively identified disposable target. The API `verify` script includes external integration/E2E checks; it is not a universally safe offline command.

## Mandatory per-task execution protocol

- [ ] Astra issues one bounded brief with approved scope, exact assertions, files, gates and evidence requirements. Use Matt Pocock diagnosing-bugs for uncertain failures, TDD for behavioral regressions, relevant domain modeling, and code review where applicable.
- [ ] GPT-6.1 Sol High executes via the verified native agent route; adapt the Delegate Skills self-contained brief, structured report and independent review contract. The CLI route is currently unavailable for the selected model. Pin model and high effort explicitly; give the exact worktree/branch and no-commit/no-deploy constraints. No new writer until it exits and the report is read.
- [ ] Reproduce/assert the fault before the smallest necessary repair; retain passing existing behavior. For qualification-only work, make no change without an evidenced defect.
- [ ] Run relevant automated gates and record failures/skips honestly. Native changes require an actual rebuilt/installed matching APK, not a Metro-only update.
- [ ] For every mobile-affecting task, the implementer itself runs ADB connection/target checks, launches the real installed app, and performs the named ordinary UI journey. Verify buttons/forms/routes/errors and Arabic/English where applicable. No auth/PIN bypass, emulator-only acceptance, mocks or unit-test substitute.
- [ ] Save screenshots, safe logs/request IDs, reproduction steps and observed values. Bind source SHA/dirty manifest, APK hash/package/version/certificate, runtime flags, API/schema and provider/policy identities using the [task evidence template](../../evidence/2026-10-25-astra-remediation-review/task-evidence-template.json). Reconcile test data and restore settings.
- [ ] Independent Astra High checks diff, requirements, automated results, device evidence and regressions; independently reruns relevant supporting checks. Approve/reject each acceptance criterion. Missing device/runtime evidence is BLOCKED, never PASS.
- [ ] On rejection, resume the same implementation task with a delta brief. After acceptance, the coordinator can stage only the task's reviewed files and commit when within the approved execution scope; preserve unrelated changes. Then start the next task.

## P0: Preservation and trustworthy execution

### T01: Approval, baseline and evidence admission — qualification

**Depends:** none. **Files:** preflight/evidence manifests, package/workflow configuration, this plan and crosswalk; no product edits.

- [ ] Resolve plan approval, exact implementer model and safe test target; retain the selected GitHub tracker/defaults. Resolve the pending root-instruction draft separately before writing it.
- [ ] Verify branch and existing dirty hashes, all 88 IDs, device/package identity and finite QA data scopes.
- [ ] Record missing publisher/provider/hosted access as blockers rather than creating infrastructure.
**Pass:** approved executable brief and trustworthy unchanged baseline. Model/approval blockers prevent dispatch.

### T02: Preserve PIN acceleration and qualify full lock lifecycle

**Depends:** T01. **Files:** `M/src/features/security/privacy-lock.ts`, `M/modules/masarifi-pin-crypto/`, lock state/storage.
**Tests:** `M/src/features/security/privacy-lock.test.ts`, `privacy-lock.native.test.ts`, `SecurityJourney.test.tsx`; in `M/android`, `.\gradlew.bat :masarifi-pin-crypto:testDebugUnitTest`.

- [ ] Assert credential compatibility, stored cost/new 120,000 iterations, native vectors/fallback and escalating persistent cooldowns; preserve existing fix.
- [ ] Rebuild/install only the intended DEV candidate in place if needed, preserving app data/signing.
- [ ] Phone: unchanged PIN timing, wrong attempts, restart/cooldown expiry/reset, biometric fallback, background lock and isolated owner switch. API24/25 fallback remains a distinct boundary.
**Pass under revised scope:** completed actual phone evidence, narrow navigation regression, and independent Astra approval with the user-accepted remaining PIN testing exception. Do not relabel unperformed30/60-minute checks as passes. Broader original acceptance remains explicitly excepted/unverified.

### T03: Warm/cold offline edits and truthful save outcomes

**Depends:** T02. **Files:** `M/src/services/core-finance-runtime.ts`, `src/storage/core-finance-repository.ts`, `src/features/transactions/TransactionForm.tsx`.
**Tests:** repository/runtime/form suites; add a warm-network-loss regression if absent; run `check:core-finance`.

- [ ] Reproduce D057 and assert one durable supported edit after warm loss of network, no duplicate uncertain write, and accurate error classification. Queue already exists; restoration-state dispatch is the suspect.
- [ ] Preserve limitations on unsupported offline account/category/currency/type changes; explain them accurately.
- [ ] Phone: reconcile retained QA expense note before replay, disconnect after online unlock, edit note, save, restart offline, reconnect and verify exactly one server result; repeat cold-local entry.
**Pass:** pending/save status and persisted/server data agree. Covers ISSUE013.

### T04: Sync, logout and isolated key-loss recovery

**Depends:** T03. **Files:** mobile owner lifecycle, database/sync storage, `src/services/live/core-finance-service.ts`; `A/src/sync/sync.codec.ts` and worker.
**Tests:** existing logout/conflict/cursor-upgrade suites; `test:sync:logic`, relevant integration/security/recovery projects.

- [ ] Assert cursor/version resync retains pending work, queued auth uses original instant, reauth replay retains operation identity and logout decisions are durable.
- [ ] Phone: offline startup/unlock/read, conflicts, reconnect, logout cancel/explicit disposition and owner isolation. Key-loss qualification uses only isolated disposable data.
**Pass:** no silent local data loss or owner reuse. Dedicated cursor-key/config access may block service acceptance; secrets stay out of evidence.

### T05: Database compatibility and financial invariants

**Depends:** T04. **Files:** `DB/migrations/`, `DB/tests/`, migration tooling.
**Gates:** A `migration:checksums`, relevant `test:migration` and `test:db` only on verified disposable targets.

- [ ] Qualify whole 174-migration chain on fresh/upgrade paths: RLS, fee rejection, safe minor units, currency grouping, transfer/refund read totals, planning receipts and operation idempotency using fixtures.
- [ ] Re-inspect hosted metadata read-only; do not infer parity, rewrite historical migrations or reset a shared target.
- [ ] Record the separate P3 nullable `source_version` CHECK follow-up; any approved fix is an additive migration plus direct constraint regression, outside the69-reference denominator.
**Pass:** exact candidate database results and honest hosted boundary. Any mobile-facing change also needs the corresponding phone scenario.

## P1: Ordinary journeys and data services

### T06: Approved security and transaction-details navigation

**Depends:** T05. **Files:** `app/security/settings.tsx`, `app/security/events.tsx`, transaction list/detail screens. The More Security Settings visibility prerequisite was moved intoT02 by explicit user approval; preserve it rather than redo it.
**Tests:** `SecurityJourney.test.tsx`, existing transaction-list/detail/route tests.

- [ ] Reconcile hard-hidden menu entries against approved navigation; expose existing protected Security→Events and expense→Details paths without redesign.
- [ ] Assert live owner-scoped events, pagination/retry/empty states, guarded routes and eligible refund-review entry.
- [ ] Phone: enter through ordinary More/Transactions taps; diagnostic routing is insufficient. Inspect refund review only; actual refund/payment execution remains deferred.
**Pass:** ISSUE003/004 and navigation portion of005 resolved with evidence; financial-action acceptance remains deferred/blocked honestly.

### T07: Budget draft recovery, onboarding and numeric boundaries

**Depends:** T06. **Files:** budget form, onboarding profile setup, `M/src/domain/user-amount.ts`.
**Tests:** `BudgetJourney.test.tsx`, onboarding/profile tests, amount tests; `check:financial-planning`.

- [ ] Assert invalid/partial periods never replace editable form; valid query guards, field focus and unrelated draft fields survive correction.
- [ ] Preserve first-save operation identity and Arabic/Persian 0/2/3-decimal, overflow and opening-balance behavior.
- [ ] Phone: recover retained 2026-13 draft, correct with real keyboard, save/reopen within approved QA dataset; verify interrupted onboarding/planning replay.
**Pass:** ISSUE010 plus bounded planning/input acceptance, no subscription work.

### T07a: Savings and rich planning preservation — qualification

**Depends:** T07. **Files/tests:** `M/src/features/savings/SavingsJourney.test.tsx`, `src/storage/financial-planning-savings.test.ts`, `src/domain/financial-planning-savings.test.ts`, rich obligation/budget models and live planning adapters.

- [ ] Qualify existing savings CRUD/movement/history, progress/account effects, payable versus receivable remaining balances and lossless rich fields; preserve budget expense/income/savings targets across sync. Use safe reversible QA data only.
- [ ] Phone: ordinary savings and planning journeys with Arabic/English fields and restart. No real repayment or external transfer. Original client5/36/52; do not recreate implemented features.
**Pass:** exact scoped calculations and durable server round-trip, or evidence of a bounded defect for repair.

### T07b: Card terms and calculator preservation — qualification

**Depends:** T07a. **Files/tests:** `M/src/domain/credit-card-payoff.ts` and `.test.ts`, `src/features/accounts/AccountForm.test.tsx`, `AccountForm.credit-opening.test.tsx`, `A/src/reference/credit-card-payoff.ts` and relevant reference tests.

- [ ] Reuse delivered client 38/39 calculator/terms. Assert stored percent scale, rounding/non-payoff cases, nullable legacy terms, statement/due-day limits and reminder linkage; reconcile historical rule6 with the currently approved calculator contract instead of disabling it.
- [ ] Phone: existing card view/form/calculator and liability presentation using safe QA terms; no payment execution. Original 54 is separately deferred for payment execution, while posting invariants remain fixture-tested in T05.
**Pass:** preserved terms and honest calculated outputs without card-debt double counting.

### T07c: Category lifecycle and remittance semantics — qualification

**Depends:** T07b. **Files/tests:** `M/src/features/categories/CategoryJourney.test.tsx`, `CategorySaveJourney.test.tsx`, `src/services/live/category-lifecycle-service.test.ts`, category models, registry and API reference/ledger contracts.

- [ ] Assert authoritative usage counts, confirmation/archive/merge, stale-version rejection, retained history and income/expense kind. Internal transfers have no expense category; external remittance remains an expense with stable identity. No guessed destructive backfill.
- [ ] Phone: create/reclassify an approved unused QA category, cancel an archive/merge, inspect safe confirmation and error paths. Mutating used real categories is excluded. Original30/56/58/62.
**Pass:** current lifecycle and budget-category identity preserved through live adapters.

### T08: Diagnose report availability and repair cache identity

**Depends:** T07c. **Files:** `M/src/services/live/reports-service.ts`, `A/src/reports/reports.service.ts`, `reports.cache.ts`.
**Tests:** mobile live reports tests; `A/test/unit/reports/reports-service.spec.ts`, `reports-cache.spec.ts`.

- [ ] Capture safe endpoint/status/domain/request ID and decode stage for actual failure. `reports_unavailable` is lossy; establish cause before repair.
- [ ] Assert same-ledger-version timezone changes and omitted-anchor/cycle rollover within 300 seconds cannot reuse old reports. Key by resolved timezone/bounds while retaining owner/account/currency isolation.
- [ ] Phone: ordinary report/retry, exact correlation, real response with matching range/zone.
**Pass:** ISSUE006 cause established and repaired, plus independent cache defect covered. Hosted logs/service parity may block acceptance.

### T09: Reporting periods, scope, completeness and delivery

**Depends:** T08. **Files:** `ReportsScreen.tsx`, report queries/view state, live report projection, API generation/schedules.
**Tests:** `ReportsJourney.test.tsx`, API report account-summary/schedule suites; relevant `test:reports:*`, `test:reports:smtp`.

- [ ] Assert offered day/week/custom ranges are honored across the existing contract or constrain unsupported choices honestly; never discard the start and force monthly.
- [ ] Verify per-currency/refund/transfer/net-worth/FX read calculations, comparisons/detail boundaries and unavailable states. Do not fabricate unsupported fields.
- [ ] Phone: cycle 1/25, selected range/account/currency, labels/request/totals/drill-down, preview/download/schedule/history; actual email only with explicit recipient/send authorization.
**Pass:** each report subcapability independently evidenced; availability alone cannot close partial projections.

### T10: Support status and mobile→Admin→mobile recovery

**Depends:** T09. **Files:** mobile support screens/locales, `A/src/engagement/`, W support conversation.
**Tests:** `SupportJourney.test.tsx`, ticket/service tests, API support recovery, Admin support conversation tests.

- [ ] Assert every contractual status including waiting_support/waiting_user translates; preserve submission idempotency/draft and refresh.
- [ ] Phone/browser: review existing QA ticket and error/retry state; send additional support messages/Admin replies only if expressly authorized.
**Pass:** ISSUE007 and applicable synchronization states; unauthorized communication remains blocked.

### T11: Export after re-verification

**Depends:** T10. **Files:** mobile privacy export panel/journal; API security export handlers, package/storage/worker.
**Tests:** existing privacy export panel, `test/integration/security/privacy-export.spec.ts`, export-package unit tests.

- [ ] Correlate retained500 request IDs, reproduce fault, preserve recent-auth request identity and assert request/status/download/ownership/expiry/retry.
- [ ] Phone: actual Clerk re-verification through UI, completed authorized export/download, inspect bounded contents and expired-link recovery.
**Pass:** ISSUE009 resolved end-to-end. Hosted correlation/storage access are dependencies; no guessed deployment fix.

### T12: Deletion, security and truthful public lifecycle

**Depends:** T11. **Files:** API deletion/owner-erasure handlers, mobile deletion panel, W public-deletion feature.
**Tests:** existing immediate/delayed deletion, retention/erasure and public-page suites.

- [ ] Assert cooling-off/cancel/expiry, interrupted cleanup/provider retries and actual eligible-data erasure before completion. Preserve recent-auth and owner isolation.
- [ ] Verify Staging-only immediate-deletion exceptions are absent or separately approved for the intended release.
- [ ] Phone/browser: dedicated disposable account only, real in-app/external path, truthful retention/status/privacy copy. Parked HTTP200 is a failure.
**Pass:** lifecycle evidence from allowed target. No deletion of real owner; public publication/production deployment is not authorized here.

## P2: Presentation, lifecycle and capture

### T13: Theme, accessibility and localization repairs

**Depends:** T12. **Files:** application settings, transaction list, obligation overview, assistant conversation view, Arabic/English locales.
**Tests:** settings/list/obligation/assistant/direction suites; `check:design-system`.

- [ ] Assert themed regional text, full cross-year range, readable long names and device hour-cycle preference after foregrounding. Retain tokens/fonts.
- [ ] Phone: Arabic/English RTL/LTR, Light/Dark/System, normal/1.3/1.6 font scale and200% supported layout where applicable. Restore device settings.
**Pass:** ISSUE001/008/012 and bounded long-name observation; financial amounts/currency stay visible.

### T14: Real keyboard and durable draft lifecycle

**Depends:** T13. **Files:** transaction form, assistant composer, planning/support draft storage.
**Tests:** `AssistantKeyboard.test.tsx`, composer tests, core-finance draft tests.

- [ ] Assert rejected sends retain text and agreed draft fields survive required lifecycle with owner fences; reproduce before extending persistence. Existing create/planning drafts already work.
- [ ] Phone: Arabic/English keyboard dismiss/back, picker transitions, lock/background, navigation and restart; qualify edit/composer gaps without rebuilding keyboard architecture.
**Pass:** promised persistence and no cross-owner text leakage, including local save failures.

### T15: SMS discovery/parser/published policy

**Depends:** T14. **Files:** `R/packages/transaction-parser/`, `M/modules/masarifi-sms-inbox/`, API tracking.
**Gates:** shared Node regression tests, native SMS JUnit, tracking parser/contract tests.

- [ ] Assert malformed/filtered-empty/tied pages, OTP/promotion/bill distinctions, amount roles, merchant suffixes, aliases/bare currency ambiguity and owner/policy/cursor fencing.
- [ ] Phone: controlled actual approved SMS, grant/deny/recovery, review correct account/amount/currency and no unexpected capture. No bulk inbox import or OTP-redaction bypass.
**Pass:** actual JS/native/server path and published policy evidence; synthetic 90 checks remain supporting evidence.

### T15a: Merchant rules and per-account opt-out — qualification

**Depends:** T15. **Files/tests:** shared parser, mobile live tracking/reference adapter tests and API tracking rule/owner tests; existing Admin merchant/category-rule routes.

- [ ] Assert normalization and explicit user-rule precedence/category learning, owner scoping and persisted account/card opt-out before proposal and on retry/replay. Original40/45; retain existing sender 47 and keyword 46 policies.
- [ ] Phone: normal controlled tracking review and settings persistence; opted-out QA source produces no proposal/posting. Real inbox bulk import and financial posting remain outside the approved data scope.
**Pass:** policy and actual capture agree without losing unrelated pending work.

### T16: Notification queue, preferences and OEM recovery

**Depends:** T15a. **Files:** native listener/queue, mobile coordinator/status/preferences, API notification policy.
**Tests:** native queue/recovery and coordinator suites; app-shell/assistant-notification gates.

- [ ] Assert acknowledgment durability, >200 pending retention without eviction, safe compaction/cache invalidation and persisted source/preferences.
- [ ] Phone: deny/grant/revoke/regrant, real controlled notification/reminder delivery/content, screen-off/restart/reconnect and owner switch with no duplicate posting. Test quiet/privacy/localization states and normal notification-preference entry.
- [ ] Respect force-stop/background/OTP platform limits; record Samsung/other-OEM gaps separately.
**Pass:** qualified source/preference/delivery boundaries; additional hardware/access can block full acceptance.

### T16a: Authenticated notification actions — qualification

**Depends:** T16. **Files/tests:** `M/src/features/notifications/notification-response-controller.ts` and `.test.ts`, `src/features/shell/NotificationResponseRuntime.test.tsx`, API notification policy/action contracts.

- [ ] Assert lock/recent-auth/owner checks, expired/replayed actions and exactly-once domain dispatch; Gulf-zone daily reminder deduplication remains consistent. Original42/44 and business rule 8.
- [ ] Phone: receive a controlled authorized notification, use its actual action while locked/unlocked, cancel/retry and follow the normal route. Test financial action effects with fixtures; actual financial mutation requires approved finite QA scope.
**Pass:** real action route/auth behavior and canonical result evidence, not delivery alone.

### T17: Actual assistant provider, narrative dates and tenant contracts

**Depends:** T16a. **Files:** API assistant agent/gateway/configuration, mobile structured response rendering.
**Tests:** gateway/assistant/comparison and live assistant adapter suites; relevant AI unit/contract/security/recovery gates.

- [ ] Assert provider/model receipts, owner/auth isolation, conservative independent quotas, Gulf Arabic and structured bilingual narrative dates without arbitrary regex rewriting.
- [ ] Phone: true provider execution versus direct financial reads, missing-data/mixed-currency honesty, timeout/429/cancel/retry and multi-turn behavior.
**Pass:** ISSUE011 plus actual provider evidence. Do not add infrastructure/raise quotas to manufacture success.

### T17a: Assistant confirmed actions — qualification

**Depends:** T17. **Files/tests:** `M/src/features/assistant/AssistantActionPreviewScreen.tsx` and `.test.tsx`, `src/domain/assistant-actions.test.ts`, API assistant preview/confirm and domain-command tests.

- [ ] Assert allowlisted preview, confirmation/rejection, expiry/version/replay, owner scope and canonical read/write parity; arbitrary model tools remain unavailable. Original48.
- [ ] Phone: actual supported preview and reject/cancel flows; any approved synthetic confirm must produce exactly one expected domain change and matching audit/ledger receipt. No payment/subscription actions.
**Pass:** model response plus actual authorized action acceptance; a read-only assistant answer does not close this unit.

### T18: Voice permissions, capture and recovery

**Depends:** T17a. **Files:** mobile voice screens/review/live services; API voice handlers and migration chain.
**Tests:** voice recovery/screen/review suites; `check:voice-capture`, A `test:ai:recovery`.

- [ ] Assert selected account/currency/owner frozen through capture, upload and retry; conservative quota/model mismatch handling.
- [ ] Phone: denied/settings recovery, approved actual recording/upload, cancel/interruption/restart and reviewed result. Any synthetic financial posting must have an approved finite QA scope; otherwise record posting acceptance blocked.
**Pass:** actual audio/provider/result path and permitted financial reconciliation; no historical audio or queue replay.

### T19: Admin integration and preserved dashboard

**Depends:** T18. **Files:** W overview/imports/AI/security/communications and owning API reads.
**Tests:** existing live-response/repository/mock-boundary suites, serial Vitest and configured Playwright viewports.

- [ ] Read W-local agent rules and bundled Next docs before any edits. Assert actual permissions, truthful provider/export states, failure recovery and no fixture leakage.
- [ ] Browser: supported viewports, ordinary Admin roles, support/security consistency with phone evidence; exclude billing. No broad dashboard redesign.
**Pass:** actual approved Admin/API integration plus regression preservation. Privileged-role access can block hosted acceptance.

## P3: Exact candidate and release gates

### T19a: Feedback and Admin-only moderation — qualification

**Depends:** T19. **Files/tests:** W existing `src/app/admin/feedback/` routes, `A/src/engagement/` feedback contracts/tests, mobile support/feedback surfaces and owner-isolation tests.

- [ ] Qualify client 57 feedback lifecycle separately from ticket conversation. Assert only authorized Admin moderation/edit/delete and owner visibility; preserve currently approved rating disposition, and obtain a scope amendment before adding star ratings if undecided.
- [ ] Phone/browser: existing authorized synthetic feedback and moderation states; no messages to others or changes to genuine customer records without explicit authorization.
**Pass:** real owning workflow plus permission evidence; ticket status translation alone is insufficient.

### T20: Effective CI/native gates and signer compatibility

**Depends:** T19a. **Files:** candidate workflows, existing dirty preservation workflow, native module gates and identity checker.

- [ ] Include new PIN JUnit in an effective exact-candidate gate; resolve manual preservation workflow DEV-certificate/release-signer conflict without weakening safety.
- [ ] Run `node --test scripts/integration/verify-android-identity.test.cjs` and relevant full CI including affected performance/stress checks at the new committed SHA.
- [ ] Phone: matching rebuilt native candidate install/startup/PIN smoke, preserving data.
**Pass:** exact new source qualified. Old green CI cannot certify dirty changes.

### T21: Standalone APK/AAB and external Play requirements

**Depends:** T20. **Files:** app/EAS/Gradle config, release manifest checker/tests and production bundle auditor.

- [ ] Bind approved version/environment/Clerk/API, non-debuggable/API36 manifest, existing upload signer, bundle/source hash and AAB receipt. Upload cert and Play app-signing cert are distinct.
- [ ] Verify R8/resource shrinking, schemes/permissions/no fixtures or purchase entrypoints, native ZIP/ELF 16 KB compatibility.
- [ ] Phone: final signed/minified standalone journeys through auth/UI/navigation/offline/tracking/Voice/notifications/reports. DEV/Metro is insufficient; Xiaomi 4 KB does not prove 16 KB runtime. Supplemental 16 KB emulator evidence is acceptable for that platform compatibility boundary; the actual connected-phone journeys remain mandatory and may not be replaced by emulator tests.
- [ ] External gates: intended publisher/version history, SMS declaration/approval, Data Safety/financial declaration, real privacy/deletion URLs, applicable 12-testers/14-days testing, relevant Samsung/API/minimum boundaries plus16KB compatibility evidence. The personal-account testing rule applies to accounts created after 13 November 2023, not every publisher. Preserve SMS/notifications; no silent removal.
**Pass for integration:** source/artifact/device checks pass and external store-publication blockers are explicitly recorded. Console/SMS/publisher/closed-testing completion is a separate publication-readiness state, not a claim needed to merge accepted source fixes. Missing required application/device acceptance still blocks integration. No production deployment or publication.

### T22: Integrated Astra review and separately approved merge

**Depends:** T21.

- [ ] Reconcile all 69/88 rows and added findings using the same accepted candidate; preserve explicit deferred/exception/external states.
- [ ] Independent Astra reviews the integrated diff against pinned main/spec using Matt Pocock Standards and Spec axes, exact CI, artifact identity, service/schema parity and final real-device evidence. Reopen any failing task.
- [ ] Only after all applicable code-integration checks pass and publication-only blockers remain explicit, present a concrete merge request for separate approval. Then merge existing PR9 server-side against the reviewed SHA, without checking out main; verify CI and repository/source ancestry afterward.
**Pass:** approved integration and post-merge verification. Merge never implies deployment, billing activation or Google Play approval.

## Original-client coverage and scope decisions

The separate 62-ID crosswalk preserves the original client document and repository transcription. Their dated open/fixed labels are historical; every row points to current existing code/test areas and an acceptance task, evidence gate or explicit proposed deferral. Original 62 and report 69/88 remain separate denominators. Added qualification subtasks T07a/T07b/T07c/T15a/T16a/T17a/T19a each carry their own implementer/device/Astra gate; they are not permission for parallel work.

Execution order is T01→T02→T03→T04→T05→T06→T07→T07a→T07b→T07c→T08→T09→T10→T11→T12→T13→T14→T15→T15a→T16→T16a→T17→T17a→T18→T19→T19a→T20→T21→T22.

Preserve nine original business rules as named acceptance cases, adapted to canonical current schemas: BR1 internal transfers excluded from income/expense(T05); BR2 linked refunds reduce expense, not income(T05/T09); BR3 card liability reduces net worth without duplicate obligation counting(T05/T09); BR4 card payoff remains a distinguished ledger intent, fixture acceptance only while payment execution is deferred(T05/T07b); BR5 monthly interest has explicit stored percentage scale(T07a/T07b); BR6 reconcile legacy stored-only card interest against subsequently approved delivered calculator 38/39(T07b); BR7 budget category identity includes custom/remittance and stable keys(T07c); BR8 Gulf-time daily reminder deduplication(T16/T16a); BR9 Admin-only feedback moderation(T19a). These describe business meaning, not demands to copy Base44 column names.

Proposed boundaries requiring confirmation with plan approval: preserve existing approved Home composition 31; verify truthful avatar text/current capability 33 without adding uploads; preserve currently approved import 37 and recurrence 53 behavior without silently building a new statement/OCR parser or recurring engine. VAT 41, zakat 43, family/referrals 49 and investments 51 remain outside this remediation implementation unless the current canonical decision already approves a bounded existing capability. Weekly reporting remains T09; salary/rent ledger recurrence is not app-subscription billing and existing behavior is preserved. Resolve contradictory historical decisions from dated source before making product changes. iOS and receipt/image import receive explicit documented scope dispositions; this request's mandatory execution acceptance is Android, not a claim of full-platform qualification.

Client 50 is a historical external screenshot/archive privacy disposition: seek existing redaction/distribution evidence from its owner, assume no current incident, and delete no unrelated files. Preserve original wallet/default-account navigation, full occurredAt/timezone truth, Gulf-first preference-derived currencies and approved glossary; qualify them through T07/T13/T21.

## Decisions still required

1. Review and approve/revise this plan before any implementation dispatch.
2. The approved GPT-6.1 Sol High native delegate route passed its no-tools handshake; the installed CLI route is unavailable. Review this route adaptation with the plan, with no further model selection needed.
3. Name any missing approved disposable test identities/hosted candidate targets and needed external access. These are task prerequisites, not authorization to create/deploy infrastructure.
4. Complete the pending root-instructions filename/draft approval if the setup should be installed in this required worktree.

No implementation has started. The initial source and prior device evidence remain preserved.

