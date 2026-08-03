# Tasks: AI Management and Automation Intelligence

**Input**: `specs/006-admin-ai-management/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Contract**: `specs/006-admin-ai-management/contracts/admin-ai-management.openapi.yaml`

Every task starts with an unchecked box and sequential `T###` identifier.
`[P]` means the task touches a different file and has no dependency on an
incomplete task. User-story labels appear only in user-story phases.

## Phase 1: Existing Project and Contract Review

**Purpose**: Confirm the implementation baseline without initializing,
upgrading, or replacing anything.

- [X] T001 Read `specs/006-admin-ai-management/spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/admin-ai-management.openapi.yaml`; record any contradiction as a blocking note in `specs/006-admin-ai-management/tasks.md` before editing source
- [X] T002 Confirm the existing reusable API, query, mutation-lock, permission, shell, UI-state, chart, table, dialog, mock-scenario, and MSW registration paths listed in `specs/006-admin-ai-management/plan.md`; correct only stale path references in that file
- [X] T003 Run `npm run typecheck` from `apps/admin-web` and record the pre-change exit code under a new “Baseline evidence” subsection in `specs/006-admin-ai-management/quickstart.md`
- [X] T004 Run `npm run lint` from `apps/admin-web` and record the pre-change exit code under “Baseline evidence” in `specs/006-admin-ai-management/quickstart.md`
- [X] T005 Run `npm run test` from `apps/admin-web` and record the pre-change file/test counts and exit code under “Baseline evidence” in `specs/006-admin-ai-management/quickstart.md`
- [X] T006 Run `npm run build` from `apps/admin-web` and record the pre-change exit code and generated route count under “Baseline evidence” in `specs/006-admin-ai-management/quickstart.md`

**Gate**: Stop if the baseline fails for reasons unrelated to Spec 006; record
the exact failure before changing production files.

---

## Phase 2: Shared Frontend Foundations

**Purpose**: Add only the common AI boundary required by every user story.

### Contract and boundary tests

- [X] T007 [P] Add failing Vitest cases for `SafeAiId`, `PlatformScope`, `LocaleScope`, `AiFeature`, pagination, dates, scenarios, bounded search/reason text, and strict unknown-field rejection in `src/features/ai/contracts.test.ts`
- [X] T008 Add failing Vitest cases for original-request versus attempt counts, authoritative classification markers, mixed-currency normalization completeness, and safe `ApiError` fields in `src/features/ai/contracts.test.ts`
- [X] T009 [P] Add failing repository tests for `/api/v1/admin/ai` query serialization, safe identifier encoding, request validation, response validation, and unsafe-response rejection in `src/features/ai/repository.test.ts`
- [X] T010 [P] Add failing hook tests for stable AI query keys, previous-page data, targeted invalidation, and duplicate mutation locking in `src/features/ai/hooks.test.ts`
- [X] T011 [P] Add failing permission-map tests for every `ai.*` key and each role projection from the Spec 006 matrix in `src/core/permissions/role-map.test.ts`
- [X] T012 [P] Add failing route-resolution tests proving specific AI routes resolve before `/admin` and denied roles receive the correct permission key in `src/components/admin/shell-state.test.ts`
- [X] T013 [P] Add a failing architecture assertion that files under `src/app/admin/ai` and `src/features/ai` cannot import `src/mocks/fixtures` in `src/tests/no-direct-fixtures.test.ts`

### Shared implementation

