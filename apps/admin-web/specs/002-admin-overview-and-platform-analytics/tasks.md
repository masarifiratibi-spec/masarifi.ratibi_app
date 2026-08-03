# Tasks: Platform Overview and Cross-Platform Customer Analytics

**Input**: `specs/002-admin-overview-and-platform-analytics/spec.md` and
`plan.md`  
**Scope**: Existing `apps/admin-web` frontend and `/admin` route only  
**Tests**: Required for every changed behavior  
**Executor note**: Complete tasks in ID order unless a task is marked `[P]`.
Do not initialize a project, add a dependency, create a route, implement a
backend, or redesign the approved Admin Dashboard.

Every implementation task must preserve the existing rendered hierarchy and
semantic tokens. A task is complete only after its stated file change and
verification are both complete.

## Phase 1: Existing Project and Contract Review

**Purpose**: Establish the exact baseline before modifying application code.

- [X] T001 Inspect `src/app/admin/page.tsx`, `src/components/admin/Charts.tsx`, `src/components/admin/ui.tsx`, `src/components/admin/PlatformFilter.tsx`, `src/components/admin/DateRangeControl.tsx`, and `src/components/admin/AttentionPanel.tsx`; record the reusable hierarchy and explicit no-redesign constraints in `specs/002-admin-overview-and-platform-analytics/baseline.md`
- [X] T002 Inspect `src/features/overview/contracts.ts`, `src/features/overview/repository.ts`, `src/features/overview/hooks.ts`, `src/mocks/handlers/overview.ts`, `src/mocks/handlers/attention.ts`, and `src/mocks/fixtures/overview.ts`; record the current single-response limitations and the four target contracts in `specs/002-admin-overview-and-platform-analytics/baseline.md`
- [X] T003 Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` without changing code; record each command, exit code, and any pre-existing failure verbatim in `specs/002-admin-overview-and-platform-analytics/baseline.md`
- [X] T004 Run `npm list --depth=0`; confirm the fixed stack is already installed and record that Spec 002 requires no package or lockfile change in `specs/002-admin-overview-and-platform-analytics/baseline.md`
- [X] T005 Compare `/admin` in Arabic RTL and English LTR, light and dark themes, at 1440px, 1280px, 1024px, 768px, and 390px; record baseline screenshots or precise observable notes without changing the page in `specs/002-admin-overview-and-platform-analytics/baseline.md`

**Checkpoint**: The executor can identify the approved visual baseline, current
data flow, pre-existing failures, and prohibited scope before editing code.

---

## Phase 2: Shared Frontend Foundations

**Purpose**: Add only the shared validation and regional-state primitives that
all five stories require.

- [X] T006 [P] Add failing Vitest cases for `PlatformFilter`, `ReportingPeriod`, `PlatformScope`, `MetricKind`, `DataFreshness`, `OverviewQuery`, and `OverviewRegionState` parsing—including invalid platform, period, timestamp, and unsafe overlong text—in `src/features/overview/contracts.test.ts`; run `npm run test -- src/features/overview/contracts.test.ts` and confirm the new cases are collected
- [X] T007 [P] Add failing component tests for accessible loading, empty, partial/stale warning, unavailable, forbidden, and retryable region presentations in `src/components/admin/ui.test.tsx`; run `npm run test -- src/components/admin/ui.test.tsx` and confirm the new cases are collected
- [X] T008 Implement the shared enums, query schema with `all`/`30d`/`ar` defaults, freshness schema, region-state schema, and inferred strict types in `src/features/overview/contracts.ts`; run `npm run test -- src/features/overview/contracts.test.ts` and make the T006 cases pass
- [X] T009 Add one small validated query-string helper for platform, period, locale, pagination, and optional `__scenario` values inside `src/features/overview/repository.ts`; add assertions for normalized defaults and rejected values in `src/features/overview/repository.test.ts`, then run `npm run test -- src/features/overview/repository.test.ts`
- [X] T010 Extend `overviewQueryKeys` with serializable keys for summary, platform analytics, activity, and attention inputs in `src/features/overview/hooks.ts`; add exact-key assertions in `src/features/overview/hooks.test.ts` and run `npm run test -- src/features/overview/hooks.test.ts`
- [X] T011 Extend the existing state components in `src/components/admin/ui.tsx` so a region can show safe localized loading, empty, partial/stale warning, unavailable, forbidden, and retry behavior without blanking sibling content; run `npm run test -- src/components/admin/ui.test.tsx`
- [X] T012 Add only the semantic CSS selectors required by the regional states, responsive wrapping, 44px touch targets, and reduced-motion behavior to `src/app/globals.css`; verify there are no new raw hexadecimal/RGB colors with `rg -n "#[0-9A-Fa-f]{3,8}|rgb\\(" src/app/globals.css`
- [X] T013 Extend `src/tests/no-direct-fixtures.test.ts` to cover `/admin` and all Admin presentation components against `@/mocks/fixtures`, `@/data`, and `data/admin` imports; run `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T014 Run `npm run typecheck`, `npm run lint`, and `npm run test -- src/features/overview/contracts.test.ts src/features/overview/repository.test.ts src/features/overview/hooks.test.ts src/components/admin/ui.test.tsx src/tests/no-direct-fixtures.test.ts`; fix only Phase 2 regressions before continuing

