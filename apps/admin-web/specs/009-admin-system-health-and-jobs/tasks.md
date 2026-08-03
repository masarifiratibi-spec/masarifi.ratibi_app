# Tasks: System Health, External Providers, Jobs, and Queues

**Input**: `specs/009-admin-system-health-and-jobs/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Execution audience**: Tasks are deliberately small and explicit for a lower-cost implementation model.

## Execution Rules

- Execute tasks in ID order unless the task carries `[P]` and its listed dependencies are complete.
- Edit only the paths named by the current task. If another file is required, stop and update this ledger first.
- Test-first tasks must be run before implementation and must fail for the named missing behavior, not for syntax or setup errors.
- Implementation tasks are complete only when their named focused command exits 0.
- Preserve the approved `/admin/system-health` visual identity; do not redesign it or initialize a project.
- Use only installed dependencies. Do not implement real monitoring, providers, Redis, BullMQ, workers, schedules, storage, backend, database, or authentication.
- Never mark a verification task complete without recording its actual command, exit code, and result in `specs/009-admin-system-health-and-jobs/verification-report.md`.

## Phase 1: Existing Project and Contract Review

**Purpose**: Confirm the implementation starts in the correct feature context and that planned reuse points still match the working tree.

- [X] T001 Verify `.specify/feature.json` points to `specs/009-admin-system-health-and-jobs` and `git branch --show-current` reports the intended Spec 009 implementation branch; stop before editing if the Git branch is still `001-admin-foundation`
- [X] T002 [P] Review the existing Phase 8 seed in `src/features/system-health/contracts.ts`, `src/features/system-health/repository.ts`, `src/features/system-health/hooks.ts`, `src/app/admin/system-health/page.tsx`, `src/mocks/fixtures/system-health.ts`, and `src/mocks/handlers/system-health.ts`; verify every reusable or replaceable boundary is already captured in `specs/009-admin-system-health-and-jobs/plan.md`
- [X] T003 [P] Validate `specs/009-admin-system-health-and-jobs/contracts/admin-system-health-jobs.openapi.yaml` with `node` plus `js-yaml`; verify 11 unique operations and all local `$ref` targets resolve before source edits
- [X] T004 Run baseline `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` from `apps/admin-web`; create `specs/009-admin-system-health-and-jobs/verification-report.md` with each command, exit code, exact pass/fail/skip counts, build routes, warnings, and any pre-existing failure

**Gate**: Do not begin Phase 2 on the wrong branch or with an unexplained baseline failure.

---

## Phase 2: Frontend Foundations

**Purpose**: Establish shared permissions, route rules, contract primitives, query behavior, and fixture boundaries required by every story.

### Test-first foundation

- [X] T005 [P] Add failing Phase 8 permission-matrix tests in `src/core/permissions/role-map.phase8.test.ts` for Super Admin, Security Administrator, Billing Operator, Import Operator, AI Operator, Content Manager, and Support Agent; run `npm run test -- src/core/permissions/role-map.phase8.test.ts` and confirm failures name missing Phase 8 permissions
- [X] T006 [P] Add failing route-resolution tests in `src/components/admin/shell-state.test.ts` for all nine static/dynamic Phase 8 routes, longest-match ordering, malformed `JOB-` IDs, and denied unmatched paths; run `npm run test -- src/components/admin/shell-state.test.ts` and confirm only Phase 8 cases fail
- [X] T007 [P] Add failing shared-contract tests in `src/features/system-health/contracts.test.ts` for `OperationalRange`, `PlatformScope`, `Freshness`, `MetricValue`, pagination, operational IDs, 120-character search, 10–500-character reasons, Unicode NFC, control/bidi rejection, strict unknown-field rejection, and safe errors; run `npm run test -- src/features/system-health/contracts.test.ts` and confirm red Phase 8 cases
- [X] T008 [P] Add failing hook-policy tests in `src/features/system-health/hooks.test.ts` for role-scoped `['phase8-system-health']` keys, 60-second visible/online refetch, hidden/offline/pending-dialog pause, manual refetch, and no legacy refresh POST; run `npm run test -- src/features/system-health/hooks.test.ts` and confirm red Phase 8 cases

### Foundation implementation

- [X] T009 Add `system-health.api.read`, `system-health.database.read`, `system-health.storage.read`, `system-health.providers.read`, `jobs.queues.read`, `jobs.runs.read`, `jobs.runs.retry`, `jobs.runs.cancel`, and `jobs.schedules.read` to `src/core/permissions/permissions.ts`; verify `npm run test -- src/core/permissions/role-map.phase8.test.ts` still fails only on role assignments
- [X] T010 Implement the exact Spec 009 role/queue/provider permission matrix in `src/core/permissions/role-map.ts` without widening prior permissions; verify `npm run test -- src/core/permissions/role-map.phase8.test.ts` exits 0
- [X] T011 Register `/admin/jobs/runs/[jobRunId]` validation and specific Phase 8 route rules before broad `/admin/system-health` and `/admin/jobs` prefixes in `src/components/admin/shell-state.ts`; verify `npm run test -- src/components/admin/shell-state.test.ts` exits 0
- [X] T012 Add failing navigation visibility tests for the active Jobs entry and role-filtered Phase 8 destinations in `src/components/admin/AdminShell.test.tsx`; run `npm run test -- src/components/admin/AdminShell.test.tsx` and confirm only new navigation assertions fail
- [X] T013 Activate the existing planned Jobs navigation item and add authorized Phase 8 destinations in `src/mocks/fixtures/foundation.ts`; verify `npm run test -- src/components/admin/AdminShell.test.tsx` exits 0 and prior navigation tests remain green
- [X] T014 Add Arabic and English breadcrumb labels for all static Phase 8 paths and the job-run detail fallback in `src/components/admin/Breadcrumbs.tsx`; verify `npm run test -- src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts` exits 0
- [X] T015 Replace the legacy string health primitives with strict shared Phase 8 Zod schemas and inferred types in `src/features/system-health/contracts.ts`; verify `npm run test -- src/features/system-health/contracts.test.ts` exits 0 for the shared-contract cases from T007
- [X] T016 Implement the shared Phase 8 query-key factory and refetch-policy helper in `src/features/system-health/hooks.ts` using existing TanStack Query options and no timer abstraction; verify `npm run test -- src/features/system-health/hooks.test.ts` exits 0 for T008 cases
- [X] T017 Extend `src/tests/no-direct-fixtures.test.ts` so `src/app/admin/system-health`, `src/app/admin/jobs`, and `src/features/system-health` cannot import `src/mocks/fixtures` or mutable mock state; run `npm run test -- src/tests/no-direct-fixtures.test.ts` and verify exit 0

**Gate**: `npm run test -- src/core/permissions/role-map.phase8.test.ts src/components/admin/shell-state.test.ts src/components/admin/AdminShell.test.tsx src/features/system-health/contracts.test.ts src/features/system-health/hooks.test.ts src/tests/no-direct-fixtures.test.ts` exits 0 before any user-story page work.

---

## Phase 3: User Story 1 — Assess Platform Health (P1)

**Goal**: Let authorized operators scan all 12 service states, distinguish fresh/stale/unknown observations, apply fixed operational ranges, and follow authorized incidents without changing global health by mobile platform.

**Independent test**: Load the degraded scenario at `/admin/system-health`, identify the degraded service and safe impact, switch 1h/24h/7d/30d, open an authorized incident, return with filters preserved, and verify missing/reversed/expired freshness becomes Unknown/Unknown/stale.

### Test-first implementation

- [X] T018 [P] [US1] Add failing health-overview schema tests in `src/features/system-health/contracts.test.ts` for exactly 12 services, authoritative status, units, completeness, incident references, platform-impact-only breakdowns, `observedAt < staleAt`, partial responses, and unavailable-not-zero behavior; run `npm run test -- src/features/system-health/contracts.test.ts` and confirm red US1 cases
- [X] T019 [P] [US1] Add failing health-overview component tests in `src/features/system-health/OperationsViews.test.tsx` for loading, default, empty, partial, stale, unknown, error, permission, range URL state, platform-global invariance, manual refresh, accessible summaries, and non-color status; run `npm run test -- src/features/system-health/OperationsViews.test.tsx` and confirm red US1 cases
- [X] T020 [US1] Add a failing US1 Playwright scenario in `tests/e2e/system-health-jobs.spec.ts` covering the independent test, keyboard navigation, Arabic RTL, representative English LTR, and 390px urgent monitoring; run `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US1"` and confirm failure is missing US1 behavior