- [X] T014 Implement only shared AI enums, value objects, query schemas, pagination, bounded-text validators, money normalization invariants, region state, audit reference, and safe error schemas in `src/features/ai/contracts.ts` until T007-T008 pass
- [X] T015 Define the `AiRepository` interface, `/api/v1/admin/ai` base path, parsed `URLSearchParams` helper, and safe identifier encoder in `src/features/ai/repository.ts` until the shared portions of T009 pass
- [X] T016 Define `aiQueryKeys`, shared list-query behavior, and locked action variables in `src/features/ai/hooks.ts` until the shared portions of T010 pass
- [X] T017 [P] Add failing tests for Phase 5 reset, immutable snapshots, expected-state/revision conflicts, revision increments, and safe audit references in `src/mocks/phase5-ai-state.test.ts`
- [X] T018 Add deterministic Phase 5 state reset, safe audit-reference generation, expected-state/revision conflict helper, and immutable snapshot access in `src/mocks/phase5-ai-state.ts` until T017 passes
- [X] T019 Add generic AI scenario parsing for success, empty, large, slow, partial, unauthorized, forbidden, not-found, expired, validation, conflict, rate-limited, unavailable, unsafe-response, masking-violation, duplicate-pending, and internal-error in `src/mocks/scenarios/ai.ts`
- [X] T020 Add all Spec 006 permission keys exactly as documented to `PERMISSION_KEYS` in `src/core/permissions/permissions.ts` until T011 compiles
- [X] T021 Map Super Admin, AI Operator, Support Agent, Security Administrator, Billing Operator, Parser/Import Operator, and Content Manager to the documented AI permissions in `src/core/permissions/role-map.ts` until T011 passes
- [X] T022 Add most-specific AI route permission rules before the `/admin` fallback in `src/components/admin/shell-state.ts` until T012 passes
- [X] T023 Activate the existing AI navigation item at `/admin/ai` with `ai.overview.read` and add only the required AI search navigation records in `src/mocks/fixtures/foundation.ts`
- [X] T024 Create `src/mocks/handlers/ai.ts` with a typed empty handler array export and shared safe scenario/error helpers
- [X] T025 Register one `aiHandlers` family after existing completed-phase handlers in `src/mocks/handlers/index.ts` and confirm the handler registry compiles

**Gate**: T007-T025 pass focused tests; no page imports fixtures; no provider,
backend, browser persistence, package, or new shared framework exists.

---

## Phase 3: User Story 1 — Monitor AI Operations (P1)

**Goal**: Show trustworthy request, reliability, cost, latency, unit, report,
fallback, feature, provider, platform, and freshness summaries.

**Independent test**: From `/admin/ai`, an authorized operator identifies the
highest-impact feature/provider/failure and opens matching filtered records
within 90 seconds; one original request remains one request across retries.

### Tests

- [X] T026 [P] [US1] Add failing contract tests for `AiMetric`, `AiOverview`, authoritative denominators, All/iOS/Android/Unknown attribution, separate attempt counts, currency buckets, freshness, and partial regions in `src/features/ai/contracts.test.ts`
- [X] T027 [P] [US1] Add failing repository tests for `GET /api/v1/admin/ai/overview`, every supported query filter, and response rejection when original-request or currency invariants fail in `src/features/ai/repository.test.ts`
- [X] T028 [P] [US1] Add failing hook tests for the overview query key, filter changes, stale-response replacement, and retry behavior in `src/features/ai/hooks.test.ts`
- [X] T029 [P] [US1] Add failing component tests for required metrics, feature/provider/platform trends, unit/denominator/freshness labels, platform filtering, drill-down links, loading, empty, partial, error, aggregate, and denied states in `src/features/ai/AiOverview.test.tsx`
- [X] T030 [P] [US1] Add a failing Playwright journey for `/admin/ai`, keyboard platform/filter changes, drill-down, Arabic RTL, English LTR readiness, privacy text, and the 90-second operator outcome in `tests/e2e/ai-management.spec.ts`

### Implementation

