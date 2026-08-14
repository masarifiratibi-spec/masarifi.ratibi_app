# Tasks: Reports and Automatic Email Delivery

**Input**: Design documents from `specs/008-reports/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reports-contract.md, quickstart.md

**Tests**: The specification and constitution require the smallest tests that prove financial
calculations, validation, state transitions, privacy, accessibility, and critical journeys. Test
tasks appear before implementation in every story phase and must fail for the intended reason
before production code is added.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no incomplete-task dependency
- **[Story]**: Maps to a numbered user story in spec.md
- Every task names its exact target path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish report-specific boundaries, fixtures, and bilingual content without adding a dependency.

- [X] T001 Add the `check:reports` package command and initial reports boundary rules in `package.json` and `scripts/check-reports-boundaries.mjs`
- [X] T002 [P] Add the executable reports-boundary self-check in `scripts/check-reports-boundaries.test.mjs`
- [X] T003 [P] Add deterministic complete, empty, partial, currency, schedule, output, and 10,000-record fixture builders in `src/test-utils/report-fixtures.ts`
- [X] T004 [P] Add Arabic/English report, schedule, preview, output, privacy, and recovery message parity in `src/localization/messages/ar.ts`, `src/localization/messages/en.ts`, and `src/localization/reports-localization.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared typed/read boundaries needed by every report story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [X] T005 [P] Define ReportValue, period, metric, comparison, breakdown, snapshot, schedule, attempt, validation, and normalized error contracts in `src/domain/reports.ts`
- [X] T006 [P] Add the `report_schedule` durable draft kind and its validation regression in `src/domain/financial-planning.ts` and `src/domain/financial-planning.test.ts`
- [X] T007 [P] Add the read-only PlanningReportingSnapshot DTO and `getReportingSnapshot` method to `src/services/contracts/financial-planning-service.ts`
- [X] T008 Implement period-scoped salary, budget, obligation/payment, savings, and completeness reads in `src/storage/financial-planning-repository.ts` and prove ownership in `src/storage/financial-planning-repository.test.ts`
- [X] T009 Implement `getReportingSnapshot` with deterministic data and no report totals in `src/services/mocks/financial-planning-service.ts` and `src/services/mocks/financial-planning-service.test.ts`
- [X] T010 [P] Define live report, breakdown, schedule, draft, preview, output, attempt, affected-scope, and error methods in `src/services/contracts/reports-service.ts`
- [X] T011 [P] Add transient selected period, anchor date, and drill-down return context only in `src/state/reports-view-state.ts` and `src/state/reports-view-state.test.ts`

**Checkpoint**: Canonical finance/planning owners can supply report inputs, but no report UI or external-output claim exists.

---

## Phase 3: User Story 1 - Understand a Financial Period (Priority: P1) 🎯 MVP

**Goal**: Replace the Reports placeholder with trustworthy monthly, three-month, half-year, and annual summaries.

**Independent Test**: Open complete, empty, partial, and multi-currency fixtures; switch all four periods; verify exact ranges, matched elapsed comparison, income, expense, cash flow, savings rate, obligations, largest values, estimates, and unavailable reasons.

### Tests for User Story 1

- [X] T012 [P] [US1] Add local-date, half-open instant, leap/DST/timezone, four-period, and matched-elapsed comparison tests in `src/domain/reports-period.test.ts`
- [X] T013 [P] [US1] Add confirmed/pending eligibility, transfer-fee, adjustment, refund/reversal, obligation, savings-link, review, and conflict exact-once tests in `src/domain/reports-eligibility.test.ts`
- [X] T014 [P] [US1] Add minor-unit, captured-FX, missing-rate, savings-rate, zero-denominator, largest-value, and metric-direction tests in `src/domain/reports-summary.test.ts`
- [X] T015 [P] [US1] Add complete, empty, insufficient, partial, estimated, stale, and offline `getReport` contract tests in `src/services/mocks/reports-service.test.ts`
- [X] T016 [P] [US1] Add period switching, summary, masking, state, assistant-entry, and permanent-tab journey tests in `src/features/reports/ReportsJourney.test.tsx`