**Gate**: No page or presentation component imports fixtures; no backend,
route, dependency, public secret, browser storage, `any`, or design change has
been introduced.

---

## Phase 3: User Story 1 — Understand the Combined Platform (P1)

**Goal**: Show authoritative combined customer, subscription, revenue, import,
AI, support, incident, job, and global-health summaries on the existing
Overview.

**Independent test**: Open `/admin` with default inputs and verify All
Platforms/30 days, complete metric semantics, authoritative non-additive totals,
global health, and a safe regional data-quality failure for an impossible
combined response.

### Tests

- [X] T015 [P] [US1] Add failing schema tests for `OverviewMetric`, `SubscriptionRevenueSummary`, `PlatformOperationalMetric`, `ServiceHealthSummary`, and `OverviewSummaryResponse`, including invalid rates, mixed currency, non-global health, malformed freshness, and raw private text rejection, in `src/features/overview/contracts.test.ts`
- [X] T016 [P] [US1] Add failing repository tests for `GET /api/v1/admin/overview` query serialization, success validation, invalid response rejection, empty, stale, partial, forbidden, rate-limited, unavailable, and internal-error mapping in `src/features/overview/repository.test.ts`
- [X] T017 [P] [US1] Add failing page/component tests for default All Platforms and 30-day selection, metric kind/scope/period/freshness labels, accessible chart summaries, global-health labels, and independent summary-region retry in `src/app/admin/overview.test.tsx`
- [X] T018 [P] [US1] Add a failing Playwright journey for the default combined Overview, authoritative total display, no page-level console error, and one isolated invalid-summary region in `tests/e2e/overview-analytics.spec.ts`

### Implementation

- [X] T019 [US1] Implement the US1 Zod schemas and inferred types from T015 in `src/features/overview/contracts.ts`; keep numeric source values separate from formatted display strings and run `npm run test -- src/features/overview/contracts.test.ts`
- [X] T020 [US1] Replace the combined Overview fixture data with complete sanitized fictional KPI, subscription, revenue, import, AI, support, job, and eight-service global-health responses in `src/mocks/fixtures/overview.ts`; include success, empty, stale, partial, and impossible-summary variants
- [X] T021 [US1] Implement the validated `/api/v1/admin/overview` MSW response and US1 scenario selection in `src/mocks/handlers/overview.ts`; reuse shared safe error responses and expose no private payload
- [X] T022 [US1] Add `getOverviewSummary` to the existing repository interface and implementation in `src/features/overview/repository.ts`; parse the query before request and validate the response before return, then run `npm run test -- src/features/overview/repository.test.ts`
- [X] T023 [US1] Add `useOverviewSummary` with the summary query key and region-safe retry behavior in `src/features/overview/hooks.ts`; run `npm run test -- src/features/overview/hooks.test.ts`
- [X] T024 [US1] Connect the existing KPI, subscription/revenue, operational summary, and global-health sections to `useOverviewSummary` in `src/app/admin/page.tsx`; keep their approved order/classes and replace the top-level page-loading return with summary-region states
- [X] T025 [US1] Add an optional allowed-presets prop to `src/components/admin/DateRangeControl.tsx` with the current four presets as its backward-compatible default, then replace the page’s ad hoc period `<select>` in `src/app/admin/page.tsx` with `DateRangeControl` limited to `7d`, `30d`, and `90d` and defaulting to `30d`; add the preset-limit assertion to `src/app/admin/overview.test.tsx`
- [X] T026 [US1] Ensure every US1 metric and chart exposes localized kind, platform scope, reporting period, freshness, and a textual chart summary through existing components in `src/components/admin/ui.tsx` and `src/components/admin/Charts.tsx`
- [X] T027 [US1] Run `npm run test -- src/features/overview/contracts.test.ts src/features/overview/repository.test.ts src/features/overview/hooks.test.ts src/app/admin/overview.test.tsx` and the US1 test in `tests/e2e/overview-analytics.spec.ts`; fix only US1 failures and record the result in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

