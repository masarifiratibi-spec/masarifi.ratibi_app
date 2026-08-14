# Tasks: Frontend Quality and Delivery

**Input**: Design documents from `/specs/010-frontend-quality/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/frontend-quality-contract.md`, `quickstart.md`

**Tests**: Required. For every RED task, run the exact focused command and record the expected failure before the paired implementation task. Mark an implementation task complete only after its focused test, `npm run typecheck`, and required boundary check pass.

**Organization**: Tasks are grouped by user story. Tasks intentionally name the owning file, the smallest behavior to add or audit, the verification command, and the expected result so a lower-cost model does not invent new architecture.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel only when prior dependencies are complete and no listed file overlaps.
- **[Story]**: Maps the task to one SPEC-010 user story.
- Paths are relative to `apps/mobile`.

---

## Phase 1: Setup (Shared Delivery Artifacts)

**Purpose**: Establish traceability and a safe evidence ledger before changing production code.

- [X] T001 Create `specs/010-frontend-quality/implementation-inventory.md` with one row for every contract under `src/services/contracts/`, naming the capability, current owner, mock/platform provider, storage owner, Query owner, allowed Zustand/local state, routes, unavailable outcome, and SPEC-010 FR references; verify every contract file returned by `rg --files src/services/contracts` appears once.
- [X] T002 [P] Create `specs/010-frontend-quality/validation.md` with empty validation-case and delivery-gate tables matching `data-model.md`, including date, environment/device, procedure, expected, actual, status, evidence, warnings, risks, and exception fields; verify all twelve gates from `contracts/frontend-quality-contract.md` are listed.
- [X] T003 [P] Add `specs/010-frontend-quality/evidence/.gitkeep` and extend `apps/mobile/.gitignore` only for unsafe/transient SPEC-010 captures such as raw logs and temporary dumps while retaining reviewed evidence; verify `git check-ignore -v` ignores the documented transient filename and does not ignore `.gitkeep`.
- [X] T004 Record the pre-change baseline in `specs/010-frontend-quality/validation.md` by running `npm run typecheck`, `npm run lint`, every existing `npm run check:*` script from `package.json`, and `npx jest --runInBand`; record exact exit codes, suite/test counts, warnings, and existing failures without fixing unrelated work.

**Checkpoint**: Traceability, evidence format, and baseline are available; no production behavior changed.

---

## Phase 2: Foundational (Blocking Cross-Feature Gates)

**Purpose**: Add the smallest shared contract metadata and aggregate boundary needed by every story.

**⚠️ CRITICAL**: Complete this phase before any user-story implementation.

- [X] T005 Write RED self-tests in `scripts/check-frontend-quality-boundaries.test.mjs` using isolated temporary roots that prove the checker must reject: direct `src/storage` imports from `app/` or `src/features/`, direct provider SDK imports outside `src/services/platform/`, server-shaped entity arrays in `src/state/`, production secret literals, sensitive console/log/analytics fields, raw brand colors or user strings in feature components, unsupported iOS SMS claims, and mutation calls lacking operation IDs; run `node scripts/check-frontend-quality-boundaries.test.mjs` and confirm failure because the checker is absent.
- [X] T006 Implement `scripts/check-frontend-quality-boundaries.mjs` to satisfy only the cases in T005, reuse existing boundary-script parsing patterns, accept an injectable root for self-tests, report file and rule for each violation, and avoid scanning test fixtures as production violations; run `node scripts/check-frontend-quality-boundaries.test.mjs` and expect all cases to pass.
- [X] T007 Add `check:frontend-quality` to `package.json` and make the checker invoke or verify all existing boundary scripts listed in `package.json` before its cross-feature rules; run `npm run check:frontend-quality` and expect exit 0 on the real workspace.
- [X] T008 Write RED tests in `src/services/contracts/capability-contract.test.ts` for positive major versions, compatible same-major providers, incompatible-major rejection before provider execution, additive output compatibility, and an explicit unavailable outcome; run `npx jest --runInBand src/services/contracts/capability-contract.test.ts` and confirm module-not-found or equivalent behavioral failure.
- [X] T009 Implement the minimal `CapabilityContractMetadata`, `CapabilityProviderMetadata`, and compatibility assertion in `src/services/contracts/capability-contract.ts`; do not add a registry, factory, network negotiation, or dependency; run the T008 test and expect all cases to pass.
- [X] T010 Add distinct capability name/major metadata for `AuthService`, `OnboardingService`, `TrackingPermissionService`, `BiometricService`, and `AppShellStorage` in the existing `src/services/contracts/app-shell-service.ts`; do not split the file; run `npm run typecheck` and `npm run check:frontend-quality` and expect exit 0.
- [X] T011 [P] Add capability name/major metadata to `src/services/contracts/core-finance-service.ts`, `automatic-tracking-service.ts`, and `voice-capture-service.ts`; run `npm run typecheck` and expect exit 0.
- [X] T012 [P] Add capability name/major metadata to `src/services/contracts/financial-planning-service.ts` and `reports-service.ts`; run `npm run typecheck` and expect exit 0.
- [X] T013 [P] Add distinct capability name/major metadata for `NotificationService`, `PhoneNotificationService`, `AssistantService`, `SubscriptionService`, `SettingsService`, and `SupportService` in the existing combined `src/services/contracts/assistant-notifications-service.ts`; do not create duplicate contract files; run `npm run typecheck` and expect exit 0.
- [X] T014 [P] Add distinct capability name/major metadata for `PlatformCapabilityService`, `FinancialSummaryService`, `FinancialChangeService`, `OfflineEntryRepository`, and `CapabilityCatalogService` in the existing `src/services/contracts/foundation-service.ts`, then cover any remaining contract interface named by T001 in its actual existing file; run `npm run typecheck` and expect exit 0.
- [X] T015 Create `src/services/contracts/capability-compatibility.test.ts` that imports every metadata constant added in T010–T014, proves names are unique, versions are positive, each capability has a deterministic mock or explicit platform provider, and each platform capability has an unavailable outcome; run the test, `npm run typecheck`, and `npm run check:frontend-quality` and expect all pass.