### Implementation for User Story 1

- [X] T017 [US1] Implement IANA-timezone period resolution, half-open boundaries, completed comparisons, and matched elapsed-day comparisons in `src/domain/reports.ts`
- [X] T018 [US1] Implement canonical eligibility and exact-once normalization for income, expense, transfer fee, adjustment, refund/reversal, obligation, savings, sync, review, and conflict records in `src/domain/reports.ts`
- [X] T019 [US1] Implement one-pass summary aggregation, captured FX conversion, completeness, savings rate, largest values, and contextual comparisons in `src/domain/reports.ts`
- [X] T020 [US1] Implement deterministic Core Finance plus Planning composition and `getReport` in `src/services/mocks/reports-service.ts`
- [X] T021 [US1] Add live report query keys and period-aware query hooks in `src/features/reports/report-queries.ts`
- [X] T022 [US1] Harden metric amount meaning, minor-unit formatting, unavailable/estimated states, global masking, and contextual cues in `src/design-system/components/financial/ReportMetricCard.tsx`, `src/design-system/components/financial/ComparisonIndicator.tsx`, and `src/design-system/components/financial/ReportComparison.test.tsx`
- [X] T023 [US1] Build the period selector, exact range, summary, state recovery, and mock assistant entry points in `src/features/reports/ReportsScreen.tsx`
- [X] T024 [US1] Replace the Reports placeholder with the thin ReportsScreen route in `app/(tabs)/reports.tsx`

**Checkpoint**: User Story 1 is a complete independently testable MVP; no scheduling or output action is required.

---

## Phase 4: User Story 2 - Explore Trends and Comparisons (Priority: P1)

**Goal**: Explain period-specific category, account, merchant, budget, obligation, savings, salary, and completed-month trends through truthful charts and text.

**Independent Test**: Load representative histories for every report type and verify each required insight, completed-month sufficiency, chart/text equivalence, localized Other membership, and unavailable-history behavior.

### Tests for User Story 2

- [X] T025 [P] [US2] Add completed-month average, volatility, consistency, high/low, debt reduction, savings progression, subscription impact, and insufficient-history tests in `src/domain/reports-trends.test.ts`
- [X] T026 [P] [US2] Add deterministic ordering, ties, localized Other, retained member IDs, and zero-versus-missing bucket tests in `src/design-system/charts/chart-data.test.ts`
- [X] T027 [P] [US2] Add real-value geometry, non-color cues, text-equivalent summary, RTL, reduced-motion, and empty chart tests in `src/design-system/charts/ReportsCharts.test.tsx`
- [X] T028 [P] [US2] Add monthly, three-month, half-year, annual, and insufficient-data screen/service journey tests in `src/features/reports/ReportTypesJourney.test.tsx` and `src/services/mocks/reports-breakdowns.test.ts`

### Implementation for User Story 2

- [X] T029 [US2] Implement comparable completed-month buckets and all monthly, three-month, half-year, and annual insights in `src/domain/reports.ts`
- [X] T030 [US2] Preserve semantic IDs, ties, member filters, localized Other, and missing bucket states in `src/design-system/charts/chart-data.ts`
- [X] T031 [P] [US2] Replace fixed line geometry with value-driven normalized points and semantic series cues in `src/design-system/charts/LineChart.tsx`
- [X] T032 [P] [US2] Replace the fixed donut with value-driven segments and strengthen text/empty/drill-down framing in `src/design-system/charts/DonutChart.tsx` and `src/design-system/charts/AccessibleChartFrame.tsx`
- [X] T033 [US2] Populate category, account, merchant, month, budget, obligation, savings, salary, and period-specific breakdowns in `src/services/mocks/reports-service.ts`
- [X] T034 [US2] Render report-type insights, accessible charts, text summaries, insufficient-history states, and contextual comparison labels in `src/features/reports/ReportsScreen.tsx`

