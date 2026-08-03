# Tasks: Admin Foundation and Design Preservation

**Input**: `specs/001-admin-foundation/spec.md`, `plan.md`,
`research.md`, `data-model.md`, `contracts/admin-foundation.openapi.yaml`, and
`quickstart.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required before changed behavior  
**Executor note**: Complete tasks in ID order unless `[P]` and the dependency
section explicitly allow parallel execution. Do not combine tasks or alter
files outside the named paths.

## Checklist Format

Every task uses:

```text
Task format: `TASK-ID [P-if-safe] [USn-in-story-phases] Explicit action with exact file path`
```

A task is complete only when its named file change exists and its stated
targeted check passes. Do not mark verification tasks complete from inference.

## Phase 1: Existing Project and Contract Review

**Purpose**: Record the approved baseline and add only the missing approved
tooling. Do not initialize or redesign the project.

- [X] T001 Create `specs/001-admin-foundation/baseline.md` listing the four approved routes, existing Admin components, CSS token groups, assets, current scripts, and the four direct fixture imports found in the inspected baseline.
- [X] T002 Add an approval-preservation checklist for light mode, dark compatibility, Arabic RTL, English LTR, and the five viewports to `specs/001-admin-foundation/baseline.md`.
- [X] T003 Record the installed dependency versions and the exact missing approved-stack dependency delta in `specs/001-admin-foundation/research.md`.
- [X] T004 Add `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, and `zod` without upgrading unrelated packages in `package.json` and `package-lock.json`.
- [X] T005 Add `msw`, `vitest`, `@vitest/coverage-v8`, `jsdom`, and `@playwright/test` without upgrading unrelated packages in `package.json` and `package-lock.json`.
- [X] T006 Replace the Node unit-test script with Vitest scripts and add `test:e2e` and `test:coverage` scripts in `package.json`.
- [X] T007 Create `vitest.config.ts` with strict project aliases, jsdom component environment, and `src/tests/setup.ts` setup-file resolution.
- [X] T008 Create `src/tests/setup.ts` with DOM cleanup, MSW server lifecycle hooks, and deterministic test defaults.
- [X] T009 Create `playwright.config.ts` with a production-build web server and projects for 1440px, 1280px, 1024px, 768px, and 390px.
- [X] T010 Generate the committed MSW browser worker at `public/mockServiceWorker.js` and confirm no credential or private configuration is embedded.

**Phase 1 checkpoint**: `npm install` succeeds from the lockfile, the new
scripts resolve, and no application route or visual file has changed.

---

## Phase 2: Shared Frontend Foundations

**Purpose**: Build the blocking transport, validation, permission, query, and
mock infrastructure used by every story.