**Checkpoint**: Aggregate ownership rules and minimal contract-version proof block unsafe work; no generic framework exists.

---

## Phase 3: User Story 1 — Safely Replace Mocked Capabilities (Priority: P1) 🎯 MVP

**Goal**: Any representative provider can be replaced without changing the contract-defined UI, financial rules, or safe failure behavior.

**Independent Test**: Swap one deterministic provider per capability family with a conforming test provider; verify identical observable success/failure states and rejection of an incompatible provider before invocation.

### RED Tests for User Story 1

- [X] T016 [P] [US1] Add RED provider-compatibility tests for auth/app-shell/foundation in `src/services/contracts/auth-foundation-provider-compatibility.test.ts`, covering success, safe technical failure, and explicit unavailable behavior; run this file and confirm at least one test fails against current wiring.
- [X] T017 [P] [US1] Add RED provider-compatibility tests for core finance/tracking/voice in `src/services/contracts/capture-provider-compatibility.test.ts`, asserting the same validated inputs, outputs, error codes, and owner effects across two conforming providers; run this file and confirm failure before implementation.
- [X] T018 [P] [US1] Add RED provider-compatibility tests for planning/reports in `src/services/contracts/planning-reports-provider-compatibility.test.ts`, including versioned mutations and unavailable delivery; run this file and confirm failure before implementation.
- [X] T019 [P] [US1] Add RED provider-compatibility tests for assistant/notifications/subscriptions/support/settings in `src/services/contracts/assistant-settings-provider-compatibility.test.ts`, including safe provider-error mapping and no early success; run this file and confirm failure before implementation.

### Implementation for User Story 1

- [X] T020 [US1] Correct only the auth/app-shell/foundation contract or provider violations exposed by T016 in their existing files under `src/services/contracts/` and `src/services/mocks/`; do not add wrappers; run T016, `npm run typecheck`, and `npm run check:frontend-quality` and expect all pass.
- [X] T021 [US1] Correct only the core-finance/tracking/voice violations exposed by T017 in their existing `src/services/contracts/`, `src/services/mocks/`, or `src/services/platform/` owners; verify T017 plus the existing focused owner service tests pass.
- [X] T022 [US1] Correct only planning/reports violations exposed by T018 in existing owners; verify T018 plus `src/services/mocks/financial-planning-service.test.ts`, `reports-service.test.ts`, and `reports-schedule.test.ts` pass.
- [X] T023 [US1] Correct only violations exposed by T019 in `src/services/mocks/assistant-notifications-service.ts`, `src/services/mocks/subscription-settings-service.ts`, and `src/services/mocks/support-service.ts`; verify T019 plus `assistant-notifications-service.test.ts`, `subscription-settings-service.test.ts`, and `support-service.test.ts` pass.
- [X] T024 [US1] Add a presentation-level replacement test in `src/features/shell/ProviderReplacementJourney.test.tsx` using real domain values and two conforming providers; prove the same user-visible loading, success, unavailable, and actionable safe-error outcomes without asserting internal helper calls; run the file and expect pass.
- [X] T025 [US1] Update `specs/010-frontend-quality/implementation-inventory.md` with the verified provider paths and compatibility test for every capability, then run `rg "NEEDS|unknown|missing" specs/010-frontend-quality/implementation-inventory.md` and expect no unresolved ownership entry.
- [X] T026 [US1] Run all five US1 compatibility files, `npm run typecheck`, `npm run lint`, and `npm run check:frontend-quality`; record exact results in `validation.md` and mark US1 complete only if every capability row has a tested provider and unavailable outcome.

**Checkpoint**: User Story 1 is independently demonstrable and is the suggested MVP.

---

## Phase 4: User Story 2 — Complete Deterministic Scenarios (Priority: P1)

**Goal**: Reviewers can select, reset, and repeat every required state without production services or manual storage editing.

**Independent Test**: Reset each named disposable profile twice and compare validated initial records, relationships, routes, counts, and outcomes.

### RED Tests for User Story 2