**Checkpoint**: User Stories 1 and 2 independently explain both current totals and longer-period behavior.

---

## Phase 5: User Story 3 - Verify a Report Through Drill-Down (Priority: P1)

**Goal**: Make every category, account, merchant, month, Other, and obligation result traceable to canonical records and return to unchanged report context.

**Independent Test**: Select every supported dimension, verify visible transaction filters or obligation history, correct a contributing record, return to the same report state, and confirm one refreshed result.

### Tests for User Story 3

- [X] T035 [P] [US3] Add typed transaction, Other-membership, obligation, and report-return mapping tests in `src/features/reports/report-drill-down.test.ts`
- [X] T036 [P] [US3] Add category/account/merchant/month/Other/obligation navigation and back-context journey tests in `src/features/reports/ReportDrillDownJourney.test.tsx`
- [X] T037 [P] [US3] Add finance/planning mutation-to-live-report invalidation and immutable-attempt non-invalidation tests in `src/features/reports/report-invalidation.test.ts`

### Implementation for User Story 3

- [X] T038 [US3] Implement `getBreakdown` and drill-down query ownership in `src/services/mocks/reports-service.ts` and `src/features/reports/report-queries.ts`
- [X] T039 [US3] Add report-origin filter application/removal without storing report entities in `src/state/core-finance-view-state.ts` and `src/state/reports-view-state.ts`
- [X] T040 [US3] Build dimension details, included Other members, canonical transaction filters, obligation links, and return action in `src/features/reports/ReportDrillDownScreen.tsx`
- [X] T041 [US3] Add the thin protected drill-down route in `app/reports/drill-down.tsx`
- [X] T042 [US3] Connect report result actions and live-report invalidation after Core Finance/Planning changes in `src/features/reports/ReportsScreen.tsx`, `src/features/core-finance/core-finance-queries.ts`, and `src/features/financial-planning/financial-planning-queries.ts`

**Checkpoint**: Every displayed result is inspectable and corrections refresh live reports without rewriting historical output.

---

## Phase 6: User Story 4 - Schedule Automatic Email Reports (Priority: P1)

**Goal**: Configure one verified, versioned, predictable mock report schedule and preserve edits/history through pause, failure, offline use, and timezone change.

**Independent Test**: Create, edit, verify, pause, resume, disable, and recover every frequency with days 1/28, missed occurrence, changed email/timezone, draft restart, conflict, failure, and last/next status.

### Tests for User Story 4

- [X] T043 [P] [US4] Add email normalization, exact-address verification, days 1-28, 09:00 recurrence, cadence coverage, missed-run, pause/resume, and timezone-review tests in `src/domain/reports-schedule.test.ts`
- [X] T044 [P] [US4] Add schema v5-to-v6, singleton/version, schedule lifecycle, operation-id, and durable report-schedule draft tests in `src/storage/reports-repository.test.ts`
- [X] T045 [P] [US4] Add verification, create/edit/status, last/next projection, offline, conflict, and safe-failure service tests in `src/services/mocks/reports-schedule.test.ts`
- [X] T046 [P] [US4] Add setup, verification, frequency, detail choice, timezone review, pause/resume/disable, history, and draft-recovery journey tests in `src/features/reports/ReportScheduleJourney.test.tsx`

### Implementation for User Story 4