### Contracts, data, and transport

- [X] T021 [US1] Implement `HealthStatus`, `ServiceHealthSummary`, `HealthOverview`, incident reference, platform-impact, and health query/response schemas in `src/features/system-health/contracts.ts`; verify `npm run test -- src/features/system-health/contracts.test.ts` passes all US1 schema cases
- [X] T022 [US1] Replace legacy health strings with sanitized fictional fixtures for all 12 services, four ranges, All/iOS/Android/Unknown impact, complete/partial/stale/unknown/empty scenarios, and fixed timestamps in `src/mocks/fixtures/system-health.ts`; verify `npm run test -- src/features/system-health/contracts.test.ts` validates every exported US1 fixture
- [X] T023 [US1] Add failing repository/handler tests for GET `/api/v1/admin/system-health/overview` query encoding, role projection, scenario errors, and response validation in `src/features/system-health/repository.test.ts`; run `npm run test -- src/features/system-health/repository.test.ts` and confirm red US1 cases
- [X] T024 [US1] Implement `getHealthOverview()` with validated range/platform/scenario serialization in `src/features/system-health/repository.ts`; verify repository tests fail only because the overview handler is incomplete
- [X] T025 [US1] Replace the legacy overview GET shape with GET `/api/v1/admin/system-health/overview` in `src/mocks/handlers/system-health.ts`, validating role/query/scenario and projecting only authorized references; verify `npm run test -- src/features/system-health/repository.test.ts` exits 0 for US1
- [X] T026 [US1] Add `useHealthOverview()` to `src/features/system-health/hooks.ts` using the Phase 8 key/refetch policy and manual `refetch`; verify `npm run test -- src/features/system-health/hooks.test.ts` exits 0 for overview polling and pause/resume