- [X] T011 [P] Define the safe `ApiError` type, error-code union, and raw-error normalization boundary in `src/core/api/errors.ts`.
- [X] T012 [P] Define `Pagination`, `PaginatedResponse<T>`, page-size validation, and page bounds in `src/core/api/pagination.ts`.
- [X] T013 Define the shared request and response contract exports aligned with `contracts/admin-foundation.openapi.yaml` in `src/core/api/contracts.ts`.
- [X] T014 Implement one fetch-based JSON client that maps non-2xx responses through `ApiError` and never logs raw payloads in `src/core/api/client.ts`.
- [X] T015 [P] Define shared Zod schemas for identifiers, locale, direction, theme, environment, platform, dates, search text, and pagination in `src/core/validation/common.ts`.
- [X] T016 [P] Define exactly the six clarified `PermissionKey` values and seven `AdminRole` values in `src/core/permissions/permissions.ts`.
- [X] T017 Write failing Vitest cases for all seven roles, six permission keys, allowed routes, denied routes, and unknown keys in `src/core/permissions/role-map.test.ts`.
- [X] T018 Implement the clarified role-to-route matrix and `hasPermission` helper in `src/core/permissions/role-map.ts`.
- [X] T019 Define Zod schemas for `AdminSession`, `PlatformOption`, and `PlatformBreakdown`, including deduplicated-customer metric rules, in `src/features/foundation/schemas.ts`.
- [X] T020 Extend `src/features/foundation/schemas.ts` with navigation, attention, search query/result, date-range, and safe response-envelope schemas.
- [X] T021 Export schema-inferred foundation types and query inputs in `src/features/foundation/contracts.ts`.
- [X] T022 Define the read-only session, navigation, attention, search, and platform-options repository methods in `src/features/foundation/repository.ts`.
- [X] T023 Implement stable foundation query keys and TanStack Query hooks for the five repository methods in `src/features/foundation/hooks.ts`.
- [X] T024 Create a single per-browser-session `QueryClient` with explicit retry and stale-time defaults in `src/app/QueryProvider.tsx`.
- [X] T025 Wrap the existing root layout children with `QueryProvider` without changing `<html lang="ar" dir="rtl">` in `src/app/providers.tsx` and `src/app/layout.tsx`.
- [X] T026 Create deterministic scenario names and the default scenario registry in `src/mocks/scenarios/foundation.ts`.
- [X] T027 Create sanitized fictional session, navigation, attention, search, platform, iOS-only, Android-only, multi-platform, and multi-device fixtures in `src/mocks/fixtures/foundation.ts`.
- [X] T028 Implement validated session and platform-option MSW handlers in `src/mocks/handlers/session.ts` and `src/mocks/handlers/platform-options.ts`.
- [X] T029 Implement permission-filtered navigation, attention, and scoped-search MSW handlers in `src/mocks/handlers/navigation.ts`, `src/mocks/handlers/attention.ts`, and `src/mocks/handlers/search.ts`.
- [X] T030 Export the complete handler list and deterministic override helpers in `src/mocks/handlers/index.ts`.
- [X] T031 Create browser and Vitest MSW entrypoints in `src/mocks/browser.ts` and `src/mocks/server.ts`.
- [X] T032 Start the MSW browser worker only in development through `src/app/MockProvider.tsx`, then compose it with `QueryProvider` in `src/app/providers.tsx`.

**Phase 2 checkpoint**: `npm run typecheck` passes for the shared foundation,
and `npm run test -- src/core/permissions/role-map.test.ts` passes.

---

## Phase 3: User Story 1 — Preserve the Approved Admin Experience (P1)

**Goal**: Establish an automated preservation guard before data and shell
migrations.

**Independent test**: All four approved routes retain their hierarchy, palette,
typography, density, interactions, themes, directions, and responsive behavior.

### Tests

- [X] T033 [P] [US1] Write failing Playwright preservation assertions for `/admin`, `/admin/users`, `/admin/imports`, and `/admin/system-health` in `tests/e2e/visual-preservation.spec.ts`.
- [X] T034 [P] [US1] Write failing Vitest assertions for chart summaries and semantic chart color inputs in `src/components/admin/Charts.test.tsx`.

### Implementation

- [X] T035 [US1] Add semantic chart-series tokens for light and dark themes without altering approved values in `src/app/globals.css`.
- [X] T036 [US1] Replace hard-coded chart series and gradient colors with the new semantic tokens while preserving output in `src/components/admin/Charts.tsx`.
- [X] T037 [US1] Replace only affected inline raw semantic colors with existing tokens and leave layout values unchanged in `src/components/admin/ui.tsx`.
- [X] T038 [US1] Add baseline route/theme/direction/viewport expectations and approved exceptions to `specs/001-admin-foundation/baseline.md`.
- [X] T039 [US1] Run the targeted chart and preservation tests and record their command results in `specs/001-admin-foundation/baseline.md`.

**Phase 3 checkpoint**: `npm run test -- src/components/admin/Charts.test.tsx`
passes and the preservation suite has executable expectations for all four
routes.

---

## Phase 4: User Story 2 — Use a Consistent Operational Shell (P1)

**Goal**: Complete the functional Arabic-first shell without adding later-phase
business routes.

**Independent test**: The shell supports direction, themes, responsive
navigation, scoped search, attention, environment, role simulation, date range,
and route context at all approved viewports.

### Tests

- [X] T040 [P] [US2] Write failing Vitest cases for shell navigation, planned items, active route, role label, theme, direction, environment, and mobile drawer behavior in `src/components/admin/AdminShell.test.tsx`.
- [X] T041 [P] [US2] Write failing Playwright shell journeys for desktop, tablet, mobile, Arabic RTL, English LTR, light, and dark modes in `tests/e2e/foundation.spec.ts`.

### Implementation