- [X] T047 [US4] Implement recipient validation/verification state, schedule validation/lifecycle, cadence coverage, and next-occurrence projection in `src/domain/reports.ts`
- [X] T048 [US4] Advance schema version 5 to 6 with indexed `report_schedules` and `report_output_attempts` tables in `src/storage/database.ts`
- [X] T049 [US4] Implement singleton schedule hydration/persistence, expected-version checks, status transitions, and operation idempotency in `src/storage/reports-repository.ts`
- [X] T050 [US4] Extend the existing durable planning draft boundary and add schedule autosave/restore/discard in `src/features/reports/useReportDraft.ts` and `src/services/mocks/reports-service.ts`
- [X] T051 [US4] Add deterministic verification-required, verified, active, paused, disabled, offline, conflict, and safe-failure scenarios in `src/services/mocks/report-delivery-adapter.ts`
- [X] T052 [US4] Implement schedule get/verify/save/status methods and affected scopes in `src/services/mocks/reports-service.ts`
- [X] T053 [US4] Add schedule/draft query and mutation hooks with targeted invalidation in `src/features/reports/report-queries.ts`
- [X] T054 [US4] Build the schedule form, privacy choice, verification, timezone review, last/next status, lifecycle actions, attempt summary, and draft recovery in `src/features/reports/ReportScheduleScreen.tsx`
- [X] T055 [US4] Add the protected reports stack and thin schedule route in `app/reports/_layout.tsx` and `app/reports/schedule.tsx`

**Checkpoint**: Scheduling is independently testable as deterministic frontend state and never claims device-closed background email delivery.

---

## Phase 7: User Story 5 - Preview, Send, Export, or Share Safely (Priority: P2)

**Goal**: Preview exact content and exercise idempotent mock send/test/retry plus explicitly simulated download/share with immutable sanitized snapshots.

**Independent Test**: Preview summary/detailed content, verify the structural allowlist, execute every output state and repeated operation, retry once, pause during an in-flight result, mutate source data, and compare the unchanged prior snapshot.

### Tests for User Story 5

- [X] T056 [P] [US5] Add snapshot provenance, captured FX, detailed-row allowlist, hidden-value, and post-correction immutability tests in `src/domain/reports-snapshot.test.ts`
- [X] T057 [P] [US5] Add output attempt persistence, unique operation, retry linkage, duplicate-success rejection, late result, and append-only snapshot tests in `src/storage/reports-output.test.ts`
- [X] T058 [P] [US5] Add preview, send-test, send-now, scheduled, retry, failure, simulated download/share, and safe-state service tests in `src/services/mocks/reports-output.test.ts`
- [X] T059 [P] [US5] Add summary/detailed preview, privacy warning, repeated tap, failure/retry, late result, and simulation-honesty journey tests in `src/features/reports/ReportPreviewJourney.test.tsx`

### Implementation for User Story 5

- [X] T060 [US5] Implement immutable snapshot construction, one captured FX map, output provenance, privacy notices, and structural DetailedReportRow sanitization in `src/domain/reports.ts`
- [X] T061 [US5] Implement attempt persistence, operation replay, failed-attempt retry chain, duplicate-success guard, and late-result context in `src/storage/reports-repository.ts`
- [X] T062 [US5] Add deterministic sending, sent, temporary/recipient failure, retry success, late result, simulated download, and simulated share outcomes in `src/services/mocks/report-delivery-adapter.ts`
- [X] T063 [US5] Implement preview, requestOutput, retry, attempt list/detail, and immutable snapshot methods in `src/services/mocks/reports-service.ts`
- [X] T064 [US5] Add preview and attempt query/mutation hooks with repeated-submission prevention in `src/features/reports/report-queries.ts`
- [X] T065 [US5] Build exact-content preview, summary/detailed sections, privacy/estimate/mock notices, output actions, attempt status, retry, and immutable-history rendering in `src/features/reports/ReportPreviewScreen.tsx`
- [X] T066 [US5] Add the thin preview/attempt route in `app/reports/preview.tsx`
- [X] T067 [US5] Connect preview, send now, send test, download, share, and attempt-history entries from `src/features/reports/ReportsScreen.tsx` and `src/features/reports/ReportScheduleScreen.tsx`

**Checkpoint**: All external actions are explicit deterministic simulations, exactly-once, sanitized, and historically immutable.

---

## Phase 8: User Story 6 - Recover Without Losing Report Settings (Priority: P1)