### UI and route

- [X] T027 [US1] Implement the Phase 8 operational range control and `HealthOverviewView` in `src/features/system-health/OperationsViews.tsx`, reusing approved cards/charts/badges/states and rendering freshness/units/plain summaries without redesign; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx` exits 0 for US1
- [X] T028 [US1] Replace inline data/UI logic in `src/app/admin/system-health/page.tsx` with a thin render of `HealthOverviewView`; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx src/tests/no-direct-fixtures.test.ts` exits 0
- [X] T029 [US1] Make the US1 Playwright scenario green without broadening scope in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US1"` exits 0

**Checkpoint**: User Story 1 is an independently runnable MVP.

---

## Phase 4: User Story 2 — Diagnose API, Database, and Storage Degradation (P1)

**Goal**: Let authorized operators inspect safe API, database, and storage indicators without raw requests, SQL, paths, objects, files, or customer data.

**Independent test**: Load a partial-outage scenario, move from overview to the affected API/database/storage route, identify its leading safe signal and linked incident, and verify prohibited diagnostic content never appears.

### Test-first implementation

- [X] T030 [P] [US2] Add failing API/database/storage schema tests in `src/features/system-health/contracts.test.ts` for metric series, endpoint groups, status-code denominators, slow-query groups, backup/recovery/cleanup states, bounded item counts, safe references, and prohibited raw fields; run `npm run test -- src/features/system-health/contracts.test.ts` and confirm red US2 cases
- [X] T031 [P] [US2] Add failing API/database/storage component tests in `src/features/system-health/OperationsViews.test.tsx` for loading/empty/partial/stale/error/permission states, explicit units, chart summaries, safe flat groups, and desktop-required behavior; run `npm run test -- src/features/system-health/OperationsViews.test.tsx` and confirm red US2 cases
- [X] T032 [US2] Append a failing US2 Playwright scenario to `tests/e2e/system-health-jobs.spec.ts` for the independent test plus keyboard/focus, RTL/LTR, and sensitive-content absence; run `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US2"` and confirm failure is missing US2 routes/content

### Contracts, data, and transport

- [X] T033 [US2] Implement `ApiMonitoring`, `EndpointGroup`, `StatusCodeCount`, `DatabaseMonitoring`, `SlowQueryGroup`, and `StorageMonitoring` schemas in `src/features/system-health/contracts.ts`; verify `npm run test -- src/features/system-health/contracts.test.ts` passes US2 cases
- [X] T034 [US2] Add sanitized four-range API/database/storage fixtures and partial/stale/unavailable scenarios to `src/mocks/fixtures/system-health.ts`, excluding raw query strings, path IDs, SQL, parameters, hosts, filenames, object keys, URLs, checksums, and contents; verify contract tests validate every US2 fixture
- [X] T035 [US2] Add failing repository/handler tests for GET `/system-health/api`, `/system-health/database`, and `/system-health/storage` in `src/features/system-health/repository.test.ts`; run `npm run test -- src/features/system-health/repository.test.ts` and confirm red US2 cases
- [X] T036 [US2] Implement the three validated GET methods in `src/features/system-health/repository.ts`; verify repository tests now fail only on missing handlers
- [X] T037 [US2] Implement the three read-only MSW GET handlers with permission checks, fixed range, scenario support, and safe responses in `src/mocks/handlers/system-health.ts`; verify `npm run test -- src/features/system-health/repository.test.ts` exits 0 for US2
- [X] T038 [US2] Add `useApiMonitoring()`, `useDatabaseMonitoring()`, and `useStorageMonitoring()` to `src/features/system-health/hooks.ts` with the shared refetch policy; verify `npm run test -- src/features/system-health/hooks.test.ts` exits 0