- [X] T027 [US2] Add RED manifest coverage tests in `src/test-utils/frontend-quality-scenarios.test.ts` for every named profile required by section 5 of `contracts/frontend-quality-contract.md`, unique stable IDs, fixed clocks, declared density, and expected routes/states; run the file and confirm failure because the manifest is absent.
- [X] T028 [US2] Add RED relationship tests in `src/test-utils/frontend-quality-scenarios.test.ts` for account/transaction/category, budget/transaction, obligation/payment, report/source, notification/target, assistant/evidence, subscription/operation, and support/ticket references; run the file and confirm missing or invalid relationships fail clearly.
- [X] T029 [US2] Add RED reset tests in `src/test-utils/frontend-quality-scenario-reset.test.ts` proving normal profiles are refused, only fixture-owned disposable data is cleared, two reset-and-seed cycles are equivalent, and locale/theme/security/session outside fixture ownership are preserved; run and confirm failure before implementation.

### Implementation for User Story 2

- [X] T030 [US2] Implement `src/test-utils/frontend-quality-scenarios.ts` as a typed manifest that composes existing builders from `src/test-utils/` without copying their records; satisfy only T027 coverage first and run T027 plus `npm run typecheck`.
- [X] T031 [US2] Add or correct stable cross-domain fixture IDs only in `src/test-utils/core-finance-fixtures.ts`, `financial-planning-fixtures.ts`, `report-fixtures.ts`, and `assistant-notifications-fixtures.ts` when T028 identifies a broken reference; do not duplicate catalogs in the manifest; run T027–T028 and each directly changed fixture test.
- [X] T032 [US2] Implement disposable-profile reset/reseed orchestration in `src/test-utils/frontend-quality-scenario-reset.ts` by composing existing owner reset/seed seams, refusing non-disposable profiles before deletion; run T029 and `npm run typecheck`.
- [X] T033 [US2] Add localized scenario name/description keys to `src/localization/messages/en.ts` and `src/localization/messages/ar.ts`; extend `src/localization/assistant-notifications-messages.test.ts` or the closest aggregate parity test to cover them; run that localization test and expect pass.
- [X] T034 [US2] Add a development-only selector screen in `src/features/foundation/FrontendQualityScenarioScreen.tsx` using existing design-system controls and state feedback, with explicit disposable-profile warning, scenario selection, reset confirmation, loading/success/failure states, and no business rules; add its thin route at `app/foundation/scenarios.tsx`.
- [X] T035 [US2] Add `src/features/foundation/FrontendQualityScenarioScreen.test.tsx` proving the selector lists required profiles, refuses reset without disposable confirmation, preserves failure state, and shows expected seeded route links; run this file and expect pass.
- [X] T036 [US2] Extend `src/features/shell/ValidationRoutesRegression.test.tsx` to prove `/foundation/scenarios` is development-only and cannot enter the normal production navigation; run this file and expect pass.
- [X] T037 [US2] Run T027–T029 and T035–T036 tests, `npm run typecheck`, `npm run lint`, and `npm run check:frontend-quality`; record profile count, dense counts, and reset equivalence in `validation.md`.

**Checkpoint**: Every required mock state is selectable, valid, isolated, and repeatable.

---

## Phase 5: User Story 3 — Consistent Financial State (Priority: P1)

**Goal**: One authoritative truth survives concurrency, replay, restart, offline retry, and explicit conflict resolution across affected views.

**Independent Test**: For each mutation family, run concurrent same-operation calls, restart replay, failed retry, offline/reconnect, and conflict resolution; assert one owner effect and consistent projections.

### RED Tests for User Story 3

- [X] T038 [P] [US3] Add concurrent/restart replay cases to `src/storage/core-finance-persistence.test.ts` for manual create/update/delete/undo with the same operation ID; confirm RED if success is not durable or invokes twice.
- [X] T039 [P] [US3] Add concurrent/restart replay cases to `src/storage/financial-planning-persistence.test.ts` for obligation payment/reversal, savings movement, salary receipt, and budget movement; confirm RED for any duplicate owner effect.
- [X] T040 [P] [US3] Add concurrent/restart replay cases to `src/storage/reports-persistence.test.ts`, `src/storage/assistant-notifications-repository.test.ts`, `src/storage/subscriptions-repository.test.ts`, and `src/storage/support-repository.test.ts`; run each separately and record current failures.
- [X] T041 [P] [US3] Add voice/tracking integration replay cases to `src/features/voice/voice-group-save.test.ts` and `src/features/tracking/automatic-tracking-undo.test.ts`, including concurrent retries and eventual one notification/owner effect; run both and confirm any missing guard fails.
- [X] T042 [US3] Add RED preservation tests to `src/storage/core-finance-repository.test.ts` and `src/storage/financial-planning-repository.test.ts` proving conflicts retain complete local/later versions and financial-effect summaries, never auto-merge, remain unchanged on cancel/failure, and reject invalid `keep_both`; run and confirm current gaps.
- [X] T043 [US3] Add RED UI behavior tests to `src/features/transactions/SyncConflictScreen.test.tsx` and `src/features/financial-planning/PlanningStates.test.tsx` proving both versions/effects are announced, resolution is explicit, pending state survives offline failure, and raw errors are absent; run and confirm current gaps.

### Implementation for User Story 3