- [X] T042 [P] [US2] Implement locale-to-direction mapping and document root updates in `src/core/localization/direction.ts`.
- [X] T043 [P] [US2] Add date-range input and ordering validation to `src/features/foundation/schemas.ts`.
- [X] T044 [P] [US2] Create the validated All/iOS/Android segmented control in `src/components/admin/PlatformFilter.tsx`.
- [X] T045 [P] [US2] Create route-derived Arabic/English breadcrumbs using logical direction behavior in `src/components/admin/Breadcrumbs.tsx`.
- [X] T046 [P] [US2] Create the persistent Production/Staging/Development indicator in `src/components/admin/EnvironmentIndicator.tsx`.
- [X] T047 [P] [US2] Create the clearly labeled development-only seven-role switcher in `src/components/admin/RoleSwitcher.tsx`.
- [X] T048 [P] [US2] Create the validated preset/custom date-range control in `src/components/admin/DateRangeControl.tsx`.
- [X] T049 [P] [US2] Create grouped permission-filtered search for Navigation, Users, Imports, and System Health in `src/components/admin/GlobalSearch.tsx`.
- [X] T050 [P] [US2] Create the permission-filtered notification and incident panel with loading, empty, error, and partial states in `src/components/admin/AttentionPanel.tsx`.
- [X] T051 [P] [US2] Create an accessible transient outcome region that does not replace persistent errors in `src/components/admin/ToastRegion.tsx`.
- [X] T052 [US2] Extend shared loading, empty, error, success, warning, conflict, unavailable, and access-denied components in `src/components/admin/ui.tsx`.
- [X] T053 [US2] Make `Drawer` and `ConfirmDialog` restore initiating focus and preserve Escape behavior in `src/components/admin/ui.tsx`.
- [X] T054 [US2] Replace the static shell navigation array with the typed navigation query while retaining the approved markup in `src/components/admin/AdminShell.tsx`.
- [X] T055 [US2] Integrate `GlobalSearch`, `AttentionPanel`, and permission-filtered results into `src/components/admin/AdminShell.tsx`.
- [X] T056 [US2] Integrate `EnvironmentIndicator`, `RoleSwitcher`, language direction, complete light/dark switching, profile, and date range into `src/components/admin/AdminShell.tsx`.
- [X] T057 [US2] Add responsive styles for new shell controls, drawer navigation, RTL/LTR, and 390px priority behavior in `src/app/globals.css`.
- [X] T058 [US2] Run the shell unit and browser suites and record the exact commands and results in `specs/001-admin-foundation/baseline.md`.

**Phase 4 checkpoint**: Shell tests pass without an active route for any
later-phase module.

---

## Phase 5: User Story 3 — Consume Replaceable Typed Mock Contracts (P1)

**Goal**: Migrate every data flow on all four approved pages behind typed
repositories and MSW without visual changes.

**Independent test**: All four pages load through HTTP-shaped mocks and contain
zero direct fixture imports.

### Contract Tests

- [X] T059 [P] [US3] Write failing schema and repository tests for overview success, partial, empty, platform, and error responses in `src/features/overview/repository.test.ts`.
- [X] T060 [P] [US3] Write failing schema and repository tests for users filters, masking, pagination, permission, empty, and error responses in `src/features/users/repository.test.ts`.
- [X] T061 [P] [US3] Write failing schema and repository tests for imports filters, sanitized results, pagination, conflict, empty, and error responses in `src/features/imports/repository.test.ts`.
- [X] T062 [P] [US3] Write failing schema and repository tests for service health, incidents, partial response, permission, empty, and error responses in `src/features/system-health/repository.test.ts`.

### Overview Migration

- [X] T063 [P] [US3] Define validated overview metrics, attention, services, activity, and chart response contracts in `src/features/overview/contracts.ts`.
- [X] T064 [P] [US3] Move the existing overview fixtures without duplication from `src/data/admin/overview.ts` to `src/mocks/fixtures/overview.ts`.
- [X] T065 [US3] Implement overview success, empty, slow, partial, forbidden, and internal-error handlers in `src/mocks/handlers/overview.ts`.
- [X] T066 [US3] Implement the overview HTTP repository against `/api/v1/admin/overview` in `src/features/overview/repository.ts`.
- [X] T067 [US3] Implement overview query keys and hooks with platform input in `src/features/overview/hooks.ts`.
- [X] T068 [US3] Replace direct overview fixture imports with the overview hook and shared states without changing approved markup in `src/app/admin/page.tsx`.