### UI and routes

- [X] T039 [US2] Implement `ApiMonitoringView`, `DatabaseMonitoringView`, and `StorageMonitoringView` in `src/features/system-health/OperationsViews.tsx` with approved chart/table/card patterns, safe text, explicit unavailable states, and authorized incident links; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx` exits 0 for US2
- [X] T040 [US2] Create thin route files `src/app/admin/system-health/api/page.tsx`, `src/app/admin/system-health/database/page.tsx`, and `src/app/admin/system-health/storage/page.tsx`; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx src/components/admin/shell-state.test.ts` exits 0
- [X] T041 [US2] Make the US2 Playwright scenario green in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US2"` exits 0

**Checkpoint**: US2 works independently with only safe diagnostic projections.

---

## Phase 5: User Story 3 — Review External Provider Health (P1)

**Goal**: Let authorized roles compare Stripe, AI, Email, Push, and Exchange Rates health and fallback state through least-privilege projections.

**Independent test**: Filter provider categories and states, identify one degraded provider's global status and attributable impact, and verify each domain role receives only assigned providers with no configuration or secrets.

### Test-first implementation

- [X] T042 [P] [US3] Add failing provider schema tests in `src/features/system-health/contracts.test.ts` for five categories, status, latency/error metrics, last success/check, freshness, capabilities, fallback state, safe errors, platform impact, access projection, pagination, and forbidden configuration fields; run the focused contract test and confirm red US3 cases
- [X] T043 [P] [US3] Add failing provider component tests in `src/features/system-health/OperationsViews.test.tsx` for category/status filters, All/iOS/Android impact, global availability invariance, partial/error/permission states, domain projections, non-color status, and no mutation controls; run the focused component test and confirm red US3 cases
- [X] T044 [US3] Append a failing US3 Playwright scenario to `tests/e2e/system-health-jobs.spec.ts` for Super Admin, Billing, AI, Content, denied roles, safe errors, keyboard, and 390px provider monitoring; run with `--grep "US3"` and confirm red behavior

### Contracts, data, and transport

- [X] T045 [US3] Implement `ProviderCategory`, `FallbackState`, `ProviderHealthSummary`, provider query, and paginated response schemas in `src/features/system-health/contracts.ts`; verify focused contract tests pass US3
- [X] T046 [US3] Add sanitized Stripe/AI/Email/Push/Exchange Rates fixtures, attributable impact, role assignments, complete/partial/stale/unavailable cases, and no credentials/configuration fields to `src/mocks/fixtures/system-health.ts`; verify focused contract tests validate all provider fixtures
- [X] T047 [US3] Add failing GET `/system-health/providers` repository/handler tests for query encoding, 25/50/100 pagination, sorting, structural role projection, forbidden access, and safe provider-unavailable errors in `src/features/system-health/repository.test.ts`; confirm red US3 cases
- [X] T048 [US3] Implement `listProviderHealth()` in `src/features/system-health/repository.ts` and `useProviderHealth()` in `src/features/system-health/hooks.ts`; verify repository tests fail only on missing handler behavior
- [X] T049 [US3] Implement the provider GET handler and explicit full/domain/denied projections in `src/mocks/handlers/system-health.ts`; verify `npm run test -- src/features/system-health/repository.test.ts src/features/system-health/hooks.test.ts` exits 0 for US3

### UI and route

- [X] T050 [US3] Implement `ProviderHealthView` in `src/features/system-health/OperationsViews.tsx` with responsive table/card views, filters, fallback/impact states, safe errors, and no edit/configuration controls; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx` exits 0 for US3
- [X] T051 [US3] Create thin `src/app/admin/system-health/providers/page.tsx`; verify route and no-direct-fixture tests exit 0
- [X] T052 [US3] Make the US3 Playwright scenario green in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US3"` exits 0

**Checkpoint**: US3 exposes provider health only, never provider administration.

---

## Phase 6: User Story 4 — Find and Explain Queue Backlogs (P1)

**Goal**: Let authorized roles compare all seven queues, search/filter job runs, open safe detail by correlation ID, and preserve global versus mobile-attributable semantics.

**Independent test**: Load a backlog scenario, identify the affected queue, filter Failed/Delayed runs, find `JOB-DEMO-FAILED-01` by correlation ID, open its safe detail in under two minutes, and verify unauthorized run existence is not disclosed.

### Test-first implementation