- [X] T044 [US3] Fix only core-finance operation replay defects exposed by T038 in `src/storage/core-finance-repository.ts` and `src/services/mocks/core-finance-service.ts`; claim in-flight work before awaiting, persist exact success, and clear failed claims; run T038 plus existing core-finance service tests.
- [X] T045 [US3] Fix only planning replay defects exposed by T039 in `src/storage/financial-planning-repository.ts` and `src/services/mocks/financial-planning-service.ts`; run T039 plus existing planning payment/budget/savings/salary tests.
- [X] T046 [P] [US3] Fix only report replay defects exposed by T040 in `src/storage/reports-repository.ts` and `src/services/mocks/reports-service.ts`; run the report persistence and service tests.
- [X] T047 [P] [US3] Fix only assistant/notification replay defects exposed by T040 in `src/storage/assistant-notifications-repository.ts` and `src/services/mocks/assistant-notifications-service.ts`; run their repository/service tests.
- [X] T048 [P] [US3] Fix only subscription/support replay defects exposed by T040 in `src/storage/subscriptions-repository.ts`, `src/storage/support-repository.ts`, `src/services/mocks/subscription-settings-service.ts`, and `src/services/mocks/support-service.ts`; run their repository/service tests.
- [X] T049 [US3] Fix only tracking/voice replay defects exposed by T041 in `src/services/mocks/automatic-tracking-service.ts` and `src/features/voice/useVoiceCapture.ts`; run T041 and existing owner service/hook tests.
- [X] T050 [US3] Extend existing `SyncConflict` and `PlanningConflict` domain schemas in `src/domain/core-finance.ts` and `src/domain/financial-planning.ts` with preserved validated candidates and safe effect summaries only if T042 proves fields are missing; run affected domain tests and `npm run typecheck`.
- [X] T051 [US3] Persist the conflict fields and explicit replay-safe resolution required by T042 in `src/storage/core-finance-repository.ts` and `src/storage/financial-planning-repository.ts`; do not add auto-merge/last-write-wins; run T042 and database reopen/rollback tests.
- [X] T052 [US3] Update `src/features/transactions/SyncConflictScreen.tsx` and the existing planning conflict surface to render both safe effects and allowed explicit choices using design-system components; run T043 and changed-file lint.
- [X] T053 [US3] Add `src/features/shell/CrossFeatureFinancialConsistency.test.tsx` that performs one representative automatic add, voice save, manual save, obligation payment, assistant-confirmed action, undo, offline retry, and conflict resolution through real owners; assert accounts/transactions/budgets/reports/obligations/notifications/assistant projections agree and immutable history stays unchanged.
- [X] T054 [US3] Run all US3 tests, `src/storage/database.test.ts`, `npm run typecheck`, `npm run lint`, and all affected boundary scripts; record exact replay/conflict scenarios in `validation.md`.

**Checkpoint**: Financial state is authoritative, replay-safe, conflict-preserving, and consistent.

---

## Phase 6: User Story 4 — Arabic, English, and Assistive Parity (Priority: P1)

**Goal**: Core journeys are fully operable in both directions at 200% text and with screen readers, reduced motion, and non-color cues.

**Independent Test**: Complete the representative route matrix in Arabic and English on a 320×568 viewport at 200% text, then traverse critical content with screen-reader semantics.

### RED Tests for User Story 4

- [X] T055 [US4] Add `src/localization/frontend-quality-localization.test.ts` that enumerates route/state/action/accessibility keys used by every feature directory, compares Arabic and English key sets, rejects key-as-output and hard-coded user strings in feature components, and verifies approved English numerals for money/date fixtures; run and confirm current violations fail.
- [X] T056 [US4] Add `src/features/accessibility/CoreJourneyAccessibility.test.tsx` with table-driven cases for sign-in, tracking permission, Home, transaction form/detail/conflict, voice review, obligation detail, reports, notifications, assistant preview, subscriptions, settings/privacy, and support; assert names/roles/states, persistent labels, field corrections, non-color status text, and hidden-value labels.
- [X] T057 [US4] Add `src/features/accessibility/LargeTextLayout.test.tsx` using existing viewport/text-scale seams to assert critical amounts, statuses, fields, and primary actions remain reachable at 320×568 and 200% text with long Arabic and keyboard-visible states.
- [X] T058 [US4] Extend `src/design-system/component-accessibility.test.tsx` for 44×44 targets, reduced-motion behavior, decorative subtree hiding, logical focus metadata, and chart summary/drill-down contracts; run and confirm current gaps.

### Implementation for User Story 4