- [X] T031 [US1] Add `AiMetric`, chart-point, region-map, overview-query, and `AiOverview` strict schemas/types to `src/features/ai/contracts.ts` until T026 passes
- [X] T032 [US1] Add deterministic overview fixtures covering All/iOS/Android/Unknown, unique original requests, retries, fallbacks, mixed currencies, partial regions, and freshness in `src/mocks/fixtures/ai.ts`
- [X] T033 [US1] Implement `GET /api/v1/admin/ai/overview` with parsed queries, role projection, generic scenarios, unsafe-response rejection, and contract-valid fixtures in `src/mocks/handlers/ai.ts`
- [X] T034 [US1] Add `getOverview` to `AiRepository` and validate the response with the production overview schema in `src/features/ai/repository.ts` until T027 passes
- [X] T035 [US1] Add `useAiOverview` with stable keys, previous safe data during filter refresh, and focused retry behavior in `src/features/ai/hooks.ts` until T028 passes
- [X] T036 [US1] Implement the Arabic-first overview metrics, accessible chart summaries, platform/period/filter controls, partial regions, drill-down links, and all tested states in `src/features/ai/AiOverview.tsx` until T029 passes
- [X] T037 [US1] Create the thin permission-aware `/admin/ai` route that renders `AiOverview` and imports no fixture in `src/app/admin/ai/page.tsx`
- [X] T038 [US1] Run the focused US1 Vitest files and Playwright journey from `specs/006-admin-ai-management/quickstart.md`; record observed command exits and failures under a new “US1 evidence” subsection in that file

**Checkpoint**: US1 works without provider/model/prompt configuration routes and
is independently demonstrable as the MVP.

---

## Phase 4: User Story 2 — Review Providers and Models (P1)

**Goal**: Compare provider/model health, coverage, latency, failure, cost, and
fallback routing, then safely simulate valid configuration decisions.

**Independent test**: An AI Operator opens a provider, verifies feature/locale
coverage, and confirms one valid mock fallback change while cycles, duplicates,
incompatible routes, missing terminal coverage, stale revisions, and forbidden
actions fail safely.

### Tests

- [X] T039 [P] [US2] Add failing contract tests for provider/model summaries, full/aggregate/context projections, authoritative health/eligibility, rate-limit summaries, and strict secret/raw-payload exclusion in `src/features/ai/contracts.test.ts`
- [X] T040 [US2] Add failing contract tests for fallback identity `(feature, locale)`, unique priorities/routes, provider-model compatibility, cycle rejection, terminal eligibility, and platform exclusion in `src/features/ai/contracts.test.ts`
- [ ] T041 [P] [US2] Add failing runtime-state tests for provider/model actions, expected revision/state, confirmation token, permission denial, pending conflict, coverage preservation, and reset in `src/mocks/phase5-ai-state.test.ts`
- [X] T042 [P] [US2] Add failing repository tests for provider list/detail, model list, provider actions, model actions, safe IDs, query serialization, and response validation in `src/features/ai/repository.test.ts`
- [ ] T043 [P] [US2] Add failing hook tests for provider/model list/detail keys, locked mutations, and invalidating only affected overview/list/detail keys in `src/features/ai/hooks.test.ts`
- [ ] T044 [P] [US2] Add failing component tests for provider list/detail, model assignments, safe rate-limit/health/cost rendering, fallback validation, confirmation, pending lock, conflict recovery, permission projections, and 390px desktop-required states in `src/features/ai/AiViews.test.tsx`
- [ ] T045 [P] [US2] Extend `tests/e2e/ai-management.spec.ts` with failing provider/model routes, keyboard detail/confirmation flow, invalid fallback cases, direct forbidden mutation, focus restoration, and no credential/raw payload exposure

### Implementation