- [X] T053 [P] [US4] Add failing queue/job read-model tests in `src/features/system-health/contracts.test.ts` for seven `QueueKey` values, six counters with snapshot/range semantics, `JobState` without Retried, run IDs, attempts, correlation IDs, platform/app version, versions, retry lineage, flat metadata, timeline ordering, allowed actions, and pagination; run focused contract tests and confirm red US4 cases
- [X] T054 [P] [US4] Add failing deterministic read-state tests in `src/mocks/phase8-system-health-state.test.ts` for initial job records, fixed clock, reset, queue derivation, oldest waiting age, selected-range history, platform filtering, and unavailable data; run the focused state test and confirm red US4 cases
- [X] T055 [P] [US4] Add failing queue/job component tests in `src/features/system-health/OperationsViews.test.tsx` for queue cards, counter semantics, filters, pagination, safe detail links, loading/empty/partial/stale/error/permission states, global/platform behavior, and responsive table/cards; run focused tests and confirm red US4 cases
- [X] T056 [US4] Append a failing US4 Playwright scenario to `tests/e2e/system-health-jobs.spec.ts` for the independent test, domain projection, forbidden direct detail, keyboard, RTL/LTR, and 390px backlog/job lookup; run with `--grep "US4"` and confirm red behavior

### Contracts, state, and transport

- [X] T057 [US4] Implement `QueueKey`, `JobState`, `QueueCounters`, `QueueSnapshot`, `JobRunSummary`, `SafeMetadataEntry`, `JobTimelineEntry`, `JobRunDetail`, and paginated query/response schemas in `src/features/system-health/contracts.ts`; verify focused contract tests pass US4
- [X] T058 [US4] Add sanitized initial jobs, queue range-history values, queue-specific metadata allowlists, timeline entries, platform/app-version cases, and safe linked domain references to `src/mocks/fixtures/system-health.ts`; verify contract tests reject every prohibited metadata/payload example
- [X] T059 [US4] Implement fixed-clock job reads, reset, filtering, pagination, and queue snapshot derivation in `src/mocks/phase8-system-health-state.ts`; verify `npm run test -- src/mocks/phase8-system-health-state.test.ts` exits 0 for US4 read-state cases
- [X] T060 [US4] Add failing repository/handler tests for GET `/jobs/queues`, `/jobs/runs`, and `/jobs/runs/{jobRunId}` with query encoding, sorting, structural role/queue projection, malformed IDs, forbidden/not-found privacy, partial/stale, and safe errors in `src/features/system-health/repository.test.ts`; confirm red US4 cases
- [X] T061 [US4] Implement `listQueueHealth()`, `listJobRuns()`, and `getJobRun()` in `src/features/system-health/repository.ts`; verify repository tests now fail only on missing handler behavior
- [X] T062 [US4] Implement the three read-only job/queue handlers with specific detail matching before parameterized action paths in `src/mocks/handlers/system-health.ts`; verify `npm run test -- src/features/system-health/repository.test.ts src/mocks/phase8-system-health-state.test.ts` exits 0 for US4
- [X] T063 [US4] Add `useQueueHealth()`, `useJobRuns()`, and `useJobRun()` to `src/features/system-health/hooks.ts` using role/range/platform/filter-aware keys; verify `npm run test -- src/features/system-health/hooks.test.ts` exits 0 for US4

### UI and routes

- [X] T064 [US4] Implement `QueueOverviewView` and `JobRunsView` in `src/features/system-health/OperationsViews.tsx` with exact counter semantics, filters, safe links, responsive table/cards, chart/text summaries, and complete region states; verify focused component tests pass US4
- [X] T065 [US4] Implement read-only safe job detail rendering in `src/features/system-health/JobRunDetailView.tsx`, including flat metadata, timeline, attempt links, correlation ID, and authorized references but no actions yet; verify focused component tests pass the US4 detail assertions
- [X] T066 [US4] Create thin `src/app/admin/jobs/queues/page.tsx`, `src/app/admin/jobs/runs/page.tsx`, and `src/app/admin/jobs/runs/[jobRunId]/page.tsx`; verify route, component, and no-direct-fixture tests exit 0
- [X] T067 [US4] Make the US4 Playwright scenario green in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US4"` exits 0

**Checkpoint**: US4 provides complete read-only queue and job investigation before any recovery action exists.

---

## Phase 7: User Story 5 — Safely Simulate Job Recovery (P1)

**Goal**: Let an authorized queue operator retry one Failed job into one linked Waiting attempt or cancel one Waiting/Delayed job with confirmation, lock, safe conflict handling, and planned audit evidence.

**Independent test**: Retry `JOB-DEMO-FAILED-01`, verify the source remains Failed and exactly one linked Waiting attempt appears, then submit duplicate/stale retries and verify no second attempt; cancel eligible Waiting/Delayed jobs and reject every ineligible state.

### Test-first implementation