- [X] T059 [US4] Fix only missing/mismatched/hard-coded strings reported by T055 in `src/localization/messages/en.ts`, `src/localization/messages/ar.ts`, and the exact offending feature components; run T055 until zero violations.
- [X] T060 [US4] Fix only screen-reader naming/state/error defects reported by T056 in the exact offending files under `src/features/` and `src/design-system/components/`, reusing `StyledText`, `SensitiveValue`, `StateView`, form primitives, and existing accessibility helpers; run `src/features/accessibility/CoreJourneyAccessibility.test.tsx` and each changed feature test.
- [X] T061 [US4] Fix only clipping/reachability/direction defects reported by T057 in the exact offending screens under `src/features/`, using logical layout and existing responsive primitives; do not add per-screen font-size branches; run `src/features/accessibility/LargeTextLayout.test.tsx` in Arabic and English.
- [X] T062 [US4] Fix only target/reduced-motion/non-color/chart defects reported by T058 in `src/design-system/components/`, `src/design-system/charts/`, and `src/design-system/motion.ts`; run `src/design-system/component-accessibility.test.tsx` plus all changed primitive/chart tests.
- [X] T063 [US4] Add `src/features/accessibility/PrivacyAccessibilityRegression.test.tsx` proving hidden balances, notification bodies, assistant evidence, conflict effects, and account identifiers are absent from accessible output while safe labels remain informative; run and expect pass.
- [X] T064 [US4] Execute the automated visual/access matrix in `quickstart.md` using existing validation routes, store reviewed safe artifacts under `specs/010-frontend-quality/evidence/visual/`, and record each Arabic/English/theme/size/text/state case in `validation.md`; do not mark TalkBack/VoiceOver or participant outcomes from component tests.
- [X] T065 [US4] Run `npx jest --runInBand src/localization/frontend-quality-localization.test.ts src/features/accessibility src/design-system/component-accessibility.test.tsx src/features/assistant-notifications/AssistantNotificationsAccessibility.test.tsx`, then `npm run typecheck`, `npm run lint`, `npm run check:design-system`, and `npm run check:frontend-quality`; record exact results in `specs/010-frontend-quality/validation.md`.

**Checkpoint**: Automated and visual parity is proven; native spoken usability remains a separate delivery gate.

---

## Phase 7: User Story 5 — Verifiable Delivery Gates (Priority: P2)

**Goal**: Every release requirement has reproducible evidence and cannot be closed from checkboxes alone.

**Independent Test**: Feed pass, fail, blocked, expired-exception, active-exception, and missing-evidence cases into the gate evaluator and verify closure decisions exactly match the contract.

### RED Tests for User Story 5

- [X] T066 [US5] Add RED schema tests in `src/domain/delivery-validation.test.ts` for `ValidationCase`, `DeliveryGate`, and `DeliveryException`, including required environment/procedure/result/evidence fields, blocked prerequisites, future expiry, and prohibition of exceptions for failed gates; run and confirm module-not-found.
- [X] T067 [US5] Add RED evaluator tests in `src/domain/delivery-validation.test.ts` proving all-pass → pass, any-fail → fail, block without exception → blocked, current approved exception → exceptional closure only, expired/revoked exception → blocked, and task `[X]` status has no effect; run and confirm failure.

### Implementation for User Story 5

- [X] T068 [US5] Implement strict schemas and `evaluateDeliveryGate` in `src/domain/delivery-validation.ts` with no persistence/UI framework; run T066–T067 and `npm run typecheck`.
- [X] T069 [US5] Add `scripts/record-frontend-quality-validation.mjs` that validates one JSON case against the delivery schema, rejects sensitive/unknown fields, and prints a Markdown row for manual insertion into `validation.md`; do not auto-edit evidence or mark gates passed.
- [X] T070 [US5] Add `scripts/record-frontend-quality-validation.test.mjs` covering pass/fail/blocked rows, missing fields, expired exception, path normalization, and forbidden sensitive keys; run and expect pass.
- [X] T071 [US5] Add `scripts/check-frontend-quality-gates.mjs` to parse the two tables in `validation.md`, reject duplicate/missing case IDs, derive gate statuses using the same contract rules represented by T067, and fail closure for failed/blocked gates without a current exception.
- [X] T072 [US5] Add `scripts/check-frontend-quality-gates.test.mjs` with temporary validation files for all closure outcomes; run and expect pass.
- [X] T073 [US5] Add `check:frontend-quality-gates` to `package.json`, run it against the intentionally incomplete ledger, and record the expected blocked/nonzero result without changing missing manual gates to pass.
- [X] T074 [US5] Add `specs/010-frontend-quality/requirements-trace.md` mapping FR-001–FR-060 and SC-001–SC-014 to exact automated/manual case IDs and evidence owners; verify with a small PowerShell count that all 74 identifiers appear exactly once as primary rows.
- [X] T075 [US5] Update `validation.md` with all completed automated cases from T004 and T026–T065, run `node scripts/check-frontend-quality-gates.mjs`, and verify the output names only genuinely incomplete native/participant/final gates.

**Checkpoint**: Delivery status is evidence-derived, reproducible, and honest about blocks.

---

## Phase 8: User Story 6 — Responsive and Honest Performance (Priority: P2)

**Goal**: Startup and dense histories meet measurable thresholds without optional work blocking primary tasks.

**Independent Test**: Warm once, measure 20 returning-shell runs and 1,000-record transaction/notification histories, and verify thresholds, bounded mounts, stable paging, and navigation readiness.

### RED Tests for User Story 6