- [X] T046 [US2] Add `FallbackRoute`, provider summary/detail, model summary, list-page, and provider/model action request/result strict schemas/types to `src/features/ai/contracts.ts` until T039-T040 pass
- [ ] T047 [US2] Add provider/model/fallback-chain fixtures for healthy, degraded, outage, unavailable, compatible, incompatible, cyclic, duplicate-priority, no-terminal, aggregate, and context projections in `src/mocks/fixtures/ai.ts`
- [ ] T048 [US2] Implement provider/model state slices and validated provider/model action transitions in `src/mocks/phase5-ai-state.ts` until T041 passes
- [X] T049 [US2] Implement provider list/detail GET handlers and provider action POST handler with role projection and safe scenario responses in `src/mocks/handlers/ai.ts`
- [X] T050 [US2] Implement model list GET handler and model action POST handler with coverage checks and safe scenario responses in `src/mocks/handlers/ai.ts`
- [X] T051 [US2] Add provider/model list/detail/action methods to `AiRepository` with production schema validation in `src/features/ai/repository.ts` until T042 passes
- [ ] T052 [US2] Add provider/model list/detail hooks and locked action hooks with targeted invalidation in `src/features/ai/hooks.ts` until T043 passes
- [ ] T053 [US2] Implement provider list/detail and model inventory/assignment views with accessible tables/cards, safe structured fields, validation messages, confirmations, conflicts, and all tested states in `src/features/ai/AiViews.tsx` until T044 passes
- [X] T054 [P] [US2] Create the thin provider list route in `src/app/admin/ai/providers/page.tsx`
- [X] T055 [P] [US2] Create the thin provider detail route with validated `providerId` and safe invalid/not-found behavior in `src/app/admin/ai/providers/[providerId]/page.tsx`
- [X] T056 [P] [US2] Create the thin model list route in `src/app/admin/ai/models/page.tsx`
- [X] T057 [US2] Run focused US2 Vitest and Playwright checks; record command exits and failures under “US2 evidence” in `specs/006-admin-ai-management/quickstart.md`

**Checkpoint**: US2 is independently testable with its own fixtures and routes;
no real provider configuration or credential exists.

---

## Phase 5: User Story 3 — Govern Prompt Versions (P1)

**Goal**: Review sanitized fictional prompt metadata and safely simulate the
Draft → Testing → Active → Retired lifecycle and rollback-to-new-Draft.

**Independent test**: A prompt activates only with valid scope, variables,
schema, and all enabled required tests passing; rollback creates a new Draft
without changing historical versions.

### Tests

- [ ] T058 [P] [US3] Add failing contract tests for prompt summaries/details, 4 KiB sanitized preview, allowlisted variables/schema summaries, fictional tests, omission labels, strict unknown-field rejection, and no raw customer/provider fields in `src/features/ai/contracts.test.ts`
- [ ] T059 [P] [US3] Add failing runtime-state tests for Draft/Testing/Active/Retired transitions, one Active version per feature/locale, required-test gating, immutable history, rollback-created Draft, stale revision, and forbidden action in `src/mocks/phase5-ai-state.test.ts`
- [ ] T060 [P] [US3] Add failing repository and hook tests for prompt list/detail/action paths, filters, safe IDs, lifecycle invalidation, and unsafe-detail rejection in `src/features/ai/repository.test.ts` and `src/features/ai/hooks.test.ts`
- [ ] T061 [P] [US3] Add failing component tests for prompt list/detail, fictional preview, variables/schema/tests/history, lifecycle eligibility, confirmation, conflict, permission, and desktop-required states in `src/features/ai/AiViews.test.tsx`
- [ ] T062 [P] [US3] Extend `tests/e2e/ai-management.spec.ts` with failing prompt list/detail, failed-test activation block, eligible activation, rollback-to-Draft, immutable history, keyboard dialog, and privacy assertions

### Implementation