- [X] T068 [P] [US5] Add failing retry/cancel request/result schema tests in `src/features/system-health/contracts.test.ts` for expected version, 10–500 trimmed NFC reason, control/bidi/markup rejection, submission key, immutable retry source, linked Waiting run, Cancelled result, queue result, safe outcome, and audit reference; run focused contract tests and confirm red US5 cases
- [X] T069 [P] [US5] Add failing transition tests in `src/mocks/phase8-system-health-state.test.ts` for Failed retry, attempt +1, `retryOfJobRunId`, one submission result, Waiting/Delayed cancellation, version increment, queue recomputation, deterministic IDs/time/audit, stale/duplicate/concurrent/ineligible/terminal/unauthorized rejection, and reset; run focused state tests and confirm red US5 cases
- [X] T070 [P] [US5] Add failing action-dialog tests in `src/features/system-health/OperationsViews.test.tsx` for permission visibility, scope/consequence, reason validation, confirmation, pending lock, refetch pause, safe success/error/live announcement, focus restoration, and refreshed detail/queue state; run focused component tests and confirm red US5 cases
- [X] T071 [US5] Append a failing US5 Playwright scenario to `tests/e2e/system-health-jobs.spec.ts` for the independent test, direct forbidden mutation, duplicate click, stale version, safe errors, keyboard dialog flow, and 390px action usability; run with `--grep "US5"` and confirm red behavior

### Contracts, state, and transport

- [X] T072 [US5] Implement `JobActionRequest`, `ActionOutcome`, `RetryJobResult`, and `CancelJobResult` schemas in `src/features/system-health/contracts.ts`; verify focused contract tests pass US5
- [X] T073 [US5] Implement explicit `retryJobRun()` and `cancelJobRun()` transitions, deterministic counters/audit references, expected-version checks, reason normalization, and submission-result deduplication in `src/mocks/phase8-system-health-state.ts`; verify `npm run test -- src/mocks/phase8-system-health-state.test.ts` exits 0 for US5
- [X] T074 [US5] Add failing repository/handler tests for POST `/jobs/runs/{jobRunId}/retry` and `/cancel`, including payload validation, queue-scoped permission, 403/404 privacy, 409 stale/duplicate/ineligible conflicts, and response parsing in `src/features/system-health/repository.test.ts`; confirm red US5 cases
- [X] T075 [US5] Implement `retryJobRun()` and `cancelJobRun()` repository methods in `src/features/system-health/repository.ts`; verify repository tests fail only on missing action handlers
- [X] T076 [US5] Implement retry/cancel MSW handlers after the specific detail route, validate before state access, apply queue-scoped authorization, and return safe results/errors in `src/mocks/handlers/system-health.ts`; verify repository and state tests exit 0 for US5
- [X] T077 [US5] Add locked `useRetryJobRun()` and `useCancelJobRun()` mutations to `src/features/system-health/hooks.ts` with `job-run:id:action` keys and targeted job/detail/queue invalidation; verify `npm run test -- src/features/system-health/hooks.test.ts` exits 0 for pending-lock and invalidation cases

### UI and end-to-end flow

- [X] T078 [US5] Add retry/cancel controls and the accessible confirmation/reason dialog to `src/features/system-health/JobRunDetailView.tsx`, reusing `useLockedMutation` behavior and existing dialog/focus patterns; verify `npm run test -- src/features/system-health/OperationsViews.test.tsx` exits 0 for US5
- [X] T079 [US5] Make the US5 Playwright scenario green in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US5"` exits 0

**Checkpoint**: US5 changes deterministic mock state only and cannot duplicate or broaden a job action.

---

## Phase 8: User Story 6 — Review Scheduled Processing (P2)

**Goal**: Let authorized roles inspect assigned schedule names, times, last/next runs, last state, enabled state, and freshness with no mutation surface.

**Independent test**: Find a disabled or failed schedule, inspect its last permitted run, verify absent last/next values are labeled, and confirm no create/edit/enable/disable/delete/run-now control or contract exists.

### Test-first implementation

- [X] T080 [P] [US6] Add failing schedule schema tests in `src/features/system-health/contracts.test.ts` for `SCH-` IDs, safe names, queue, bounded human-readable schedule, nullable last/next run, last state, enabled, freshness, projection, pagination, and strict absence of mutation schemas; run focused contract tests and confirm red US6 cases
- [X] T081 [P] [US6] Add failing schedule component tests in `src/features/system-health/OperationsViews.test.tsx` for search/filter/sort, null labels, loading/empty/stale/error/permission states, domain projections, responsive table/cards, and absence of every mutation control; run focused component tests and confirm red US6 cases
- [X] T082 [US6] Append a failing US6 Playwright scenario to `tests/e2e/system-health-jobs.spec.ts` for the independent test, role projections, forbidden direct access, keyboard, RTL/LTR, and 390px read-only summary; run with `--grep "US6"` and confirm red behavior