- [X] T076 [P] [US6] Add `src/features/shell/FrontendQualityShellPerformance.test.tsx` measuring first useful shell content for 20 deterministic returning-user runs while report/assistant requests are delayed; assert at least 19 runs under 2 seconds and navigation/manual Add remains operable.
- [X] T077 [P] [US6] Extend `src/storage/core-finance-performance.test.ts` and `src/features/transactions/TransactionListScreen.test.tsx` with a 1,000-transaction stable-order/paging fixture, duplicate-free page traversal, under-2-second useful content, and fewer than 100 mounted transaction rows.
- [X] T078 [P] [US6] Extend `src/features/notifications/assistant-notifications-performance.test.tsx` with 1,000 notifications, stable duplicate-free paging during inserts, under-2-second useful content, and fewer than 100 mounted notification rows.
- [X] T079 [P] [US6] Extend the largest reports/chart performance test in `src/features/reports/reports-performance.test.ts` to prove optional chart/assistant derivations do not delay report summary or recompute when source inputs are unchanged.

### Implementation for User Story 6

- [X] T080 [US6] Fix only shell blocking or unrelated rerender defects exposed by T076 in `src/state/FoundationProviders.tsx`, `src/features/home/HomeScreen.tsx`, or their existing query boundaries; do not add a cache/store; run T076 and Home route tests.
- [X] T081 [P] [US6] Fix only transaction virtualization/order/paging defects exposed by T077 in `src/features/transactions/TransactionListScreen.tsx`, its query file, or owning repository; run T077 and core-finance boundary check.
- [X] T082 [P] [US6] Fix only notification virtualization/order/paging defects exposed by T078 in `src/features/notifications/NotificationCenterScreen.tsx`, `notification-queries.ts`, or owning repository; run T078 and assistant-notifications boundary check.
- [X] T083 [P] [US6] Fix only report memoization/non-blocking defects exposed by T079 in `src/features/reports/report-queries.ts`, `report-state.ts`, or `ReportsScreen.tsx`; run `src/features/reports/reports-performance.test.ts` and `npm run check:reports`.
- [X] T084 [US6] Warm once, execute the recorded performance commands on documented hardware/runtime, write exact fixture counts, all 20 shell timings, list timings, mounted-row maxima, paging result, and log-privacy result into `validation.md`; fail the gate if any threshold or privacy check fails.
- [X] T085 [US6] Run `npx jest --runInBand src/features/shell/FrontendQualityShellPerformance.test.tsx src/storage/core-finance-performance.test.ts src/features/transactions/TransactionListScreen.test.tsx src/features/notifications/assistant-notifications-performance.test.tsx src/features/reports/reports-performance.test.ts`, then `npm run typecheck`, `npm run lint`, `npm run check:core-finance`, `npm run check:reports`, and `npm run check:assistant-notifications`; record exact results in `validation.md` without substituting Jest total runtime for measured thresholds.

**Checkpoint**: User-visible performance and non-blocking navigation meet measurable targets.

---

## Phase 9: User Story 7 — Sensitive Data and Artifact Protection (Priority: P2)

**Goal**: Analytics, logs, errors, notifications, evidence, source, and release configuration contain no prohibited content or production secret.

**Independent Test**: Pass deterministic canary values through every output boundary and prove only immutable allowlisted categorical/timing metadata survives.

### RED Tests for User Story 7

- [X] T086 [US7] Create `src/analytics/frontend-quality-events.test.ts` importing every analytics module under `src/analytics/`, enumerating all event constructors, mutating original inputs/returned payloads, and rejecting amount/balance/account/transaction/message/transcript/question/answer/support/credential/raw-error keys; run and record current failures.
- [X] T087 [P] [US7] Add `src/features/privacy/OutputPrivacyRegression.test.tsx` with canary values through user-visible errors, notification masking, hidden values, assistant/support surfaces, and accessible labels; assert safe recovery remains while canaries are absent.
- [X] T088 [P] [US7] Add `scripts/check-frontend-quality-secrets.test.mjs` with temporary files proving a new scanner rejects production-like keys, service-role tokens, direct AI/payment/backend/provider calls, push-token requests outside approved scope, and sensitive console/log/evidence output while allowing documented fake fixtures.

### Implementation for User Story 7

- [X] T089 [US7] Add or correct analytics constructors in existing files under `src/analytics/` so each copies finite allowed fields into fresh frozen payload/envelope objects; do not add a generic analytics SDK; run T086 and all existing analytics tests.
- [X] T090 [US7] Fix only privacy leaks exposed by T087 in the exact offending files under `src/features/`, `src/design-system/privacy.ts`, `src/design-system/external-sensitive-display.ts`, and existing safe-error mappers; never mask raw content after logging; run `src/features/privacy/OutputPrivacyRegression.test.tsx` and each changed feature test.
- [X] T091 [US7] Implement `scripts/check-frontend-quality-secrets.mjs` using explicit allowlists and scoped patterns, with injectable roots and test/fixture exclusions proven by T088; run the self-test and expect pass.
- [X] T092 [US7] Integrate the secrets/privacy scanner into `scripts/check-frontend-quality-boundaries.mjs` and `npm run check:frontend-quality`; run both self-tests and the real workspace check.
- [X] T093 [US7] Inspect retained files under `specs/010-frontend-quality/evidence/` with the scanner, remove unsafe captures instead of redacting them in place, and record only safe categories/counts in `validation.md`.
- [X] T094 [US7] Run all analytics/privacy tests, `npm run typecheck`, `npm run lint`, `npm run check:frontend-quality`, and `git diff --check`; record exact results and zero-leak outcome in `validation.md`.