### Users Migration

- [X] T069 [P] [US3] Define validated user, filter, pagination, masking, and response contracts in `src/features/users/contracts.ts`.
- [X] T070 [P] [US3] Move the existing sanitized user fixtures without duplication from `src/data/admin/users.ts` to `src/mocks/fixtures/users.ts`.
- [X] T071 [US3] Implement users success, empty, large, slow, validation, forbidden, and internal-error handlers in `src/mocks/handlers/users.ts`.
- [X] T072 [US3] Implement the users HTTP repository against `/api/v1/admin/users` in `src/features/users/repository.ts`.
- [X] T073 [US3] Implement users query keys and hooks for validated filters and pagination in `src/features/users/hooks.ts`.
- [X] T074 [US3] Replace direct users fixture imports and local raw-array filtering with the users hook and TanStack Table state without changing approved markup in `src/app/admin/users/page.tsx`.

### Imports Migration

- [X] T075 [P] [US3] Define validated import metrics, records, filters, pagination, sanitized-result, and response contracts in `src/features/imports/contracts.ts`.
- [X] T076 [P] [US3] Move the existing sanitized import fixtures without duplication from `src/data/admin/imports.ts` to `src/mocks/fixtures/imports.ts`.
- [X] T077 [US3] Implement imports success, empty, slow, validation, forbidden, conflict, and internal-error handlers in `src/mocks/handlers/imports.ts`.
- [X] T078 [US3] Implement the imports HTTP repository against `/api/v1/admin/imports` in `src/features/imports/repository.ts`.
- [X] T079 [US3] Implement imports query keys, validated filters, and retry mutation lock in `src/features/imports/hooks.ts`.
- [X] T080 [US3] Replace direct imports fixture imports with the imports hooks and shared states without changing approved markup in `src/app/admin/imports/page.tsx`.

### System Health Migration

- [X] T081 [P] [US3] Define validated service, incident, chart, partial-response, and safe-error contracts in `src/features/system-health/contracts.ts`.
- [X] T082 [P] [US3] Move the existing system-health fixtures without duplication from `src/data/admin/system-health.ts` to `src/mocks/fixtures/system-health.ts`.
- [X] T083 [US3] Implement system-health success, empty, slow, partial, forbidden, provider-unavailable, and internal-error handlers in `src/mocks/handlers/system-health.ts`.
- [X] T084 [US3] Implement the system-health HTTP repository against `/api/v1/admin/system-health` in `src/features/system-health/repository.ts`.
- [X] T085 [US3] Implement system-health query keys, queries, and refresh mutation in `src/features/system-health/hooks.ts`.
- [X] T086 [US3] Replace direct system-health fixture imports with the system-health hooks and shared states without changing approved markup in `src/app/admin/system-health/page.tsx`.

### Migration Guard

- [X] T087 [US3] Add a Vitest source guard that fails on `src/data/admin` imports from pages or presentation components in `src/tests/no-direct-fixtures.test.ts`.
- [X] T088 [US3] Run all four repository tests plus the source guard and record exact results in `specs/001-admin-foundation/baseline.md`.

**Phase 5 checkpoint**: `rg -n "@/data|data/admin" src/app src/components`
returns no matches and the four routes pass their repository tests.

---

## Phase 6: User Story 4 — Simulate Permissions and Sensitive Actions Safely (P1)

**Goal**: Demonstrate privacy-safe, accessible UX controls without claiming
production authorization.

**Independent test**: Every clarified role receives only its allowed routes,
search results, attention items, and sensitive-action states.

### Tests

- [X] T089 [P] [US4] Write failing Playwright cases for all seven roles across the four-route permission matrix in `tests/e2e/permissions.spec.ts`.
- [X] T090 [P] [US4] Write failing Vitest cases for safe errors, masking, session expiry, pending locks, and confirmation audit metadata in `src/components/admin/security.test.tsx`.

### Implementation

