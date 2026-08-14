# Tasks: Salary, Budgets, Obligations, Debts, Installments, and Savings

**Input**: Design documents from `specs/007-financial-planning/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/financial-planning-contract.md`, `quickstart.md`

**Tests**: Required because this feature contains money calculations, lifecycle transitions, atomic ledger writes, offline recovery, and accessibility requirements. Use the repository's existing Jest and React Native Testing Library setup; do not add Vitest, Playwright, MSW, or another test framework.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. US6 is completed before the P2 savings story because its shared recovery primitives must also be reused by US5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it touches separate files and has no incomplete dependency
- **[US#]**: Maps the task to the corresponding user story in `spec.md`
- Every task includes the exact file path(s) it affects

## Phase 1: Existing Mobile Project and Contract Review

**Purpose**: Confirm reuse points before writing code; this is an existing Expo application, so no project initialization is needed.

- [X] T001 Trace current money, transaction, category, and ledger write paths in `src/domain/core-finance.ts`, `src/services/contracts/core-finance-service.ts`, and `src/storage/core-finance-repository.ts`; record any contract mismatch as a comment in `specs/007-financial-planning/tasks.md`
- [X] T002 [P] Trace salary, obligation, and payment candidates emitted by `src/features/tracking/useAutomaticTracking.ts`, `src/features/voice/voice-review-helpers.ts`, and `src/features/voice/VoiceReviewScreen.tsx`; record reusable handoff points in `specs/007-financial-planning/tasks.md`
- [X] T003 [P] Audit reusable financial UI, masking, localization, accessibility, and test helpers in `src/components/financial/`, `src/localization/en.ts`, `src/localization/ar.ts`, and `src/test-utils/`; record only confirmed gaps in `specs/007-financial-planning/tasks.md`

<!-- SPEC-007 trace notes:
T001: Reuse Core Finance `MoneyValue`, `TransactionInput`, sync/conflict states, `MutationResult`, idempotent operation IDs, and `CoreFinanceRepository.saveTransaction`; add only a narrow transactional seam for planning-owned payment commits.
T002: Tracking already invalidates home/transaction scopes and can pass confirmed transaction IDs; voice obligation handoff is currently represented by `proposal.obligationId` and confirmed recurring suggestions. Referenced `voice-review-helpers.ts`/`VoiceReviewScreen.tsx` paths do not exist; real files are under `src/features/voice/VoiceReview*.tsx`.
T003: Reusable financial UI lives in `src/design-system/components/financial/`, localization in `src/localization/messages/{en,ar}.ts`, and render helpers in `src/test-utils/render.tsx`; referenced `src/components/financial/` and `src/localization/{en,ar}.ts` paths do not exist.
-->

---

## Phase 2: Foundational Planning Domain and Persistence

**Purpose**: Establish the shared local-first model, schema, repository, service, query scope, and boundary checks required by every story.

**Critical**: No user-story implementation starts until this phase passes.

- [X] T004 [P] Add failing tests for local-date handling, integer-minor-unit amounts, currency completeness, normalized planning errors, and lifecycle guards in `src/domain/financial-planning.test.ts`
- [X] T005 [P] Add failing schema-v5 migration and persistence tests for salary profiles/receipts, budgets, obligations, payments/allocations, savings goals/movements, drafts, and conflict metadata in `src/storage/financial-planning-repository.test.ts`
- [X] T006 [P] Add failing contract tests for deterministic mock-service success, empty, partial, stale, offline, and failure outcomes in `src/services/mocks/financial-planning-service.test.ts`
- [X] T007 Implement the smallest shared planning types, record parsers, local-date helpers, lifecycle guards, and normalized error/result types needed by T004 in `src/domain/financial-planning.ts`
- [X] T008 Upgrade SQLite schema version 4 to 5 with additive tables, indexes, foreign keys, and idempotency constraints from `data-model.md` in `src/storage/database.ts`
- [X] T009 Add the narrow transaction-aware ledger write seam required for atomic planning plus Core Finance writes, with rollback coverage, in `src/storage/core-finance-repository.ts` and `src/storage/core-finance-repository.test.ts`
- [X] T010 Implement schema-v5 persistence, optimistic concurrency checks, durable drafts, and scoped reads in `src/storage/financial-planning-repository.ts` until T005 passes
- [X] T011 Define the repository-backed planning service contract and transaction-aware mutation inputs from the approved contract in `src/services/contracts/financial-planning-service.ts`
- [X] T012 [P] Add deterministic USD, SAR, EUR, and missing-FX fixtures shared by tests and the mock service in `src/test-utils/financial-planning-fixtures.ts` and `src/services/mocks/financial-planning-fixtures.ts`
- [X] T013 Implement the contract-compatible deterministic planning mock service without adding network mocking dependencies in `src/services/mocks/financial-planning-service.ts` until T006 passes
- [X] T014 Add feature-scoped query keys, query/mutation factories, and invalidation rules in `src/features/financial-planning/financial-planning-queries.ts`
- [X] T015 Keep only ephemeral selection/filter state in `src/state/financial-planning-view-state.ts`; persist every recoverable draft and conflict through `src/storage/financial-planning-repository.ts`
- [X] T016 Add import/privacy boundary checks in `scripts/check-financial-planning-boundaries.mjs` and expose them as `check:financial-planning` in `package.json`

**Checkpoint**: Schema-v5 migration, rollback, scoped-query, mock-state, and boundary tests pass.

---

## Phase 3: User Story 1 — Understand the Current Salary Cycle (Priority: P1) 🎯 MVP

**Goal**: Let a user configure a salary profile, confirm receipts, understand the current cycle, correct mistakes, and see honest projections/comparisons.

**Independent Test**: Configure a profile, record normal and unusual receipts, verify cycle boundaries and correction/undo behavior, then confirm comparison and projection states when prior data or FX rates are missing.

### Tests for User Story 1

- [X] T017 [P] [US1] Add failing salary-cycle tests for confirmed primary receipts, early/late/overdue states, unusual receipts, projections, prior-cycle comparison, missing history, and missing FX in `src/domain/financial-planning-salary.test.ts`
- [X] T018 [P] [US1] Add failing repository/service tests for idempotent receipt confirmation, transaction linkage, correction, relink, and undo in `src/storage/financial-planning-salary.test.ts`
- [X] T019 [P] [US1] Add failing Arabic/English RNTL journey tests for salary setup, overview, receipt review, loading/empty/error states, masking, and large text in `src/features/salary/SalaryJourney.test.tsx`

### Implementation for User Story 1

- [X] T020 [US1] Implement salary-cycle calculation, receipt classification, projection completeness, and comparison rules in `src/domain/financial-planning.ts` until T017 passes
- [X] T021 [US1] Implement salary profile/receipt list, confirm, correct, relink, and undo operations in `src/storage/financial-planning-repository.ts` and `src/services/mocks/financial-planning-service.ts` until T018 passes
- [X] T022 [US1] Add salary query and mutation hooks with salary-only invalidation in `src/features/salary/salary-queries.ts`
- [X] T023 [P] [US1] Build the overview and honest incomplete-data states in `src/features/salary/SalaryOverviewScreen.tsx`
- [X] T024 [P] [US1] Build profile setup/edit and receipt review with durable drafts in `src/features/salary/SalaryProfileForm.tsx` and `src/features/salary/SalaryReceiptReview.tsx`
- [X] T025 [US1] Register secondary salary routes without changing the primary tab set in `app/salary/index.tsx`, `app/salary/profile.tsx`, and `app/salary/receipt/[receiptId].tsx`
- [X] T026 [US1] Wire confirmed tracking candidates plus Home/More/profile-completion entry points and localized strings in `src/features/tracking/useAutomaticTracking.ts`, `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, `src/features/onboarding/profile-completion.ts`, `src/localization/en.ts`, and `src/localization/ar.ts`

**Checkpoint**: US1 passes independently and is the recommended MVP stopping point.

---

## Phase 4: User Story 2 — Set and Monitor Budgets (Priority: P1)

**Goal**: Let a user create one-currency monthly/category budgets, copy and edit them, monitor eligible spend and forecasts, move allocations, inspect transactions, and preserve frozen rollover.

**Independent Test**: Create, copy, edit, pause, exceed, move, and delete a budget; verify refund/reversal/transfer handling, threshold states, frozen rollover, drill-down, and incomplete FX results.

### Tests for User Story 2

- [X] T027 [P] [US2] Add failing budget-calculation tests for eligible spend, refunds, reversals, transfers, thresholds, forecast, frozen positive rollover, allocation moves, zero values, and missing FX in `src/domain/financial-planning-budget.test.ts`
- [X] T028 [P] [US2] Add failing repository/service tests for create, copy, edit, pause, delete, immutable-currency, lifecycle, and version conflicts in `src/storage/financial-planning-budget.test.ts`
- [X] T029 [P] [US2] Add failing Arabic/English RNTL journey tests for overview, form, allocation move, related-transaction drill-down, masking, and incomplete states in `src/features/budgets/BudgetJourney.test.tsx`

### Implementation for User Story 2

- [X] T030 [US2] Implement budget eligibility, progress, threshold, forecast, rollover snapshot, and balanced allocation-move rules in `src/domain/financial-planning.ts` until T027 passes
- [X] T031 [US2] Implement budget/category lifecycle, copy, delete, transaction-summary, and compare-and-swap operations in `src/storage/financial-planning-repository.ts` and `src/services/mocks/financial-planning-service.ts` until T028 passes
- [X] T032 [US2] Add budget query/mutation hooks and budgets-only invalidation in `src/features/budgets/budget-queries.ts`
- [X] T033 [P] [US2] Build budget overview, progress/forecast presentation, zero/incomplete states, and transaction drill-down in `src/features/budgets/BudgetOverviewScreen.tsx` and `src/features/budgets/BudgetTransactionsScreen.tsx`
- [X] T034 [P] [US2] Build create/copy/edit/pause/delete forms plus balanced category-allocation movement in `src/features/budgets/BudgetForm.tsx` and `src/features/budgets/BudgetAllocationEditor.tsx`
- [X] T035 [US2] Register secondary budget routes and Home/More/profile-completion entry points in `app/budgets/index.tsx`, `app/budgets/edit/[budgetId].tsx`, `app/budgets/transactions/[budgetId].tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, and `src/features/onboarding/profile-completion.ts`
- [X] T036 [US2] Add complete, concise English and Arabic budget labels, errors, thresholds, and accessibility text in `src/localization/en.ts` and `src/localization/ar.ts` until T029 passes

**Checkpoint**: US1 and US2 both remain independently usable.

---

## Phase 5: User Story 3 — Manage All Commitments in One Place (Priority: P1)

**Goal**: Manage fixed installments, open-ended debts, irregular obligations, payables, and receivables without inventing totals or schedules.

**Independent Test**: Create each commitment type and direction, verify overview/detail/history, then edit, pause, resume, settle, write off, and close records while open-ended balances remain explicit.

### Tests for User Story 3

- [X] T037 [P] [US3] Add failing domain tests for fixed/open-ended/irregular records, payable/receivable direction, schedule validation, derived statuses, lifecycle transitions, and unknown totals in `src/domain/financial-planning-obligation.test.ts`
- [X] T038 [P] [US3] Add failing repository/service tests for create/edit/list/detail/history, pause/resume, settle/write-off/close, and stale-version conflicts in `src/storage/financial-planning-obligation.test.ts`
- [X] T039 [P] [US3] Add failing Arabic/English RNTL journey tests for obligation overview, type-specific form, detail/history, masking, large text, and empty/incomplete states in `src/features/obligations/ObligationJourney.test.tsx`

### Implementation for User Story 3

- [X] T040 [US3] Implement commitment validation, derived status, expected-schedule rules, lifecycle transitions, and explicit unknown-total handling in `src/domain/financial-planning.ts` until T037 passes
- [X] T041 [US3] Implement obligation lifecycle, occurrence, and history operations in `src/storage/financial-planning-repository.ts` and `src/services/mocks/financial-planning-service.ts` until T038 passes
- [X] T042 [US3] Add obligation query/mutation hooks with obligation-only invalidation in `src/features/obligations/obligation-queries.ts`
- [X] T043 [P] [US3] Build combined payable/receivable overview with fixed, open-ended, and irregular grouping in `src/features/obligations/ObligationOverviewScreen.tsx`
- [X] T044 [P] [US3] Build type-specific create/edit form and detail/history/schedule presentation in `src/features/obligations/ObligationForm.tsx` and `src/features/obligations/ObligationDetailScreen.tsx`
- [X] T045 [US3] Register secondary routes plus confirmed voice and Home/More/profile-completion handoffs in `app/obligations/index.tsx`, `app/obligations/new.tsx`, `app/obligations/[obligationId].tsx`, `src/features/voice/VoiceReviewScreen.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, and `src/features/onboarding/profile-completion.ts`
- [X] T046 [US3] Add English and Arabic obligation labels, lifecycle/status explanations, errors, and accessibility text in `src/localization/en.ts` and `src/localization/ar.ts` until T039 passes

**Checkpoint**: US3 can be demonstrated without salary, budget, payment, or savings UI.

---

## Phase 6: User Story 4 — Record and Match Payments Safely (Priority: P1)

**Goal**: Preview and atomically confirm manual or detected full, partial, over, early, and settlement payments; match only unambiguous transactions; and safely undo.

**Independent Test**: Exercise all payment cases, zero/one/multiple/duplicate match candidates, settlement confirmation, injected write failure, retry, and undo; verify exactly one ledger transaction and one payment record per confirmation.

### Tests for User Story 4

- [X] T047 [P] [US4] Add failing allocation tests for earliest-unpaid-first application, final due reduction, overpayment, early payment, partial payment, and settlement validation in `src/domain/financial-planning-payment.test.ts`
- [X] T048 [P] [US4] Add failing integration tests for one transaction plus one payment record, allocation balance, idempotency, rollback on injected failure, retry, and undo in `src/storage/financial-planning-payment.test.ts`
- [X] T049 [P] [US4] Add failing matching tests for zero, one, multiple, and duplicate transaction candidates plus explicit user confirmation in `src/services/mocks/financial-planning-payment.test.ts`
- [X] T050 [P] [US4] Add failing Arabic/English RNTL journey tests for preview, review, settlement, match ambiguity, failure recovery, undo, masking, and large text in `src/features/obligations/PaymentJourney.test.tsx`

### Implementation for User Story 4

- [X] T051 [US4] Implement deterministic allocation, overpayment, settlement, and undo calculations in `src/domain/financial-planning.ts` until T047 passes
- [X] T052 [US4] Implement the single SQLite transaction coordinator for ledger transaction, payment record, allocations, obligation update, and idempotency completion in `src/storage/core-finance-repository.ts` and `src/storage/financial-planning-repository.ts` until T048 passes
- [X] T053 [US4] Implement preview, confirm, reverse, and settlement service operations in `src/services/mocks/financial-planning-service.ts`
- [X] T054 [US4] Implement conservative payment-match candidate scoring and explicit confirm/reject operations without automatic ambiguous matches in `src/services/mocks/financial-planning-service.ts` until T049 passes
- [X] T055 [US4] Add payment/match query and mutation hooks with coordinated Core Finance and obligation invalidation in `src/features/obligations/payment-queries.ts`
- [X] T056 [P] [US4] Build payment preview/confirm/settlement and undo feedback in `src/features/obligations/ObligationPaymentScreen.tsx`
- [X] T057 [P] [US4] Build ambiguous transaction-match review and failure recovery in `src/features/obligations/PaymentMatchReviewScreen.tsx`
- [X] T058 [US4] Register payment/match routes, connect tracking/voice candidates only after confirmation, and add localized feedback in `app/obligations/[obligationId]/payment.tsx`, `app/obligations/[obligationId]/match.tsx`, `src/features/tracking/useAutomaticTracking.ts`, `src/features/voice/VoiceReviewScreen.tsx`, `src/localization/en.ts`, and `src/localization/ar.ts` until T050 passes

**Checkpoint**: US4 proves atomicity and idempotency under failure, not only the happy path.

---

## Phase 7: User Story 6 — Keep Planning Usable During Problems (Priority: P1)

**Goal**: Provide honest loading/empty/partial/stale/error/offline states, durable drafts, conflict recovery, privacy masking, accessibility, and Arabic/English resilience across planning flows.

**Independent Test**: Run salary, budget, obligation, and payment screens through all required states in Arabic and English with large text and hidden values; verify pending mutations, failed retries, durable draft recovery, and explicit conflict resolution.

### Tests for User Story 6

- [X] T059 [P] [US6] Add failing repository/service tests for durable draft restore/discard, pending operation retry, offline failure, stale reads, and compare-and-swap conflicts in `src/storage/financial-planning-recovery.test.ts`
- [X] T060 [P] [US6] Add failing RNTL tests for loading, empty, partial, stale, error, offline, pending, failed, conflict, masking, Arabic RTL, and large-text behavior in `src/features/financial-planning/PlanningStates.test.tsx`
- [X] T061 [P] [US6] Add failing component tests for financial cards rendering zero values, explicit incomplete data, currency labels, hidden values, and accessible status text in `src/components/financial/FinancialPlanningCards.test.tsx`

### Implementation for User Story 6

- [X] T062 [US6] Implement reusable draft restore/discard, query-state mapping, and retry helpers in `src/features/financial-planning/usePlanningDraft.ts` and `src/features/financial-planning/planning-state.ts` until T059 passes
- [X] T063 [US6] Implement explicit keep-local/accept-stored conflict resolution and route it as a secondary modal in `src/features/financial-planning/PlanningConflictScreen.tsx` and `app/modal/planning-conflict.tsx`
- [X] T064 [US6] Harden existing financial cards for zero, incomplete, currency, masking, RTL, and large text without introducing a new component layer in `src/components/financial/FinancialSummaryCard.tsx` and `src/components/financial/FinancialStatusCard.tsx` until T061 passes
- [X] T065 [US6] Apply the shared state, retry, draft, masking, and conflict primitives to `src/features/salary/`, `src/features/budgets/`, and `src/features/obligations/` until T060 passes
- [X] T066 [US6] Add a runnable boundary regression test that rejects raw imports, sensitive logs/analytics, and full-ledger reads in `scripts/check-financial-planning-boundaries.test.mjs`
- [X] T067 [US6] Add parity-checked English/Arabic recovery, privacy, accessibility, and conflict strings in `src/localization/en.ts` and `src/localization/ar.ts`

**Checkpoint**: All P1 stories pass in required degraded states before P2 savings work begins.

---

## Phase 8: User Story 5 — Track Savings Goals Without Changing Account Balances (Priority: P2)

**Goal**: Track regular and emergency goals plus add/withdraw movements without mutating accounts or inventing ledger transactions.

**Independent Test**: Create regular and emergency goals, add and withdraw progress with and without existing transaction links, pass the target, pause/resume/complete/archive, and prove account balances and ledger transaction counts do not change.

### Tests for User Story 5

- [X] T068 [P] [US5] Add failing goal tests for target/progress validation, add/withdraw movements, target crossing, regular/emergency behavior, lifecycle transitions, and missing FX in `src/domain/financial-planning-savings.test.ts`
- [X] T069 [P] [US5] Add failing repository/service tests proving movements are tracking-only, optional links target existing transactions, and account balances/transaction counts remain unchanged in `src/storage/financial-planning-savings.test.ts`
- [X] T070 [P] [US5] Add failing Arabic/English RNTL journey tests for goal list, form, detail, movement, lifecycle, masking, recovery states, and large text in `src/features/savings/SavingsJourney.test.tsx`

### Implementation for User Story 5

- [X] T071 [US5] Implement savings validation, progress, movement, target-crossing, lifecycle, and completeness calculations in `src/domain/financial-planning.ts` until T068 passes
- [X] T072 [US5] Implement goal/movement lifecycle and optional existing-transaction links without ledger writes in `src/storage/financial-planning-repository.ts` and `src/services/mocks/financial-planning-service.ts` until T069 passes
- [X] T073 [US5] Add savings query/mutation hooks with savings-only invalidation in `src/features/savings/savings-queries.ts`
- [X] T074 [P] [US5] Build goal list/detail and honest progress/incomplete states in `src/features/savings/SavingsGoalsScreen.tsx` and `src/features/savings/SavingsGoalDetailScreen.tsx`
- [X] T075 [P] [US5] Build regular/emergency goal form and add/withdraw movement flow using shared durable drafts in `src/features/savings/SavingsGoalForm.tsx` and `src/features/savings/SavingsMovementForm.tsx`
- [X] T076 [US5] Register secondary savings routes and Home/More/profile-completion entry points in `app/savings/index.tsx`, `app/savings/new.tsx`, `app/savings/[goalId].tsx`, `app/savings/[goalId]/movement.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, and `src/features/onboarding/profile-completion.ts`
- [X] T077 [US5] Add English/Arabic savings, lifecycle, tracking-only, recovery, and accessibility strings in `src/localization/en.ts` and `src/localization/ar.ts` until T070 passes

**Checkpoint**: US5 passes independently and reuses US6 recovery primitives.

---

## Phase 9: Polish and Cross-Cutting Verification

**Purpose**: Verify the complete feature without adding speculative abstractions or dependencies.

- [X] T078 [P] Add deterministic large-data performance coverage for 24 salary cycles, 50 budgets, 100 obligations, 1,000 payments, and 50 goals in `src/features/financial-planning/financial-planning-performance.test.ts`
- [X] T079 [P] Add a route smoke test proving all planning screens remain secondary and the primary tab set is unchanged in `src/features/financial-planning/FinancialPlanningRoutes.test.tsx`
- [X] T080 [P] Add localization-key parity and planning accessibility regression coverage in `src/localization/financial-planning-localization.test.ts` and `src/features/financial-planning/FinancialPlanningAccessibility.test.tsx`
- [X] T081 Run `npm run typecheck`, `npm run lint`, `npm run check:financial-planning`, and targeted planning Jest suites; record command output, failures, and fixes in `specs/007-financial-planning/validation-results.md`
- [ ] T082 Execute the Android native quickstart scenarios, including airplane-mode draft recovery, injected atomic-write failure, masking, Arabic RTL, and large text; record evidence in `specs/007-financial-planning/validation-results.md`
- [X] T083 Execute the iOS native quickstart scenarios or record the exact environment blocker and the next executable validation step in `specs/007-financial-planning/validation-results.md`
- [ ] T084 Run the complete `specs/007-financial-planning/quickstart.md` matrix against the final build and update `specs/007-financial-planning/validation-results.md` with the release recommendation and unresolved risks only

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1**: Starts immediately; review only.
- **Phase 2**: Depends on Phase 1 and blocks every user story.
- **US1, US2, US3, US5**: Depend only on Phase 2 and can proceed independently once shared files are coordinated.
- **US4**: Depends on Phase 2 and US3's obligation lifecycle; its Core Finance atomicity work must land before payment UI.
- **US6**: Shared recovery work can begin after Phase 2, but its acceptance checkpoint depends on completed US1–US4 surfaces. US5 then reuses those primitives.
- **Phase 9**: Depends on all selected user stories; T081 precedes native checks T082–T084.

### User Story Dependency Graph

```text
Phase 1 -> Phase 2 -> US1 (MVP)
                  |-> US2
                  |-> US3 -> US4
                  |-> US6 acceptance after US1-US4 -> US5 reuses recovery primitives
                  `-> US5 domain work may start independently after Phase 2

Selected stories -> Phase 9
```

### Within Each User Story

1. Write the smallest failing domain, persistence/service, and RNTL journey tests.
2. Implement domain rules before persistence/service mutations.
3. Implement query hooks before screens and routes.
4. Complete routes, integrations, localization, accessibility, and recovery behavior.
5. Run the story's independent test before starting a dependent story.

### Shared-File Coordination

- Tasks editing `src/domain/financial-planning.ts`, `src/storage/financial-planning-repository.ts`, `src/services/mocks/financial-planning-service.ts`, `app/(tabs)/home.tsx`, `app/(tabs)/more.tsx`, `src/localization/en.ts`, or `src/localization/ar.ts` must be serialized or split into non-overlapping commits.
- `[P]` tasks are parallel only after their phase prerequisite and when no other active task edits the same listed file.

---

## Parallel Examples

### User Story 1

```text
T017 salary domain tests || T018 salary persistence tests || T019 salary RNTL journey tests
After T022: T023 salary overview || T024 salary forms/review
```

### User Story 2

```text
T027 budget domain tests || T028 budget persistence tests || T029 budget RNTL journey tests
After T032: T033 budget overview/drill-down || T034 budget forms/allocation editor
```

### User Story 3

```text
T037 obligation domain tests || T038 obligation persistence tests || T039 obligation RNTL journey tests
After T042: T043 obligation overview || T044 obligation form/detail
```

### User Story 4

```text
T047 allocation tests || T048 atomic persistence tests || T049 matching tests || T050 payment RNTL journey tests
After T055: T056 payment screen || T057 match-review screen
```

### User Story 6

```text
T059 recovery persistence tests || T060 UI-state tests || T061 financial-card tests
```

### User Story 5

```text
T068 savings domain tests || T069 no-ledger-write tests || T070 savings RNTL journey tests
After T073: T074 goal list/detail || T075 goal and movement forms
```

---

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1 (T017–T026).
3. Run US1's independent test and the relevant boundary checks.
4. Demo or release the salary-cycle slice before adding other stories if scope must be reduced.

### Incremental Delivery

1. Foundation -> US1 salary MVP.
2. Add US2 budgets and verify independently.
3. Add US3 obligations, then dependent US4 payment safety.
4. Complete US6 degraded-state acceptance across P1 flows.
5. Add P2 US5 savings using the same recovery primitives.
6. Complete Phase 9 verification.

### Scope Guardrails

- Reuse the current Jest/RNTL, SQLite, TanStack Query, Zustand, localization, masking, and financial component patterns.
- Do not add an API client, cloud sync, bank sync, forecasting engine, currency conversion package, new tab, or new state-management layer for SPEC-007.
- Keep savings movements tracking-only and payment confirmation atomic; neither simplification is optional.

## Phase 10: Convergence

- [X] T085 CRITICAL Replace salary, budget, obligation, payment-match, payment, savings-goal, and savings-movement placeholder panels with validated service-backed forms and behavior tests per US1-US5 (contradicts)
- [X] T086 CRITICAL Read salary receipt, obligation, payment match, and savings goal identifiers from route parameters and remove production imports from test fixtures (contradicts)
- [X] T087 Render localized, masked, currency-correct overview/detail/history/progress content and navigation actions for every SPEC-007 page (partial)
- [X] T088 Persist and recover meaningful form drafts, prevent duplicate pending submissions, and expose actionable validation/failure recovery (partial)
- [X] T089 Correct the foundation boundary false positive that rejects the legitimate salary receipt route, then rerun all planning and foundation gates (contradicts)
- [X] T090 Replace title-only journey assertions with create/edit/review/payment/movement/lifecycle behavior coverage and eliminate act/open-handle warnings (partial)
- [X] T091 Reconcile T081-T084 and validation-results.md with final automated results and actual Android/iOS native evidence (partial)