**Checkpoint**: All output boundaries are allowlist-first, immutable, and safe for delivery.

---

## Phase 10: User Story 8 — Complete Product Story (Priority: P3)

**Goal**: Demonstrate one coherent Android story and one honest iOS alternative story from sign-in through capture, downstream updates, notification, explanation, and correction.

**Independent Test**: Execute the automated product-story tests, then the native procedures on their actual platforms and retain safe evidence for every transition.

### Automated Preparation for User Story 8

- [X] T095 [US8] Add `src/features/shell/AndroidProductStory.test.tsx` that uses the disposable scenario profile to cover sign-in, tracking education/choice, clear capture, uncertain review, account/transaction/budget/report/obligation updates, in-app notification, assistant explanation, and correction/undo; assert one effect and no raw SMS content.
- [X] T096 [US8] Add `src/features/shell/IosAlternativeProductStory.test.tsx` that forces iOS capability state, proves no SMS promise/permission action, completes manual and voice capture alternatives, and verifies the same downstream financial/notification/assistant/correction outcomes.
- [X] T097 [US8] Add `src/features/shell/ProductStoryRecovery.test.tsx` for permission denial/settings recovery, foreground/background/cold notification response controller seams, expired/deleted/changed targets, unlock before revalidation, offline retry, and duplicate response; run all three product-story files.
- [X] T098 [US8] Fix only cross-feature integration defects exposed by T095–T097 in the exact failing owner files under `src/services/mocks/`, query files under `src/features/`, or navigation files under `src/features/shell/`; do not copy business logic into tests or screens; run the three product-story files, `npm run typecheck`, and affected boundary scripts.

### Native and Human Evidence for User Story 8

- [ ] T099 [US8] Build/install the Android development build on the documented device and execute quickstart section 10 through Arabic/English sign-in, tracking grant/deny/recovery, clear/uncertain capture, downstream views, and in-app/phone notification; store reviewed safe screenshots/XML in `specs/010-frontend-quality/evidence/android/` and record each case in `validation.md`.
- [ ] T100 [US8] On the same Android build, execute foreground/background/cold View/Edit/Undo, duplicate response, expired/changed/deleted target, locked action, offline retry, conflict preservation, light/dark, small/large display, 200% text, hidden values, and TalkBack; restore device settings afterward, store reviewed artifacts under `specs/010-frontend-quality/evidence/android/`, and record pass/fail separately in `validation.md`.
- [ ] T101 [US8] On macOS/Xcode, execute quickstart section 11 for Arabic/English sign-in, zero SMS claims, manual/voice alternatives, downstream updates, notification, correction, offline recovery, light/dark, 200% text, hidden values, and VoiceOver; store safe artifacts under `specs/010-frontend-quality/evidence/ios/`; if unavailable, record BLOCKED in `validation.md` and do not mark this task complete.
- [ ] T102 [US8] Conduct the quickstart section 12 study with at least 12 participants—six Arabic, six English, at least four regular screen-reader users with both languages represented—then record anonymous aggregate completion and 1–5 ratings in `validation.md`; if the sample is incomplete, record BLOCKED and do not infer percentages or mark complete.
- [ ] T103 [US8] Reconcile Android/iOS/native/human evidence against SC-006, SC-013, and SC-014 in `requirements-trace.md`; every percentage must cite the participant numerator/denominator and every native claim must cite an artifact or blocked prerequisite.

**Checkpoint**: The complete product story is proven on actual available platforms; unavailable required evidence remains blocked honestly.

---

## Phase 11: Polish and Release Closure

**Purpose**: Re-run all gates after final fixes and decide closure from evidence, not task markers.