- [X] T091 [P] [US4] Create a permission boundary that renders allowed, disabled, hidden, or access-denied states without claiming backend security in `src/components/admin/PermissionBoundary.tsx`.
- [X] T092 [P] [US4] Create an accessible missing-permission state with safe return action in `src/components/admin/AccessDenied.tsx`.
- [X] T093 [P] [US4] Create an accessible session-expired and temporary-access-expired state with unsaved-change warning in `src/components/admin/SessionExpired.tsx`.
- [X] T094 [P] [US4] Create a masking component that never exposes its raw value to presentation markup in `src/components/admin/MaskedField.tsx`.
- [X] T095 [P] [US4] Implement safe development logging that removes secrets, tokens, raw errors, paths, and private payloads in `src/core/api/safe-log.ts`.
- [X] T096 [P] [US4] Implement a typed pending-state lock that rejects duplicate sensitive mutations in `src/features/foundation/useLockedMutation.ts`.
- [X] T097 [US4] Require scope, consequence, permission, future audit event, pending, success, failure, and conflict data in `ConfirmDialog` within `src/components/admin/ui.tsx`.
- [X] T098 [US4] Apply role filtering to navigation, global search, and attention repository results in `src/features/foundation/repository.ts`.
- [X] T099 [US4] Map session and temporary-access expiry to protected-content removal in `src/features/foundation/hooks.ts`.
- [X] T100 [US4] Display the development-only security disclaimer beside role simulation in `src/components/admin/AdminShell.tsx`.
- [X] T101 [US4] Add unsafe input, private payload, duplicate submission, denied result, and expired session browser scenarios to `tests/e2e/permissions.spec.ts`.
- [X] T102 [US4] Run the permission and security suites and record exact results in `specs/001-admin-foundation/baseline.md`.

**Phase 6 checkpoint**: Permission and security tests pass; client controls are
labeled as UX simulation and no sensitive value appears unmasked.

---

## Phase 7: User Story 5 — Verify an Accessible, Responsive Foundation (P2)

**Goal**: Provide repeatable evidence for the complete shared foundation.

**Independent test**: Automated and manual checks cover every route, viewport,
theme, direction, state, accessibility rule, and performance gate.

### Tests and Verification Assets

- [X] T103 [P] [US5] Convert the existing utility assertions from Node test APIs to Vitest without changing their expected behavior in `src/lib/admin.test.ts`.
- [X] T104 [P] [US5] Add explicit viewport names, screenshot settings, reduced-motion defaults, and retry policy to `playwright.config.ts`.
- [X] T105 [P] [US5] Add success, loading, empty, error, partial, conflict, forbidden, and unavailable route-state journeys in `tests/e2e/foundation.spec.ts`.
- [X] T106 [P] [US5] Add Arabic RTL, English LTR, light, and dark coverage for all four routes in `tests/e2e/visual-preservation.spec.ts`.
- [X] T107 [P] [US5] Add keyboard order, drawer/dialog focus restoration, Escape, touch-target, and reduced-motion checks in `tests/e2e/accessibility.spec.ts`.
- [X] T108 [P] [US5] Add accessible-name, status-not-color-only, table-header, masked-field, and chart-summary checks in `tests/e2e/accessibility.spec.ts`.
- [X] T109 [P] [US5] Add the documented 2.5-second shell visibility and 200-millisecond interaction acknowledgement measurements in `tests/e2e/performance.spec.ts`.
- [X] T110 [US5] Fail browser journeys on new console errors, page errors, raw exception text, or private payload markers in `tests/e2e/foundation.spec.ts`.
- [X] T111 [US5] Update exact commands, resolved dependency versions, reference environment fields, and expected evidence locations in `specs/001-admin-foundation/quickstart.md`.

**Phase 7 checkpoint**: All verification suites are defined and independently
runnable; no result is claimed until Final Phase commands run.

---

## Final Phase: Hardening and Evidence

**Purpose**: Execute every required gate and record real results.