**Checkpoint**: User Story 1 works independently with authoritative combined
values and no browser-derived customer or financial total.

---

## Phase 4: User Story 2 — Compare iOS and Android Customers (P1)

**Goal**: Switch consistently among All Platforms, iOS, and Android while
preserving global metrics and correct customer overlap semantics.

**Independent test**: Cycle `all → ios → android` for each approved period and
verify every attributable value and label changes together, global health does
not change, overlap is explained, and an older request cannot overwrite the
latest selection.

### Tests

- [X] T028 [P] [US2] Add failing schema tests for `CustomerPlatformBreakdown`, `TrendPoint`, `TrendSeries`, and `PlatformAnalyticsResponse`, covering the unique/iOS-only/Android-only/multi-platform equations, overlapping active audiences, mutually exclusive registration-origin new customers, inconsistent windows, and duplicate timestamps, in `src/features/overview/contracts.test.ts`
- [X] T029 [P] [US2] Add failing repository tests for `GET /api/v1/admin/overview/platform-analytics` across all/ios/android and 7d/30d/90d, including impossible counts, malformed pagination-independent fields, unsafe labels, and unknown attribution, in `src/features/overview/repository.test.ts`
- [X] T030 [P] [US2] Add failing component tests for consistent platform/period context, the visible non-additive audience warning, valid zero-platform empty state, global-health immutability, and out-of-order request protection in `src/app/admin/overview.test.tsx`
- [X] T031 [P] [US2] Extend `tests/e2e/overview-analytics.spec.ts` with a failing platform/period matrix journey that asserts no stale platform labels and unchanged Global service-health values

### Implementation

- [X] T032 [US2] Implement customer-breakdown, trend-series, and platform-analytics schemas and cross-field refinements from T028 in `src/features/overview/contracts.ts`; run `npm run test -- src/features/overview/contracts.test.ts`
- [X] T033 [US2] Add deterministic all/iOS/Android customer, user-growth, DAU, MAU, platform-comparison, error-rate, import, and support fixtures for every approved period in `src/mocks/fixtures/overview.ts`; include multi-platform, multi-device, zero-platform, impossible-count, and unknown-attribution variants
- [X] T034 [US2] Add the validated `/api/v1/admin/overview/platform-analytics` handler with platform and period filtering in `src/mocks/handlers/overview.ts`; return a safe regional failure for invalid requests or responses
- [X] T035 [US2] Add `getPlatformAnalytics` to `src/features/overview/repository.ts` and `usePlatformAnalytics` to `src/features/overview/hooks.ts`; include platform and period in the query key and run the repository/hook tests
- [X] T036 [US2] Bind the existing platform control, customer trend, import volume, platform comparison, and support regions to the shared platform/period state in `src/app/admin/page.tsx`; keep Global health outside mobile filtering
- [X] T037 [US2] Add the localized, accessible explanation that iOS and Android customer and active audiences may overlap and must not be summed in `src/app/admin/page.tsx`; show it only where relevant and use existing warning styling
- [X] T038 [US2] Give each platform-analytics region its own loading, empty, partial, stale, error, forbidden, and retry rendering in `src/app/admin/page.tsx`; confirm a region failure leaves US1 regions usable
- [X] T039 [US2] Run the US2 Vitest files and the platform/period Playwright journey from T031; record command output and invariant results in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

**Checkpoint**: User Story 2 is independently testable for all three platforms
and all three periods with correct overlap, freshness, and failure isolation.

---

## Phase 5: User Story 3 — Review Platform Adoption (P1)

**Goal**: Show privacy-safe iOS and Android version, device, capability, import,
and support adoption without inventing unsupported platform capabilities.