- [X] T104 Run `node scripts/check-frontend-quality-boundaries.test.mjs`, every existing boundary self-test, every `npm run check:*`, `npm run typecheck`, and `npm run lint`; record exact exit codes and scanned-file counts in `validation.md`.
- [X] T105 Run `npx jest --runInBand`; record exact suites/tests/snapshots/time/warnings/open handles in `specs/010-frontend-quality/validation.md`, and fix only SPEC-010 regressions in their exact reported owner files before rerunning to green.
- [X] T106 Re-run the SQLite migration/reopen/rollback/uniqueness suites and all operation replay/conflict suites from US3 after the full regression; record exact passing counts in `validation.md`.
- [X] T107 Re-run the exact focused commands recorded by T065, T085, and T094 after the last code change; append final rows to `specs/010-frontend-quality/validation.md` without overwriting prior failed evidence.
- [X] T108 Review `specs/010-frontend-quality/requirements-trace.md` against FR-001–FR-060 and SC-001–SC-014, add exact final case/evidence references, and mark unmet requirements as failed or blocked rather than complete.
- [X] T109 Run `npm run check:frontend-quality-gates`; if any required gate fails, stop closure and name the failed case; if any gate blocks, stop unless a valid product-owner exception exists with risk, owner, expiry, and follow-up evidence in `validation.md`.
- [X] T110 Validate any product-owner exception in `validation.md` with `scripts/check-frontend-quality-gates.mjs`; reject missing approver/risk/owner/expiry/evidence, expired exceptions, and every exception attempting to override a failed gate.
- [X] T111 Record the changed production/test file lists in `specs/010-frontend-quality/validation.md`, review those exact files for dead abstractions, duplicated fixtures, swallowed errors, implementation-detail assertions, and unjustified mocks, apply corrections in the owning files, then rerun every focused command associated with a corrected file.
- [X] T112 Run `git diff --check`, inspect `git status --short`, verify no unrelated file was staged/modified by SPEC-010 work, and record the exact remaining dirty-file scope in `validation.md` without deleting pre-existing user changes.
- [X] T113 Mark tasks `[X]` in `specs/010-frontend-quality/tasks.md` only when their commands/evidence genuinely pass, leave blocked native/participant tasks unchecked, and write the final closure verdict plus exact next task in `validation.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on T001–T004 and blocks every user story.
- **US1 (Phase 3)**: Depends on T005–T015; establishes provider compatibility and is the MVP.
- **US2 (Phase 4)**: Depends on Foundation; may run independently of US1 after T015.
- **US3 (Phase 5)**: Depends on Foundation and uses scenario fixtures from US2 for T053; T038–T052 may start before US2 completes, but T053–T054 require T037.
- **US4 (Phase 6)**: Depends on Foundation; may run beside US2/US3 if files do not overlap.
- **US5 (Phase 7)**: Depends on T002 and Foundation; T075 requires completed evidence from US1–US4.
- **US6 (Phase 8)**: Depends on US2 dense fixtures; T084–T085 require T037.
- **US7 (Phase 9)**: Depends on Foundation; may run beside US3/US4/US6 if analytics/boundary files are coordinated.
- **US8 (Phase 10)**: Automated work requires US1–US7; native and participant tasks require their external environments/sample.
- **Closure (Phase 11)**: Depends on every desired story and all available evidence; failed or unexcepted blocked gates prohibit closure.

### User Story Independence

- **US1**: Independently proves replaceable contracts/providers without scenario UI.
- **US2**: Independently proves deterministic resettable scenario data without changing production providers.
- **US3**: Independently proves one financial truth through owners/repositories; its final cross-feature test uses US2 fixtures.
- **US4**: Independently proves language/accessibility behavior using current deterministic fixtures.
- **US5**: Independently evaluates supplied validation cases; the final ledger naturally accumulates other-story evidence.
- **US6**: Independently measures existing shell/lists after US2 supplies stable dense data.
- **US7**: Independently protects output boundaries and artifacts.
- **US8**: Integrates all stories and is intentionally last.

### Within Each Story

1. Write the named RED test and run it to observe the expected failure.
2. Change only the named owner files; do not broaden scope to unrelated refactors.
3. Run the focused test until GREEN.
4. Run `npm run typecheck` and the affected boundary check.
5. Record evidence before marking the task complete.

---

## Parallel Opportunities

- T002 and T003 may run together after T001 begins because they use different files.
- T010–T014 may run in parallel after T009, one contract family per worker.
- T016–T019 may run in parallel; T020–T023 then proceed against their matching family.
- T038–T041 may run in parallel; T046–T048 may run in parallel after T040.
- T055–T058 may run in parallel because they create different test files.
- T076–T079 may run in parallel after dense scenarios exist.
- T086–T088 may run in parallel; implementations T089–T091 then follow their matching tests.
- Native Android T099–T100 and participant preparation for T102 may proceed while macOS/iOS T101 is arranged, but do not edit files under active code review.

## Parallel Example: User Story 1

```text
Worker A: T016 then T020 — auth/app-shell/foundation provider compatibility
Worker B: T017 then T021 — finance/tracking/voice provider compatibility
Worker C: T018 then T022 — planning/reports provider compatibility
Worker D: T019 then T023 — assistant/settings/support provider compatibility
Integrator: T024–T026 after all four families are green
```

## Parallel Example: User Story 3

```text
Worker A: T038 then T044 — core-finance replay
Worker B: T039 then T045 — planning replay
Worker C: report slice of T040 then T046
Worker D: assistant/subscription/support slices of T040 then T047–T048
Integrator: T050–T054 after owner slices and US2 fixtures are green
```

## Implementation Strategy

### MVP First (US1)

1. Complete T001–T015.
2. Complete T016–T026.
3. Stop and validate provider replacement independently.
4. Do not begin a generic architecture refactor; only proceed to quality stories required for release.

### Incremental Delivery

1. Setup + Foundation → enforceable ownership baseline.
2. US1 → replaceable provider proof.
3. US2 → deterministic full scenario catalog.
4. US3 → durable replay/conflict consistency.
5. US4 → automated/visual language and access parity.
6. US5 → evidence-derived gates.
7. US6 + US7 → measurable performance and privacy.
8. US8 → native/human product story.
9. Closure → all available gates rerun and exact blockers retained.

## Notes

- Do not add dependencies unless a task explicitly requires one; none are currently planned.
- Do not add schema v8 unless a RED persistence requirement proves v7 cannot hold owner data and the plan is amended.
- Do not mark RED test tasks complete unless the intended failure was observed before implementation.
- Do not mark native or participant tasks complete from Jest, XML structure alone, or inferred percentages.
- Preserve the user's dirty worktree and never reset or delete unrelated changes.
- Keep production fixture selection/reset inaccessible from normal user navigation.