**Goal**: Make every report, schedule, preview, and output state recoverable, private, bilingual, accessible, and responsive under realistic density.

**Independent Test**: Exercise the complete state matrix in Arabic/English, light/dark, 320x568/large/tablet, 200% text, hidden values, grayscale, reduced motion, TalkBack/VoiceOver, offline mode, and 10,000 records.

### Tests for User Story 6

- [X] T068 [P] [US6] Add report/schedule/preview query-data-lifecycle state matrix and actionable recovery tests in `src/features/reports/ReportsStates.test.tsx`
- [X] T069 [P] [US6] Add Arabic/English, RTL/LTR, masking, mixed-direction, grayscale, reduced-motion, 200% text, focus-order, and 44x44 accessibility tests in `src/features/reports/ReportsAccessibility.test.tsx`
- [X] T070 [P] [US6] Add offline local-data, last-attempt fallback, draft preservation, stale preview, safe error, and conflict recovery tests in `src/services/mocks/reports-recovery.test.ts`
- [X] T071 [P] [US6] Add the deterministic 10,000-record correctness and 95%-within-two-seconds performance check in `src/features/reports/reports-performance.test.ts`

### Implementation for User Story 6

- [X] T072 [US6] Map query, report-data, schedule, and output states to localized titles, actions, and safe error categories in `src/features/reports/report-state.ts`
- [X] T073 [US6] Add offline canonical-data reads, clearly dated last-attempt fallback, stale-preview recovery, and draft-preserving retry in `src/services/mocks/reports-service.ts`
- [X] T074 [US6] Add allowlisted report analytics events and reject amount, recipient, merchant, account, row, snapshot, and identifier payloads in `src/analytics/report-events.ts` and `src/analytics/report-events.test.ts`
- [X] T075 [US6] Harden report, drill-down, schedule, and preview screens for global masking, mixed direction, keyboard, 320x568, 200% text, focus order, reduced motion, and 44x44 targets in `src/features/reports/ReportsScreen.tsx`, `src/features/reports/ReportDrillDownScreen.tsx`, `src/features/reports/ReportScheduleScreen.tsx`, and `src/features/reports/ReportPreviewScreen.tsx`
- [X] T076 [US6] Harden chart summaries and metric accessibility so hidden values, color, geometry, icons, motion, and haptics are never required in `src/design-system/charts/AccessibleChartFrame.tsx`, `src/design-system/charts/LineChart.tsx`, `src/design-system/charts/DonutChart.tsx`, `src/design-system/components/financial/ReportMetricCard.tsx`, and `src/design-system/components/financial/ComparisonIndicator.tsx`
- [X] T077 [US6] Add protected-route, tab/deep-link, assistant-context, error-boundary, and no-real-provider regression coverage in `src/features/reports/ReportsRoutes.test.tsx` and `src/features/shell/NavigationJourney.test.tsx`

**Checkpoint**: All six user stories meet the trust, recovery, localization, accessibility, privacy, and scale gates.

---

## Phase 9: Polish & Cross-Cutting Validation

**Purpose**: Execute the complete quickstart and retain honest automated/native evidence.