**Independent test**: Select iOS and Android and verify their approved
capabilities, version support states, unknown attribution, aggregate-only
values, and accessible distribution summaries.

### Tests

- [X] T040 [P] [US3] Add failing schema tests for `AppVersionDistributionItem`, `CapabilityAdoptionMetric`, and `DeviceDistributionItem`, including share bounds, enabled greater than eligible, platform/capability mismatch, unknown versions, and prohibited iOS SMS/notification capability, in `src/features/overview/contracts.test.ts`
- [X] T041 [P] [US3] Add failing component tests for iOS Shortcut/Share Extension, Android SMS tracking/Notification Listener, supported/unsupported/unknown version labels, device aggregation, caveats, and non-color-only legends in `src/app/admin/overview.test.tsx`
- [X] T042 [P] [US3] Extend `tests/e2e/overview-analytics.spec.ts` with failing iOS and Android adoption journeys, including unknown attribution and a 390px stacked-summary assertion

### Implementation

- [X] T043 [US3] Implement version-distribution, capability-adoption, and device-distribution schemas with platform-specific refinements in `src/features/overview/contracts.ts`; run the T040 tests
- [X] T044 [US3] Complete iOS and Android version, device, capability, fragmentation-warning, and unknown-attribution fixtures in `src/mocks/fixtures/overview.ts`; keep all values aggregated and omit customer/device identifiers
- [X] T045 [US3] Return the US3 adoption fields from the existing platform-analytics handler in `src/mocks/handlers/overview.ts`; reject invalid rates, malformed versions, and platform/capability mismatches through response validation
- [X] T046 [US3] Render adoption and version distributions with existing `ChartCard`, chart primitives, badges, legends, and semantic tokens in `src/app/admin/page.tsx`; preserve the approved section order and provide a non-empty textual summary for every chart
- [X] T047 [US3] Add only the responsive rules needed to wrap adoption legends and stack dense summaries at 768px and 390px in `src/app/globals.css`; verify zero page-level overflow and no new raw color values
- [X] T048 [US3] Run the US3 Vitest and Playwright tests from T040–T042 and record actual results in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

**Checkpoint**: User Story 3 is independently testable with correct
platform-specific adoption, explicit quality states, and no customer-level
data.

---

## Phase 6: User Story 4 — Prioritize Operational Attention (P1)

**Goal**: Present sanitized permission-aware attention items in deterministic
severity and recency order without activating unapproved destinations.

**Independent test**: For all seven simulated roles, load intentionally
unordered items and verify permission filtering, `critical → high → medium →
low → info`, newest-first ties, safe summaries, valid links, and isolated retry.

### Tests

- [X] T049 [P] [US4] Add failing schema and ordering tests for paginated `AttentionItem`/`AttentionResponse`, all required attention categories, unsafe summaries, invalid timestamps, unapproved routes, and the stable ID tie-break in `src/features/foundation/schemas.test.ts`
- [X] T050 [P] [US4] Extend foundation repository tests with failing attention query, pagination, platform/period, permission-filtering, and deterministic ordering cases in `src/features/foundation/repository.test.ts`
- [X] T051 [P] [US4] Add failing `AttentionPanel` tests for loading, empty, partial, stale, unavailable, retry, severity text/icon/color, destination omission, keyboard operation, and focus restoration in `src/components/admin/AttentionPanel.test.tsx`
- [X] T052 [P] [US4] Extend `tests/e2e/overview-analytics.spec.ts` with a failing seven-role attention matrix and isolated attention-failure journey

### Implementation

- [X] T053 [US4] Extend the existing attention schemas and types with period, platform scope, pagination, optional destination, and safe category fields in `src/features/foundation/schemas.ts` and `src/features/foundation/contracts.ts`; keep Phase 0 permission keys unchanged
- [X] T054 [US4] Add sanitized fixtures for critical incidents, failed-payment spikes, import spikes, AI outages, queue backlogs, security alerts, account-deletion failures, and high-priority support in `src/mocks/fixtures/foundation.ts`
- [X] T055 [US4] Extend `/api/v1/admin/attention` to validate platform, period, page, page size, and development-only role inputs and return the paginated response in `src/mocks/handlers/attention.ts`
- [X] T056 [US4] Update `getAttention` and `useAttention` inputs and query keys in `src/features/foundation/repository.ts` and `src/features/foundation/hooks.ts`; filter by simulated permission, remove inactive destinations, and sort severity descending, timestamp descending, then ID ascending
- [X] T057 [US4] Update `src/components/admin/AttentionPanel.tsx` to display safe timestamp/platform context, existing severity badges, bounded results, independent states/retry, and links only for approved permitted destinations; retain the approved trigger and panel styling
- [X] T058 [US4] Run the US4 Vitest and Playwright tests from T049–T052 and record the actual role/order/state results in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