### Contracts, data, transport, and UI

- [X] T083 [US6] Implement `ScheduledJobSummary`, schedule query, and paginated response schemas in `src/features/system-health/contracts.ts`; verify focused contract tests pass US6
- [X] T084 [US6] Add sanitized schedule fixtures for all seven queues, enabled/disabled, failed/no-prior/no-next cases, role projections, and fixed freshness to `src/mocks/fixtures/system-health.ts`; verify contract tests validate every schedule fixture
- [X] T085 [US6] Add failing GET `/jobs/scheduled` repository/handler tests for search/filter/sort/pagination, domain projections, forbidden access, empty/stale/error cases, and no mutation method in `src/features/system-health/repository.test.ts`; confirm red US6 cases
- [X] T086 [US6] Implement `listScheduledJobs()` in `src/features/system-health/repository.ts`, `useScheduledJobs()` in `src/features/system-health/hooks.ts`, and the read-only handler in `src/mocks/handlers/system-health.ts`; verify repository/hook tests exit 0 for US6
- [X] T087 [US6] Implement `ScheduledJobsView` in `src/features/system-health/OperationsViews.tsx` and thin `src/app/admin/jobs/scheduled/page.tsx`; verify focused component, route, and no-direct-fixture tests exit 0
- [X] T088 [US6] Make the US6 Playwright scenario green in `tests/e2e/system-health-jobs.spec.ts`; verify `npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts --grep "US6"` exits 0

**Checkpoint**: US6 is demonstrably read-only at contract, repository, handler, and UI layers.

---

## Phase 9: Cross-Cutting Hardening and Final Verification

**Purpose**: Verify the complete Phase 8 surface without adding features or weakening prior phases.

- [X] T089 Register/reset the final Phase 8 handler and deterministic state in `src/mocks/handlers/index.ts`, `src/mocks/server.ts`, and shared test setup; verify `npm run test -- src/mocks/phase8-system-health-state.test.ts src/features/system-health/repository.test.ts` passes twice consecutively with identical counts
- [X] T090 Run the focused Vitest command from `specs/009-admin-system-health-and-jobs/quickstart.md` and record exact files/tests/pass/fail/skip counts in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T091 Run the nine-route default/state matrix from `specs/009-admin-system-health-and-jobs/quickstart.md`, record route and console evidence in `specs/009-admin-system-health-and-jobs/verification-report.md`, and fix only Phase 8 defects in their named source/test files
- [X] T092 Verify Arabic RTL and representative English LTR at 1440×1000, 1280×900, 1024×900, 768×1024, and 390×844 using `tests/e2e/system-health-jobs.spec.ts`; record exact viewport outcomes and any desktop-required notices in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T093 Verify keyboard navigation, visible focus, focus restoration, live announcements, semantic headings/tables/cards, chart summaries, 44px targets, non-color states, direction-isolated identifiers, polling focus stability, and reduced motion in `tests/e2e/system-health-jobs.spec.ts`; record results in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T094 Search changed Phase 8 production files for `any`, direct fixture imports, `dangerouslySetInnerHTML`, raw HTML/Markdown/recursive JSON, `Date.now()`, `Math.random()`, browser persistence, debug logs, public secret exposure, raw colors, real provider/queue clients, uploads/downloads, and dependency changes; record the exact `rg` commands and zero-or-explained matches in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T095 Review structural projections, URL/payload/response validation, safe metadata, 403/404 privacy, stale/duplicate locks, client storage, environment exposure, links, errors/logs, fictional fixtures, platform counting, and deferred backend protections against `specs/009-admin-system-health-and-jobs/spec.md`; record pass/fail evidence in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T096 Measure 20 standard route samples and 20 filter/sort/pagination/range samples using the procedure in `specs/009-admin-system-health-and-jobs/quickstart.md`; record p95 usable-content and interaction times plus separately labeled slow scenarios in `specs/009-admin-system-health-and-jobs/verification-report.md`
- [X] T097 Run `npm run typecheck` from `apps/admin-web`; record the command, exit code, and exact diagnostics in `specs/009-admin-system-health-and-jobs/verification-report.md`, and do not check this task if exit code is nonzero
- [X] T098 Run `npm run lint` from `apps/admin-web`; record the command, exit code, and exact warning/error counts in `specs/009-admin-system-health-and-jobs/verification-report.md`, and do not check this task if exit code is nonzero
- [X] T099 Run `npm run test` from `apps/admin-web`; record the command, exit code, and exact Vitest file/test/pass/fail/skip counts in `specs/009-admin-system-health-and-jobs/verification-report.md`, and do not check this task if exit code is nonzero
- [X] T100 Run `npm run test:e2e` from `apps/admin-web`; record the command, exit code, and exact Playwright pass/fail/skip counts in `specs/009-admin-system-health-and-jobs/verification-report.md`, and do not check this task if exit code is nonzero
- [X] T101 Run `npm run build` from `apps/admin-web`; record the command, exit code, warnings, and generated presence of all nine Phase 8 routes in `specs/009-admin-system-health-and-jobs/verification-report.md`, and do not check this task if exit code is nonzero
- [X] T102 Reconcile every checked item in `specs/009-admin-system-health-and-jobs/tasks.md` against the commands and evidence in `specs/009-admin-system-health-and-jobs/verification-report.md`; uncheck unsupported claims and list any remaining limitation or deferred production control