- [ ] T063 [US3] Add prompt variable/schema/test, summary/detail, list-page, lifecycle request, and action-result strict schemas/types to `src/features/ai/contracts.ts` until T058 passes
- [ ] T064 [US3] Add deterministic Arabic/English prompt fixtures with Draft/Testing/Active/Retired, passing/failing/blocked required tests, fictional previews, omissions, stale revisions, and rollback candidates in `src/mocks/fixtures/ai.ts`
- [ ] T065 [US3] Implement prompt state transitions, active-scope uniqueness, required-test gating, immutable history, and rollback-created Draft in `src/mocks/phase5-ai-state.ts` until T059 passes
- [X] T066 [US3] Implement prompt list/detail GET handlers and prompt action POST handler with role projection, scenarios, and safe detail validation in `src/mocks/handlers/ai.ts`
- [ ] T067 [US3] Add prompt list/detail/action repository methods and hooks with focused invalidation in `src/features/ai/repository.ts` and `src/features/ai/hooks.ts` until T060 passes
- [ ] T068 [US3] Add prompt list/detail and lifecycle UI to `src/features/ai/AiViews.tsx` using plain text/allowlisted fields, confirmations, pending locks, conflicts, and tested states until T061 passes
- [X] T069 [P] [US3] Create the thin prompt list route in `src/app/admin/ai/prompts/page.tsx`
- [X] T070 [P] [US3] Create the thin prompt detail route with validated `promptId` and safe invalid/not-found behavior in `src/app/admin/ai/prompts/[promptId]/page.tsx`
- [X] T071 [US3] Run focused US3 Vitest and Playwright checks; record command exits and failures under “US3 evidence” in `specs/006-admin-ai-management/quickstart.md`

**Checkpoint**: US3 is independently testable with fictional prompt data and
no prompt execution path.

---

## Phase 6: User Story 4 — Analyze Usage, Cost, and Failures (P1)

**Goal**: Filter metadata-only usage and failure records while preserving
request/attempt, platform, currency, privacy, and conflict semantics.

**Independent test**: Usage/failure records filter, sort, paginate, and triage
without raw content; retries do not inflate requests and mixed currencies are
not combined without authoritative normalization.

### Tests

- [ ] T072 [P] [US4] Add failing contract tests for metadata-only usage records, masked users, original request reference, attempt/fallback counts, platform/plan/date/status filters, mixed currencies, and aggregate projection in `src/features/ai/contracts.test.ts`
- [ ] T073 [US4] Add failing contract tests for failure metadata, authoritative impact, safe error class/code, fallback outcome, allowed states/actions, safe correlation reference, and no raw request/response fields in `src/features/ai/contracts.test.ts`
- [ ] T074 [P] [US4] Add failing runtime-state tests for acknowledge/assign/resolve/reopen/escalate, expected state/revision, pending conflict, forbidden action, and reset in `src/mocks/phase5-ai-state.test.ts`
- [ ] T075 [P] [US4] Add failing repository/hook tests for usage/failure query serialization, list validation, action locking, and targeted invalidation in `src/features/ai/repository.test.ts` and `src/features/ai/hooks.test.ts`
- [ ] T076 [P] [US4] Add failing component tests for usage filters/table/card fallback, currency separation, denominators, failure triage, confirmation, conflict, aggregate/denied states, and 390px monitoring in `src/features/ai/AiViews.test.tsx`
- [ ] T077 [P] [US4] Extend `tests/e2e/ai-management.spec.ts` with failing usage/failure filtering, URL-safe state, pagination, mixed-currency, retry-count, triage, direct forbidden mutation, keyboard, and masking assertions

### Implementation

- [ ] T078 [US4] Add usage/failure query, record, list-page, failure action, and result strict schemas/types to `src/features/ai/contracts.ts` until T072-T073 pass
- [ ] T079 [US4] Add deterministic usage/failure fixtures for iOS/Android/Unknown, plans, providers/models, retries/fallbacks, mixed currencies, normalized totals, aggregate projections, every state, and stale revisions in `src/mocks/fixtures/ai.ts`
- [ ] T080 [US4] Implement failure state transitions and validated triage actions in `src/mocks/phase5-ai-state.ts` until T074 passes
- [X] T081 [US4] Implement usage/failure GET handlers and failure action POST handler with filters, pagination, projections, scenarios, and safe errors in `src/mocks/handlers/ai.ts`
- [ ] T082 [US4] Add usage/failure repository methods and query/action hooks with targeted invalidation in `src/features/ai/repository.ts` and `src/features/ai/hooks.ts` until T075 passes
- [ ] T083 [US4] Add usage explorer and failure triage UI to `src/features/ai/AiViews.tsx` with URL-safe filters, accessible tables/cards, confirmations, conflicts, and tested states until T076 passes
- [X] T084 [P] [US4] Create the thin usage route in `src/app/admin/ai/usage/page.tsx`
- [X] T085 [P] [US4] Create the thin failures route in `src/app/admin/ai/failures/page.tsx`
- [X] T086 [US4] Run focused US4 Vitest and Playwright checks; record command exits and failures under “US4 evidence” in `specs/006-admin-ai-management/quickstart.md`