- [X] T078 Run typecheck, lint, all boundary commands, and the complete Jest suite; record exact command outcomes in `specs/008-reports/validation-results.md`
- [ ] T079 Run the Android development-build report, drill-down, schedule, preview, offline, masking, 320x568, TalkBack, and late-result scenarios; record device evidence in `specs/008-reports/native-evidence/android.md`
- [X] T080 [P] Run the iOS development-build report, schedule, preview, offline, masking, and VoiceOver scenarios on macOS/Xcode, or record the environment blocker in `specs/008-reports/native-evidence/ios.md`
- [ ] T081 [P] Complete Arabic/English, light/dark, small/large/tablet, keyboard, 200% text, grayscale, reduced-motion, and hidden-value visual QA in `specs/008-reports/native-evidence/visual-qa.md`
- [ ] T082 Measure the 10,000-record two-second target on supported devices and retain correctness/timing evidence in `specs/008-reports/native-evidence/performance.md`
- [X] T083 Audit the final diff for production email/file/share/scheduler/provider/secret claims, direct storage, hard-coded strings/colors, sensitive analytics/logging, mutable snapshots, and unsupported iOS SMS behavior; record the scope result in `specs/008-reports/validation-results.md`
- [X] T084 Execute every `specs/008-reports/quickstart.md` scenario and stop condition, then finalize pass/blocked/fail status in `specs/008-reports/validation-results.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependency; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational and is the MVP.
- **US2 (Phase 4)**: Depends on the US1 report model/service; its domain/chart work can begin once US1 contracts stabilize.
- **US3 (Phase 5)**: Depends on US1 report membership; can run in parallel with US2 after US1.
- **US4 (Phase 6)**: Depends only on Foundational for its schedule core and may proceed beside US1-US3 using fixtures; final Reports entry integration follows US1.
- **US5 (Phase 7)**: Depends on US1 live reports and US4 schedule/attempt persistence.
- **US6 (Phase 8)**: Depends on every story included in the release because it verifies their combined recovery/access states.
- **Polish (Phase 9)**: Depends on all desired user stories.

### User Story Dependencies

```text
Setup -> Foundational -> US1 (MVP)
                         |-> US2
                         |-> US3
Foundational ------------|-> US4
US1 + US4 ------------------> US5
US1 + US2 + US3 + US4 + US5 -> US6 -> Polish
```

### Within Each User Story

- Write the listed tests first and confirm they fail for the intended missing behavior.
- Domain rules precede service composition.
- Services precede query hooks and screens.
- Screens precede thin routes and cross-story navigation.
- A story reaches its checkpoint only after its independent test passes.

## Parallel Opportunities

- Setup fixture, localization, and boundary-test work (T002-T004) can run in parallel after T001's command name is fixed.
- Foundational domain, draft, contracts, and view-state work (T005-T007, T010-T011) can run in parallel; repository/service projection follows T007.
- US1 test files T012-T016 can be authored in parallel before T017-T024.
- US2 tests T025-T028 and chart implementations T031-T032 are parallelizable by file.
- US3 tests T035-T037 are parallel; US2 and US3 may proceed together after US1.
- US4 tests T043-T046 are parallel; schedule work can proceed beside report trends/drill-down.
- US5 tests T056-T059 are parallel before output implementation.
- US6 tests T068-T071 are parallel; native iOS and visual QA evidence T080-T081 may run beside Android work where environments exist.

## Parallel Examples

### User Story 1

```text
Task T012: Period/timezone comparison tests in src/domain/reports-period.test.ts
Task T013: Eligibility/exact-once tests in src/domain/reports-eligibility.test.ts
Task T014: Money/FX/summary tests in src/domain/reports-summary.test.ts
Task T015: Report service state tests in src/services/mocks/reports-service.test.ts
Task T016: Reports MVP journey tests in src/features/reports/ReportsJourney.test.tsx
```

### User Story 2

```text
Task T025: Completed-month trend tests in src/domain/reports-trends.test.ts
Task T026: Other/membership tests in src/design-system/charts/chart-data.test.ts
Task T027: Accessible geometry tests in src/design-system/charts/ReportsCharts.test.tsx
Task T028: Report-type journeys in src/features/reports/ReportTypesJourney.test.tsx
```

### User Story 3

```text
Task T035: Drill-down mapping tests in src/features/reports/report-drill-down.test.ts
Task T036: Drill-down navigation journeys in src/features/reports/ReportDrillDownJourney.test.tsx
Task T037: Source invalidation tests in src/features/reports/report-invalidation.test.ts
```

### User Story 4

```text
Task T043: Schedule domain tests in src/domain/reports-schedule.test.ts
Task T044: Migration/repository schedule tests in src/storage/reports-repository.test.ts
Task T045: Schedule service tests in src/services/mocks/reports-schedule.test.ts
Task T046: Schedule screen journeys in src/features/reports/ReportScheduleJourney.test.tsx
```

### User Story 5

```text
Task T056: Snapshot/sanitizer tests in src/domain/reports-snapshot.test.ts
Task T057: Attempt/idempotency tests in src/storage/reports-output.test.ts
Task T058: Output service state tests in src/services/mocks/reports-output.test.ts
Task T059: Preview/output journeys in src/features/reports/ReportPreviewJourney.test.tsx
```

### User Story 6

```text
Task T068: State/recovery tests in src/features/reports/ReportsStates.test.tsx
Task T069: Localization/accessibility tests in src/features/reports/ReportsAccessibility.test.tsx
Task T070: Offline/recovery tests in src/services/mocks/reports-recovery.test.ts
Task T071: 10,000-record performance test in src/features/reports/reports-performance.test.ts
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 only.
3. Run T012-T024 and validate the four period summaries independently.
4. Stop with a useful Reports tab before adding trends, drill-down, or delivery settings.