---

## Dependencies

### Phase order

```text
Phase 1 review
  → Phase 2 foundation
  → US1 health overview
  → US2 API/database/storage
  → US3 providers
  → US4 queue/job reads
  → US5 retry/cancel
  → US6 schedules
  → Phase 9 hardening and verification
```

- Phase 1 blocks source edits because the current Git branch must be correct and baseline failures must be known.
- Phase 2 blocks every story because all stories share permissions, route resolution, contract primitives, query keys, and fixture boundaries.
- US1, US2, and US3 are product-independent after Phase 2, but this ledger serializes them because they modify the same contract, repository, handler, hook, fixture, view, and E2E files.
- US4 must complete before US5 because retry/cancel depends on job reads, deterministic state, queue derivation, and detail UI.
- US6 depends only on Phase 2 technically, but follows US5 to avoid shared-file conflicts and to preserve approved story order.
- Phase 9 starts only after all in-scope story checkpoints are green.

### User-story dependency graph

| Story | Depends on | Independently verifiable outcome |
|---|---|---|
| US1 | Phase 2 | Scan 12 services, ranges, freshness, and incident link |
| US2 | Phase 2; serialized after US1 | Diagnose safe API/database/storage signals |
| US3 | Phase 2; serialized after US2 | Compare role-projected providers without configuration |
| US4 | Phase 2; serialized after US3 | Find backlog and open authorized safe job detail |
| US5 | US4 | Retry once and cancel only eligible mock jobs |
| US6 | Phase 2; serialized after US5 | Inspect schedules with no mutation surface |

---

## Parallel Execution Examples

Only the following `[P]` tasks are safe to dispatch concurrently after their prerequisites:

### Phase 1

```text
T002 source-boundary review
T003 OpenAPI validation
```

### Phase 2

```text
T005 permission tests
T006 route tests
T007 shared contract tests
T008 hook-policy tests
```

### US1

```text
T018 health contract tests
T019 health component tests
```

T020 writes the shared E2E file and should remain serialized.

### US2

```text
T030 monitoring contract tests
T031 monitoring component tests
```

### US3

```text
T042 provider contract tests
T043 provider component tests
```

### US4

```text
T053 queue/job contract tests
T054 deterministic state tests
T055 queue/job component tests
```

### US5

```text
T068 action contract tests
T069 transition state tests
T070 action-dialog component tests
```

### US6

```text
T080 schedule contract tests
T081 schedule component tests
```

Do not parallelize implementation tasks that edit `contracts.ts`,
`repository.ts`, `hooks.ts`, `system-health.ts`, `OperationsViews.tsx`, or the
single Playwright file.

---

## Implementation Strategy

### MVP first

1. Complete Phase 1 and Phase 2.
2. Complete US1 tasks T018–T029.
3. Run the US1 focused Vitest and Playwright commands.
4. Demonstrate the approved System Health route with 12 services, fixed ranges,
   authoritative freshness, safe platform impact, and accessible states.
5. Stop for review before adding deeper monitoring and job operations.

### Incremental delivery

1. US1 — trustworthy health overview.
2. US2 — safe core-service diagnosis.
3. US3 — external-provider health.
4. US4 — queue and job investigation.
5. US5 — guarded mock recovery actions.
6. US6 — read-only schedules.
7. Phase 9 — full evidence and regression gate.

## MVP Scope

The suggested MVP is Phase 1 + Phase 2 + User Story 1 (T001–T029). It preserves
the approved route and proves the new contract, freshness, range, polling,
permission, platform, responsive, and accessibility foundations before the
larger monitoring surface is added.

## Completion Rule

Do not mark a task complete because code was written. Mark it complete only
after its named command or procedure succeeds and the evidence is recorded
where required. Phase 8 is complete only when T097–T101 all have exit code 0,
all nine routes appear in the build, and T102 reconciles the ledger to evidence.