**Checkpoint**: US4 is independently testable and receives no prompt,
conversation, response, or private financial content.

---

## Phase 7: User Story 5 — Review Reports and Safety Rules (P1)

**Goal**: Review sanitized user reports and declarative safety rules, then
record safe mock dispositions and rule decisions.

**Independent test**: A severe report links safe model/prompt metadata using at
most a 280-code-point sanitized excerpt; executable/oversized rules and changes
that create required-coverage gaps are rejected.

### Tests

- [ ] T087 [P] [US5] Add failing contract tests for future-backend-sanitized report excerpts measured at 280 Unicode code points, omission labels, surrogate pairs, raw-field rejection, authoritative severity, projections, states, and actions in `src/features/ai/contracts.test.ts`
- [ ] T088 [US5] Add failing contract tests for declarative safety conditions/outcomes, 8 KiB bound, allowed operations, feature/locale scope, authoritative eligibility/severity, required coverage, and executable/unknown-field rejection in `src/features/ai/contracts.test.ts`
- [ ] T089 [P] [US5] Add failing runtime-state tests for report dispositions/reopen/duplicate links and safety Draft/Active/Inactive/Retired transitions, scope changes, required-coverage gaps, stale revisions, permission denial, pending conflict, and reset in `src/mocks/phase5-ai-state.test.ts`
- [ ] T090 [P] [US5] Add failing repository/hook tests for report/safety list/action paths, filters, response privacy validation, locks, and targeted invalidation in `src/features/ai/repository.test.ts` and `src/features/ai/hooks.test.ts`
- [ ] T091 [P] [US5] Add failing component tests for report list/review, bounded excerpt/omission labels, safety rules, declarative editor, coverage warnings, confirmations, conflicts, projections, and desktop-required states in `src/features/ai/AiViews.test.tsx`
- [ ] T092 [P] [US5] Extend `tests/e2e/ai-management.spec.ts` with failing severe-report review, duplicate/reopen, 280-code-point boundary, unsafe excerpt rejection, safety activation/deactivation, coverage block, keyboard/focus, and no raw-content assertions

### Implementation

- [ ] T093 [US5] Add response-report, sanitized-excerpt, safety condition/outcome/rule, list-page, action request, and result strict schemas/types to `src/features/ai/contracts.ts` until T087-T088 pass
- [ ] T094 [US5] Add deterministic report/safety fixtures for every severity/status, 279/280/281-code-point excerpts, surrogate pairs, omission labels, aggregate/context projections, safe/unsafe rule definitions, required coverage, stale revisions, and duplicate reports in `src/mocks/fixtures/ai.ts`
- [ ] T095 [US5] Implement report and safety state transitions, duplicate links, expected revisions, declarative-rule validation, and required-coverage preservation in `src/mocks/phase5-ai-state.ts` until T089 passes
- [X] T096 [US5] Implement report/safety GET handlers and action POST handlers with projections, excerpt boundary rejection, scenarios, coverage checks, and safe errors in `src/mocks/handlers/ai.ts`
- [ ] T097 [US5] Add report/safety repository methods and list/action hooks with targeted invalidation in `src/features/ai/repository.ts` and `src/features/ai/hooks.ts` until T090 passes
- [ ] T098 [US5] Add report-review and safety-rule UI to `src/features/ai/AiViews.tsx` using text/allowlisted structured rendering, confirmations, conflicts, warnings, and tested states until T091 passes
- [X] T099 [P] [US5] Create the thin response reports route in `src/app/admin/ai/reports/page.tsx`
- [X] T100 [P] [US5] Create the thin safety rules route in `src/app/admin/ai/safety-rules/page.tsx`
- [X] T101 [US5] Run focused US5 Vitest and Playwright checks; record command exits and failures under “US5 evidence” in `specs/006-admin-ai-management/quickstart.md`