**Checkpoint**: User Story 4 is independently testable and visibly states that
mock permission behavior is not production authorization.

---

## Phase 7: User Story 5 — Review Recent Platform Activity (P2)

**Goal**: Show bounded, sanitized, permission-aware operational activity for
the selected platform and period without representing it as immutable audit.

**Independent test**: Load, filter, empty, paginate, partially fail, and deny
the activity region; verify fictional safe content, pagination reset on filter
change, approved destinations only, and the operational-not-audit label.

### Tests

- [X] T059 [P] [US5] Add failing schema tests for `OverviewActivityQuery`, `OverviewActivityItem`, and paginated activity response, including invalid page/pageSize, unsupported event type, unsafe summary, malformed timestamp, and unapproved destination, in `src/features/overview/contracts.test.ts`
- [X] T060 [P] [US5] Add failing repository tests for `GET /api/v1/admin/overview/activity`, bounded pagination, platform/period filtering, empty, partial, forbidden, stale, and safe-error behavior in `src/features/overview/repository.test.ts`
- [X] T061 [P] [US5] Add failing component tests for sanitized event metadata, operational-not-audit labeling, contextual empty state, load-more behavior, permission-filtered links, and pagination reset after platform/period change in `src/app/admin/overview.test.tsx`
- [X] T062 [P] [US5] Extend `tests/e2e/overview-analytics.spec.ts` with a failing activity filtering/pagination/permission journey

### Implementation

- [X] T063 [US5] Implement the activity query, item, and paginated response schemas and inferred types in `src/features/overview/contracts.ts`; run the T059 tests
- [X] T064 [US5] Add sanitized fictional activity fixtures for registration, subscription upgrade, webhook failure, parser update, Admin-role change, support-access approval, and deletion completion in `src/mocks/fixtures/overview.ts`
- [X] T065 [US5] Add the validated `/api/v1/admin/overview/activity` handler with platform, period, pagination, empty, partial, stale, forbidden, and error scenarios in `src/mocks/handlers/overview.ts`
- [X] T066 [US5] Add `getOverviewActivity` and `useOverviewActivity` with bounded page size and selection-aware query keys in `src/features/overview/repository.ts` and `src/features/overview/hooks.ts`; reset to page 1 when platform or period changes
- [X] T067 [US5] Replace the current raw activity array rendering with the typed paginated hook, independent states, accessible load-more control, safe permitted destinations, and explicit operational-not-audit label in `src/app/admin/page.tsx`
- [X] T068 [US5] Run the US5 Vitest and Playwright tests from T059–T062 and record actual activity results in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

**Checkpoint**: User Story 5 is independently testable with bounded,
privacy-safe activity and no fabricated immutable audit behavior.

---

## Phase 8: Hardening and Verification

**Purpose**: Verify cross-story quality and record only evidence that actually
passed.