- [X] T112 Run `rg -n "@/data|data/admin" src/app src/components` and record the required zero-match result in `specs/001-admin-foundation/verification-report.md`.
- [X] T113 Run `npm run typecheck` and record command, timestamp, exit code, and summary in `specs/001-admin-foundation/verification-report.md`.
- [X] T114 Run `npm run lint` and record command, timestamp, exit code, and summary in `specs/001-admin-foundation/verification-report.md`.
- [X] T115 Run `npm run test` and record Vitest totals, failures, timestamp, and exit code in `specs/001-admin-foundation/verification-report.md`.
- [X] T116 Run `npm run test:e2e` and record Playwright project totals, failures, timestamp, and exit code in `specs/001-admin-foundation/verification-report.md`.
- [X] T117 Run `npm run build` and record command, timestamp, exit code, MSW production-inactivity evidence, and summary in `specs/001-admin-foundation/verification-report.md`.
- [X] T118 Complete the four-route × five-viewport × two-theme × two-direction design-preservation matrix and record each result in `specs/001-admin-foundation/verification-report.md`.
- [X] T119 Complete the keyboard, screen-reader, focus, contrast, reduced-motion, table, chart-summary, masked-field, warning, and denial review in `specs/001-admin-foundation/verification-report.md`.
- [X] T120 Complete the sensitive-data, validation, rendering, storage, public-environment, redirect, link, error, log, duplicate-submission, dependency, and deferred-backend security review in `specs/001-admin-foundation/verification-report.md`.
- [X] T121 Verify all four routes open without runtime or console errors and record the route-by-route evidence in `specs/001-admin-foundation/verification-report.md`.
- [X] T122 Map FR-001–FR-040, AC-001–AC-016, and SC-001–SC-009 to passing evidence or an explicit failure in `specs/001-admin-foundation/verification-report.md`; do not mark Phase 0 complete while any required item lacks successful evidence.

## Dependencies

### Phase dependencies

```text
Phase 1 (T001–T010)
  → Phase 2 (T011–T032)
    → US1 preservation guard (T033–T039)
      ├→ US2 shell (T040–T058)
      └→ US3 four-page migration (T059–T088)
           └→ US4 permissions/security (T089–T102)
                └→ US5 verification assets (T103–T111)
                     └→ Final evidence (T112–T122)
```

- T004 and T005 are sequential because both update `package.json` and
  `package-lock.json`.
- T018 follows T016–T017.
- T022 follows T013–T021; T023 follows T022.
- T025 follows T024; T032 follows T024–T031.
- US1 must establish preservation tests before any page or shell migration.
- US2 and the contract-test portion of US3 may proceed in parallel after US1.
- Each page migration order is contract → fixture move → handler → repository
  → hook → page.
- US4 follows shell and page migration because it applies permissions to both.
- US5 follows all changed behavior; Final Phase follows all test assets.

### User-story independence

- **US1**: Independently demonstrates that approved visuals have executable
  preservation guards.
- **US2**: Independently demonstrates a functional shell using foundation mock
  contracts without later business routes.
- **US3**: Independently demonstrates all four pages using replaceable typed
  mock HTTP boundaries with zero direct fixtures.
- **US4**: Independently demonstrates the clarified role matrix, masking,
  expiry, confirmation, and duplicate-submission safeguards.
- **US5**: Independently demonstrates repeatable quality evidence across the
  complete foundation.

## Parallel Execution Examples

### US1

After T032, run T033 and T034 in parallel because they touch separate browser
and component-test files. T035 must precede T036.

### US2

After T041, T042–T051 may run in parallel because each creates a distinct
utility or component. T052–T057 then run sequentially where shared files
overlap.

### US3

Run T059–T062 in parallel. After those tests exist, the Overview, Users,
Imports, and System Health contract/fixture tasks marked `[P]` may run in
parallel. Within each feature, preserve the listed handler → repository → hook
→ page order.

### US4

After T089–T090, T091–T096 may run in parallel. T097–T101 then integrate those
boundaries sequentially.

### US5

T103–T109 may run in parallel where their target files are distinct. Run T110
after T105 because both edit `tests/e2e/foundation.spec.ts`.

## Implementation Strategy

### Minimum reviewable increment

Complete T001–T039. This establishes the approved dependency/test foundation,
shared data boundary, and preservation guard without migrating business data.
It is reviewable but does not complete Phase 0.

### Complete Phase 0

1. Complete shared foundations.
2. Establish preservation tests.
3. Complete the shell.
4. Migrate each approved route independently.
5. Apply permission and security controls.
6. Add verification assets.
7. Execute and record every final gate.

Do not begin Spec 002 until T122 has evidence for every required Spec 001
criterion.