**Checkpoint**: US5 is independently testable; raw AI content and executable
safety behavior never enter the browser.

---

## Final Phase: Hardening and Verification

### Cross-cutting behavior

- [ ] T102 [P] Add direct-handler permission tests for every AI GET/POST operation and role projection in `src/mocks/handlers/ai.test.ts`
- [ ] T103 Add cross-story scenario tests for partial, slow, unsafe-response, masking-violation, rate-limit, provider-unavailable, stale-conflict, and duplicate-pending behavior in `src/mocks/handlers/ai.test.ts`
- [X] T104 [P] Extend global accessibility browser coverage for AI headings, landmarks, tables/cards, chart summaries, dialogs, focus restoration, live announcements, status alternatives, 44px targets, and reduced motion in `tests/e2e/accessibility.spec.ts`
- [X] T105 [P] Extend global permission browser coverage for AI navigation visibility, route denial, limited projections, disabled/hidden actions, and direct mock 403 responses in `tests/e2e/permissions.spec.ts`
- [X] T106 [P] Add 20-sample p95 checks for standard overview/detail readiness ≤2000 ms and filter/sort/pagination completion ≤1000 ms, excluding labeled slow scenarios, in `tests/e2e/performance.spec.ts`
- [X] T107 [P] Extend visual-preservation coverage to assert existing approved routes remain unchanged and AI pages use existing semantic shell/tokens at 1440px and 390px in `tests/e2e/visual-preservation.spec.ts`
- [X] T108 Verify every Phase 5 route and primary journey at 1440px, 1280px, 1024px, 768px, and 390px in Arabic RTL plus English LTR readiness; record viewport-specific results in `specs/006-admin-ai-management/quickstart.md`
- [X] T109 Review `src/features/ai`, `src/app/admin/ai`, and `src/mocks` for raw AI/customer/provider content, unsafe rendering, `dangerouslySetInnerHTML`, browser storage, secrets/public environment leaks, raw errors/logs, direct fixture imports, `any`, new dependencies, raw colors, and real backend/provider calls; record findings in `specs/006-admin-ai-management/quickstart.md`
- [X] T110 Confirm the deferred NestJS authorization, provider-secret, prompt-retention, routing/fallback, rate/spend, idempotency, queue, safety-enforcement, immutable-audit, monitoring, and incident-response controls remain documented and unimplemented in `specs/006-admin-ai-management/plan.md`

### Required command evidence

- [X] T111 Run `npm run typecheck` from `apps/admin-web`; record the exact exit code and any output summary in `specs/006-admin-ai-management/quickstart.md`
- [X] T112 Run `npm run lint` from `apps/admin-web`; record the exact exit code and any output summary in `specs/006-admin-ai-management/quickstart.md`
- [X] T113 Run the focused Phase 5 Vitest command from `specs/006-admin-ai-management/quickstart.md`; record file/test counts and exit code in that file
- [X] T114 Run `npm run test` from `apps/admin-web`; record total file/test counts and exit code in `specs/006-admin-ai-management/quickstart.md`
- [X] T115 Run the focused Phase 5 Playwright command from `specs/006-admin-ai-management/quickstart.md`; record pass/skip/fail counts and exit code in that file
- [X] T116 Run `npm run test:e2e` from `apps/admin-web`; record total pass/skip/fail counts and exit code in `specs/006-admin-ai-management/quickstart.md`
- [X] T117 Run `npm run build` from `apps/admin-web`; record the exit code and confirm all ten Phase 5 routes appear in the generated route output in `specs/006-admin-ai-management/quickstart.md`
- [X] T118 Re-run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` only if T108-T117 required source/test fixes; record only actually observed final results in `specs/006-admin-ai-management/quickstart.md`

## Dependencies

### Phase order

```text
Phase 1 review
    ↓