- [X] T069 [P] Run the fixture-boundary scan `rg -n "@/mocks/fixtures|@/data|data/admin" src/app src/components` and the strict-type scan `rg -n "\\bany\\b" src --glob "*.ts" --glob "*.tsx"`; review every match and record the result in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T070 [P] Run `rg -n "dangerouslySetInnerHTML|localStorage|sessionStorage" src` and `rg -n "NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD)" .`; review safe/test-only matches in context and record rendering, storage, environment, error/log, destination, dependency, and privacy findings in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T071 [P] Verify no dependency or lockfile change, no new route, no backend/runtime/provider/database code, and no later-phase workflow appears in the Spec 002 diff; record the scoped diff review in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T072 Verify Arabic RTL and English LTR, light and dark themes, at 1440px, 1280px, 1024px, 768px, and 390px; record zero-overflow and approved-design comparison evidence in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T073 Verify keyboard navigation, visible focus, semantic landmarks/lists, accessible names, chart summaries, contrast, non-color-only meaning, 44px touch targets, 200% text scaling, focus restoration, and reduced motion; record findings in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T074 Verify the complete platform-data matrix from `quickstart.md`, including unique/active/new invariants, qualifying-activity exclusions, registration attribution, multi-device behavior, unknown attribution, non-additive revenue, and Global health; record every scenario result in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T075 Verify loading, success, empty, partial, stale, invalid, rate-limited, unavailable, internal-error, warning, forbidden, session-expired, and regional-retry scenarios without sibling-region loss; record every result in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T076 Record the reference environment and measure primary Overview visibility against 2.5 seconds and local filter/period/refresh/retry/pagination/attention acknowledgement against 200 milliseconds; exclude deliberate slow mocks and record actual measurements in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T077 Run `npm run typecheck`; fix in-scope errors and record the successful command and exit code in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T078 Run `npm run lint`; fix in-scope warnings/errors and record the successful command and exit code in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T079 Run `npm run test`; fix in-scope failures and record the successful Vitest command, test count, and exit code in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T080 Run `npm run test:e2e`; fix in-scope failures and record the successful Playwright command, project/test count, and exit code in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T081 Run `npm run build`; fix in-scope failures and record the successful production-build command and exit code in `specs/002-admin-overview-and-platform-analytics/verification-report.md`
- [X] T082 Reconcile all 47 functional requirements, 17 acceptance criteria, and 11 success criteria against code/tests/evidence; record each mapping and any truthful unresolved item in `specs/002-admin-overview-and-platform-analytics/verification-report.md`

## Dependencies

### Phase order

```text
Phase 1 baseline
  → Phase 2 shared foundations
    → US1 combined Overview
      → US2 platform comparison
        → US3 platform adoption
      → US4 attention
      → US5 activity
        → Phase 8 hardening and verification
```

- Phase 1 blocks every edit.
- Phase 2 blocks every user story.
- US1 supplies the approved page-level summary and shared filter state required
  by US2.
- US2 supplies platform analytics and filtering required by US3.
- US4 and US5 depend on Phase 2 and the shared platform/period state completed
  in US1, but do not depend on each other.
- Phase 8 begins only after all five stories pass their checkpoints.

### User-story dependency table

| Story | Depends on | Independently shippable result |
|---|---|---|
| US1 | Phases 1–2 | Authoritative combined Overview |
| US2 | US1 | All/iOS/Android comparison |
| US3 | US2 | Platform adoption and version quality |
| US4 | Phase 2 and US1 filter state | Ordered permission-aware attention |
| US5 | Phase 2 and US1 filter state | Bounded privacy-safe activity |

## Parallel Execution Examples

Parallel work is optional. Never run two tasks that edit the same file at the
same time.

### Shared foundations

```text
T006 contracts tests
T007 UI-state tests
```

### User Story 1

```text
T015 contract tests
T016 repository tests
T017 component tests
T018 Playwright test
```

### User Story 2

```text
T028 contract tests
T029 repository tests
T030 component tests
T031 Playwright test
```

### User Story 3

```text
T040 contract tests
T041 component tests
T042 Playwright test
```

### User Story 4

```text
T049 schema/order tests
T050 repository tests
T051 component tests
T052 Playwright test
```

### User Story 5

```text
T059 contract tests
T060 repository tests
T061 component tests
T062 Playwright test
```

### Final review

```text
T069 fixture/type scan
T070 security/privacy scan
T071 scope/dependency diff review
```

## Implementation Strategy

### MVP first

Complete T001–T027. This delivers User Story 1: the authoritative combined
Overview with validated contracts, independent summary states, safe fictional
data, and preservation evidence.

### Incremental delivery

1. Complete the baseline and shared foundation.
2. Deliver US1 and pass its checkpoint.
3. Deliver US2, then US3, passing each checkpoint.
4. Deliver US4 and US5; they may be developed separately after the shared
   platform/period state exists.
5. Run the complete hardening phase and record truthful evidence.

### Scope controls

- Reuse existing files before adding a file.
- Add no dependency.
- Add no route.
- Add no backend or real authentication.
- Store no Overview data in browser storage.
- Render no raw HTML.
- Keep all customer and financial data aggregated.
- Do not mark T077–T081 complete unless the named command actually exits
  successfully.