### Incremental Delivery

1. **US1**: Trustworthy period summary MVP.
2. **US2 + US3**: Explain change and make every result traceable.
3. **US4**: Add one verified deterministic schedule.
4. **US5**: Add immutable preview/send/test/retry and simulated download/share.
5. **US6**: Complete recovery, privacy, accessibility, localization, and scale hardening.
6. **Polish**: Retain automated and native evidence; do not convert a blocked native check into a pass.

## Notes

- No task adds a dependency, report cache, aggregate table, snapshot table, provider SDK, file generator, share package, background scheduler, or production secret.
- Live reports derive from canonical owners; output attempts embed immutable sanitized snapshots.
- `[P]` means different-file work with no incomplete dependency, not permission to edit the same shared file concurrently.
- Test tasks precede production tasks and must fail for the intended reason first.
- Stop at any checkpoint to validate an independently useful increment.

## Phase 10: Convergence

- [X] T085 CRITICAL Correct IANA-timezone report boundaries, matched comparisons, timezone-aware delivery projection, captured FX conversion, and incomplete-rate handling per FR-003, FR-004, FR-009, and FR-030 (contradicts)
- [X] T086 Compose budget, obligation/debt, savings, salary, subscription, recurring-payment, monthly, three-month, half-year, and annual insights into report results per FR-005 and FR-010 through FR-016 (partial)
- [X] T087 Render the complete summary, exact comparison context, data-derived chart summaries, all report states, and five contextual assistant actions on the Reports page per FR-005 and FR-020 through FR-025 and FR-046 (partial)
- [X] T088 Apply visible period/dimension filters, inspect Other members, navigate to contributing transactions or obligation history, and preserve return context per FR-017 through FR-019 (partial)
- [X] T089 CRITICAL Replace the hard-coded schedule with an editable, draft-preserving form; explicit recipient verification; frequency, detail, timezone, lifecycle, last/next delivery, and history controls; and durable repository persistence per FR-026 through FR-037 and FR-040 (contradicts)
- [X] T090 Render exact preview provenance/content, privacy choices, output status/history, send-test/send-now/retry actions, immutable snapshots, and pending-action duplicate prevention per FR-033 through FR-039 and FR-048 (partial)
- [X] T091 Localize every report state/action, remove hard-coded user-facing strings, preserve masked accessibility output, and verify RTL, focus order, 200% text, reduced motion, and 44x44 controls per FR-022, FR-023, FR-041, FR-043, and FR-044 (partial)
- [X] T092 CRITICAL Restrict detailed output rows to the selected report period and preserve the structural data allowlist per FR-028 and FR-048 (contradicts)
- [X] T093 Replace superficial report journey assertions with behavior coverage, eliminate React act/open-handle warnings, rerun the full quickstart matrix, and align task/evidence status with actual native availability per Verification requirements (partial)