Phase 2 shared foundations
    ├── US1 Monitor AI Operations
    ├── US2 Review Providers and Models
    ├── US3 Govern Prompt Versions
    ├── US4 Analyze Usage, Cost, and Failures
    └── US5 Review Reports and Safety Rules
             ↓
Final hardening and verification
```

- Phase 1 precedes every source change.
- Phase 2 blocks all user-story work.
- Each story is independently testable after Phase 2 using its own fixtures,
  handlers, repository methods, hooks, views, routes, and tests.
- Recommended single-implementer order is US1 → US2 → US3 → US4 → US5 because
  stories append to the same AI contract/repository/hook/view/mock files.
- Final hardening begins only after all selected stories are complete.
- T118 runs only when verification required a change after earlier command
  evidence.

### User-story contract mapping

| Story | Read operations | Action operations | Primary models |
|-------|-----------------|-------------------|----------------|
| US1 | `getAiOverview` | None | `AiMetric`, `AiOverview` |
| US2 | `listAiProviders`, `getAiProvider`, `listAiModels` | `actOnAiProvider`, `actOnAiModel` | Provider, model, fallback route |
| US3 | `listAiPrompts`, `getAiPrompt` | `actOnAiPrompt` | Prompt version, variables, schema, fictional tests |
| US4 | `listAiUsage`, `listAiFailures` | `actOnAiFailure` | Usage, money estimate, failure |
| US5 | `listAiResponseReports`, `listAiSafetyRules` | `actOnAiResponseReport`, `actOnAiSafetyRule` | Sanitized excerpt, response report, safety rule |

## Parallel Execution Examples

### Shared foundation

After T006, T007 and T009-T013 may be assigned in parallel because they add
tests in separate existing/new test files. T008 follows T007 in the same file.
After T018, T019-T023 may proceed across their listed files.

### US1

After T025, T026-T030 may be written in parallel. After T035, T036 and T037 are
sequential because the route imports the completed overview component.

### US2

T039 and T041-T045 may be written in parallel; T040 follows T039 in the same
file. After T053, route tasks T054-T056 may be implemented in parallel because
they touch separate route files.

### US3

T058-T062 may be written in parallel. After T068, T069-T070 may be implemented
in parallel because they touch separate route files.

### US4

T072 and T074-T077 may be written in parallel; T073 follows T072 in the same
file. After T083, T084-T085 may be implemented in parallel because they touch
separate route files.

### US5

T087 and T089-T092 may be written in parallel; T088 follows T087 in the same
file. After T098, T099-T100 may be implemented in parallel because they touch
separate route files.

### Final hardening

T102 and T104-T107 may be implemented in parallel because they target distinct
test files. T103 follows T102 in the same handler test file. T111-T117 should
run sequentially to keep command evidence readable and attributable.

## Implementation Strategy

### MVP first

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete US1 only.
4. Run T038 and demonstrate `/admin/ai`.

US1 is the suggested MVP because it provides operational value without any
configuration mutation.

### Incremental delivery

1. Add US2 for provider/model monitoring and mock configuration.
2. Add US3 for prompt governance.
3. Add US4 for usage/cost/failure analysis.
4. Add US5 for report and safety review.
5. Complete cross-cutting verification.

At every checkpoint, keep completed stories passing and independently usable.

## Completion Rule

Do not mark a task complete unless its exact file change or command/procedure
was completed and independently checked. Do not claim verification success when
a command was skipped, inferred, or failed. Any task that discovers unrelated
baseline failure must record it and stop rather than hide it with unrelated
changes.
