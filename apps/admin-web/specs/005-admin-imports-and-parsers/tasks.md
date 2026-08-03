# Tasks: Imports, Automation, Banks, and Parser Management

**Input**: `specs/005-admin-imports-and-parsers/spec.md`, `plan.md`,
`research.md`, `data-model.md`, `contracts/admin-imports-parsers.openapi.yaml`,
and `quickstart.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Vitest and Playwright are required for every changed behavior

Every task uses:

```text
- [example] [TaskID] [P?] [US?] Imperative description with exact file path
```

- `[P]` means the task touches a different file and has no unmet dependency.
- User-story labels appear only in user-story phases.
- Run RED tasks before their matching implementation task. Mark a RED task
  complete only after the named test was executed and failed for the expected
  missing behavior.
- Do not initialize a project, add a dependency, build a backend/parser runtime,
  or create `RuleManagementViews.tsx` unless `ParserViews.tsx` later has a
  measured cohesion problem documented in this file.
- Mark verification tasks complete only from actual successful command output.

## Phase 1: Existing Project and Contract Review

**Purpose**: Preserve completed work, establish evidence, and prevent duplicate
implementation.

- [x] T001 Inspect `git status --short` and `git diff -- .` from `apps/admin-web`, then record pre-existing Spec 005 changes without editing or reverting them in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T002 Record the approved `/admin/imports` layout, cards, charts, table, drawer, Arabic copy, tokens, and responsive behaviors that must remain unchanged in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T003 Trace the current `/admin/imports` flow from `src/app/admin/imports/page.tsx` through `src/features/imports/hooks.ts`, `src/features/imports/repository.ts`, and `src/mocks/handlers/imports.ts`, then record reused and replaced boundaries in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T004 Reconcile all 27 OpenAPI operations in `specs/005-admin-imports-and-parsers/contracts/admin-imports-parsers.openapi.yaml` with US1-US6 and record any mismatch before implementation in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T005 Reconcile the 16 Phase 4 routes and 14 permissions from `specs/005-admin-imports-and-parsers/spec.md` with `src/components/admin/shell-state.ts`, `src/core/permissions/permissions.ts`, and `src/core/permissions/role-map.ts`, then record gaps in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T006 Run `npm run typecheck` before edits and record the exact exit result as baseline evidence in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T007 Run `npm run lint` before edits and record the exact exit result as baseline evidence in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T008 Run `npm run test` before edits and record the exact test counts and exit result as baseline evidence in `specs/005-admin-imports-and-parsers/verification-report.md`
- [ ] T009 Run `npm run test:e2e` before edits and record the exact project/test counts and exit result as baseline evidence in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T010 Run `npm run build` before edits and record the exact exit result as baseline evidence in `specs/005-admin-imports-and-parsers/verification-report.md`

**Gate**: Existing failures are documented, not silently attributed to Spec 005.
No approved page or completed prior-spec work is overwritten.

---

## Phase 2: Frontend Foundations

**Purpose**: Add only the shared security, permission, validation, and mock-state
prerequisites that block every story.

### Tests first

- [ ] T011 [P] Add failing tests for all 14 Spec 005 permission keys and the intended role grants in `src/core/permissions/role-map.test.ts`
- [ ] T012 [P] Add failing tests proving Spec 005 repositories send only the allowlisted development role header and reject invalid simulated roles in `src/features/imports/repository.test.ts`
- [ ] T013 [P] Add failing tests for SafeId prefixes, strict unknown-field rejection, UTF-8 byte bounds, page sizes 25/50/100, page maximum 100, and safe API errors in `src/features/imports/contracts.test.ts`
- [ ] T014 [P] Add failing tests for immutable snapshots, expected-state/revision conflicts, pending locks, reset behavior, and duplicate-submission rejection in `src/mocks/phase4-import-state.test.ts`
- [ ] T015 [P] Extend the architecture test to reject direct import-fixture imports from pages, components, hooks, and repositories in `src/tests/no-direct-fixtures.test.ts`
- [ ] T016 Run `npm run test -- src/core/permissions/role-map.test.ts src/features/imports/repository.test.ts src/features/imports/contracts.test.ts src/mocks/phase4-import-state.test.ts src/tests/no-direct-fixtures.test.ts` and confirm the new assertions fail for the expected missing foundations

### Shared implementation

- [x] T017 Add the 14 Spec 005 permission constants exactly as named in the specification to `src/core/permissions/permissions.ts`
- [x] T018 Grant least-privilege Spec 005 read/action permissions to existing Admin roles without creating new roles in `src/core/permissions/role-map.ts`
- [x] T019 Map all specific import and parser routes before the broad `/admin/imports` prefix and assign their required read permissions in `src/components/admin/shell-state.ts`
- [x] T020 Add only the validated `x-admin-simulated-role` development request header, sourced from the existing `admin-simulated-role` session value and omitted for invalid values, in `src/core/api/client.ts`
- [x] T021 Define shared SafeId, access projection, platform/source, pagination, bounded-text, audit-reference, and safe-error Zod schemas with strict objects in `src/features/imports/contracts.ts`
- [x] T022 Implement UTF-8 byte-bound validation with the native `TextEncoder` and no new utility package in `src/features/imports/contracts.ts`
- [x] T023 Define shared typed list-query parsing that normalizes page/pageSize/search/filter/sort values before URL construction in `src/features/imports/contracts.ts`
- [x] T024 Implement the minimal immutable Phase 4 in-memory snapshot, reset, revision, expected-state, and pending-lock helpers in `src/mocks/phase4-import-state.ts`
- [x] T025 Add safe MSW helpers that parse requests, validate responses, select full/limited/context projections before serialization, and return allowlisted errors in `src/mocks/handlers/imports.ts`
- [x] T026 Add deterministic Phase 4 scenario selection for success, slow, empty, large, partial, unauthorized, forbidden, not-found, gone, validation, conflict, rate-limit, unavailable, unsafe-response, internal-error, and duplicate-pending states in `src/mocks/handlers/imports.ts`
- [x] T027 Run `npm run test -- src/core/permissions/role-map.test.ts src/features/imports/repository.test.ts src/features/imports/contracts.test.ts src/mocks/phase4-import-state.test.ts src/tests/no-direct-fixtures.test.ts` and fix only foundation defects until it passes

**Gate**: No page imports fixtures; mock permission enforcement is explicitly
development-only; untrusted identifiers, queries, requests, and responses cross
strict Zod boundaries; no dependency or backend runtime is added.

---

## Phase 3: User Story 1 — Monitor Import Operations (P1)

**Goal**: An import operator can identify the highest-failure source and reach a
correctly filtered session list using authoritative platform/event semantics.

**Independent test**: On `/admin/imports`, switch among All, Android, and iOS,
identify the highest-failure source, open `/admin/imports/sessions` with that
filter, and verify no unique-customer value is derived by adding platforms.

### Tests first

- [ ] T028 [P] [US1] Add failing contract tests for overview metrics, authoritative customer totals, non-duplicated additive event totals, source/platform compatibility, region states, session-list invariants, and pagination in `src/features/imports/contracts.test.ts`
- [ ] T029 [P] [US1] Add failing repository tests for validated overview/session query serialization, response rejection, filters, sorting, and pagination in `src/features/imports/repository.test.ts`
- [ ] T030 [P] [US1] Add failing hook tests for stable query keys, All/Android/iOS refetching, loading, partial, empty, and error states in `src/features/imports/hooks.test.ts`
- [ ] T031 [P] [US1] Add failing production-view tests for approved overview preservation, accessible chart summaries, metric units, filter controls, session rows, and safe plain-text rendering in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T032 [P] [US1] Add a failing Playwright journey for overview-to-filtered-sessions, authoritative counts, Arabic RTL, keyboard use, and runtime-console cleanliness in `tests/e2e/imports-parsers.spec.ts`
- [ ] T033 [US1] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and confirm US1 assertions fail for the expected missing behavior

### Implementation

- [x] T034 [US1] Add strict `ImportMetric`, `ImportOverview`, `ImportSessionListItem`, region-state, and session-list response schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T035 [US1] Replace affected legacy import fixture shapes with deterministic UAE/Saudi, Arabic/English, source, platform, retry/replay, and deduplication-safe overview/session fixtures in `src/mocks/fixtures/imports.ts`
- [x] T036 [US1] Add typed `getImportOverview` and `listImportSessions` repository methods for the OpenAPI paths in `src/features/imports/repository.ts`
- [x] T037 [US1] Add TanStack Query hooks for overview and sessions with normalized filters and stable query keys in `src/features/imports/hooks.ts`
- [x] T038 [US1] Preserve the approved cards, charts, density, drawer styling, Arabic copy, and semantic tokens while connecting the overview to typed hooks in `src/features/imports/ImportsViews.tsx`
- [x] T039 [US1] Implement the accessible session table/cards, search, platform/source/status/bank/version filters, sorting, pagination, and relevant loading/empty/partial/error/warning/permission states in `src/features/imports/ImportsViews.tsx`
- [x] T040 [US1] Keep `src/app/admin/imports/page.tsx` thin by rendering the approved typed overview view without fixture or direct HTTP imports
- [x] T041 [US1] Create the thin permission-aware route composition for `/admin/imports/sessions` in `src/app/admin/imports/sessions/page.tsx`
- [x] T042 [US1] Implement validated GET handlers for `/api/v1/admin/imports/overview` and `/api/v1/admin/imports/sessions`, including structurally reduced projections and unsafe-response scenarios, in `src/mocks/handlers/imports.ts`
- [x] T043 [US1] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record US1 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US1 works independently and preserves the approved overview.

---

## Phase 4: User Story 2 — Investigate an Import Session (P1)

**Goal**: An authorized operator can inspect a sanitized session and create one
confirmed, non-duplicated mock retry handoff.

**Independent test**: Open a valid session detail, verify projection-based
masking and timeline/item summaries, then exercise retry success, pending lock,
forbidden, stale-state conflict, and not-found outcomes.

### Tests first

- [ ] T044 [P] [US2] Add failing contract tests for sanitized preview allowlists, masked value-bearing fields, full/limited/context structural projections, timeline/item invariants, retry requests, and safe results in `src/features/imports/contracts.test.ts`
- [ ] T045 [P] [US2] Add failing repository tests for encoded SafeId detail paths, retry payload validation, unsafe-response rejection, and forbidden/conflict errors in `src/features/imports/repository.test.ts`
- [ ] T046 [P] [US2] Add failing hook tests for detail query enablement, retry pending lock, cache invalidation, duplicate submission, and conflict recovery in `src/features/imports/hooks.test.ts`
- [ ] T047 [P] [US2] Add failing view tests for bidirectional IDs, masked preview, omission labels, confirmation scope/consequence, focus restoration, and status announcements in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T048 [P] [US2] Extend the failing session-detail Playwright journey with limited/context projections, retry confirmation, keyboard cancel/confirm, pending lock, conflict, and not-found cases in `tests/e2e/imports-parsers.spec.ts`
- [ ] T049 [US2] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and confirm US2 assertions fail for the expected missing behavior

### Implementation

- [x] T050 [US2] Add strict sanitized-preview, session-detail, retry-handoff request, and action-result schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T051 [US2] Seed full/limited/context session details, safe timeline data, retry-eligible/ineligible states, and conflict/not-found scenarios in `src/mocks/fixtures/imports.ts`
- [x] T052 [US2] Add typed `getImportSession` and `createImportRetryHandoff` repository methods in `src/features/imports/repository.ts`
- [x] T053 [US2] Add detail and locked retry-handoff hooks with targeted cache invalidation in `src/features/imports/hooks.ts`
- [x] T054 [US2] Add the sanitized session detail, confirmation dialog, pending lock, conflict recovery, focus restoration, and all relevant region states to `src/features/imports/ImportsViews.tsx`
- [x] T055 [US2] Create the thin validated and permission-aware dynamic route for `/admin/imports/sessions/[importId]` in `src/app/admin/imports/sessions/[importId]/page.tsx`
- [x] T056 [US2] Implement validated detail and retry-handoff handlers with projection-before-serialization, permission enforcement, expected state/revision, idempotency, and audit reference in `src/mocks/handlers/imports.ts`
- [x] T057 [US2] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record exact US2 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US2 is independently testable and exposes no raw imported
content or customer-derived value.

---

## Phase 5: User Story 3 — Triage Exceptions and Data Quality (P1)

**Goal**: Authorized operators can review and resolve failed, low-confidence,
duplicate, and unsupported items through bounded simulated outcomes.

**Independent test**: For each queue, filter and open an item, perform every
allowed outcome with confirmation, and verify permissions, reason bounds,
expected-state conflicts, pending locks, masking, and audit references.

### Tests first

- [ ] T058 [P] [US3] Add failing contracts for failed-import records/actions, state transitions, filters, bounded reasons, and safe results in `src/features/imports/contracts.test.ts`
- [ ] T059 [US3] Add failing contracts for low-confidence eligibility, backend-supplied suggestions, accept/correct/defer/unsupported actions, and prohibited transaction creation in `src/features/imports/contracts.test.ts`
- [ ] T060 [US3] Add failing contracts for duplicate candidate comparisons, confirm/reject/defer actions, original-event semantics, and masking in `src/features/imports/contracts.test.ts`
- [ ] T061 [US3] Add failing contracts for unsupported-format previews, omission labels, assign/unsupported/rule-draft-handoff/defer actions, and safe projections in `src/features/imports/contracts.test.ts`
- [ ] T062 [P] [US3] Add failing repository tests for all eight US3 GET/POST operations, query encoding, payload bounds, response validation, and safe error mapping in `src/features/imports/repository.test.ts`
- [ ] T063 [P] [US3] Add failing hook tests for four queue query keys, locked mutations, precise invalidation, conflicts, and duplicate submissions in `src/features/imports/hooks.test.ts`
- [ ] T064 [P] [US3] Add failing view tests for four data-dense queues, comparison semantics, eligibility labels, confirmations, permission states, and accessible outcomes in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T065 [P] [US3] Extend the failing Playwright journey across failed, low-confidence, duplicate, and unsupported routes with keyboard actions and privacy checks in `tests/e2e/imports-parsers.spec.ts`
- [ ] T066 [US3] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and confirm the US3 assertions fail for the expected missing behavior

### Implementation

- [x] T067 [US3] Add strict failed-import, low-confidence, duplicate-candidate, unsupported-format, four action-request, and action-result schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T068 [US3] Add deterministic masked fixtures for every US3 queue, platform/source/bank/parser filters, eligibility outcome, empty/partial/large state, and stale/conflict case in `src/mocks/fixtures/imports.ts`
- [x] T069 [US3] Extend Phase 4 state transitions for all allowed US3 outcomes while preserving original import totals and immutable audit references in `src/mocks/phase4-import-state.ts`
- [x] T070 [US3] Add typed list/action repository methods for failed, low-confidence, duplicate, and unsupported OpenAPI operations in `src/features/imports/repository.ts`
- [x] T071 [US3] Add query and locked mutation hooks for all four queues with exact-key invalidation in `src/features/imports/hooks.ts`
- [x] T072 [US3] Add failed-import, low-confidence, duplicate-comparison, and unsupported-format views with all relevant states and no raw payload rendering in `src/features/imports/ImportsViews.tsx`
- [x] T073 [US3] Create the thin permission-aware failed-import route in `src/app/admin/imports/failed/page.tsx`
- [x] T074 [US3] Create the thin permission-aware low-confidence route in `src/app/admin/imports/low-confidence/page.tsx`
- [x] T075 [US3] Create the thin permission-aware duplicate-candidate route in `src/app/admin/imports/duplicates/page.tsx`
- [x] T076 [US3] Create the thin permission-aware unsupported-format route in `src/app/admin/imports/unsupported/page.tsx`
- [x] T077 [US3] Implement validated GET/action handlers for failed and low-confidence queues with permissions, projections, state/revision checks, and safe audit results in `src/mocks/handlers/imports.ts`
- [x] T078 [US3] Implement validated GET/action handlers for duplicate and unsupported queues with permissions, projections, state/revision checks, and safe audit results in `src/mocks/handlers/imports.ts`
- [x] T079 [US3] Add import queue destinations to the existing Admin navigation/search fixtures without changing the approved shell design in `src/mocks/fixtures/foundation.ts`
- [x] T080 [US3] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record exact US3 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US3 is independently testable; every action is simulated,
confirmed, permission-aware, locked while pending, and safely audited.

---

## Phase 6: User Story 4 — Manage Bank and Sender Coverage (P1)

**Goal**: Operators can inspect supported-bank coverage and safely simulate
bounded sender-rule changes.

**Independent test**: Review bank list/detail regions, filter senders, reject
malformed/unsafe/overlapping/stale sender changes, and complete an authorized
confirmed change without exposing parser definitions to limited roles.

### Tests first

- [ ] T081 [P] [US4] Add failing contracts for bank list/detail regions, sender records, platform/language/source compatibility, pattern bounds, overlap conflicts, projections, and sender actions in `src/features/imports/contracts.test.ts`
- [ ] T082 [P] [US4] Add failing repository tests for bank list/detail and sender list/action operations, encoded IDs, validation, projections, and safe errors in `src/features/imports/repository.test.ts`
- [ ] T083 [P] [US4] Add failing hook tests for bank/detail/sender queries, locked sender mutations, invalidation, and stale-revision recovery in `src/features/imports/hooks.test.ts`
- [ ] T084 [P] [US4] Add failing view tests for bank region states, sender filters/forms, plain-text patterns, confirmation, permission labels, and 390px desktop-required bulk configuration in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T085 [P] [US4] Extend the failing Playwright journey for bank/detail/sender routes, invalid/overlap inputs, denied actions, keyboard flow, and masking in `tests/e2e/imports-parsers.spec.ts`
- [ ] T086 [US4] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and confirm the US4 assertions fail for the expected missing behavior

### Implementation

- [x] T087 [US4] Add strict bank-coverage, bank-detail, sender-rule, sender-action request/result, and projection schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T088 [US4] Seed deterministic bank regions, masked sender coverage, valid/invalid/overlap/stale sender cases, and full/limited/context projections in `src/mocks/fixtures/imports.ts`
- [x] T089 [US4] Add typed bank list/detail and sender list/action repository methods in `src/features/imports/repository.ts`
- [x] T090 [US4] Add bank/detail/sender queries and locked sender mutation hooks with targeted invalidation in `src/features/imports/hooks.ts`
- [x] T091 [US4] Implement bank list/detail and sender-management views with relevant region states, safe patterns, bounded forms, confirmations, and responsive behavior in `src/features/imports/ParserViews.tsx`
- [x] T092 [US4] Create the thin permission-aware bank-list route in `src/app/admin/parsers/banks/page.tsx`
- [x] T093 [US4] Create the thin validated bank-detail route in `src/app/admin/parsers/banks/[bankId]/page.tsx`
- [x] T094 [US4] Create the thin permission-aware sender-management route in `src/app/admin/parsers/senders/page.tsx`
- [x] T095 [US4] Implement validated bank list/detail and sender list/action handlers with structural projections, overlap checks, state/revision locks, and safe audit results in `src/mocks/handlers/imports.ts`
- [x] T096 [US4] Activate the planned Parser Management navigation and add bank/sender search destinations without redesigning the shell in `src/mocks/fixtures/foundation.ts`
- [x] T097 [US4] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record exact US4 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US4 is independently testable and all sender changes remain
validated mock operations.

---

## Phase 7: User Story 5 — Manage Parser Rules, Tests, and Versions (P1)

**Goal**: Authorized parser operators can manage bounded declarative rules,
compare fictional test previews, and exercise the immutable version lifecycle.

**Independent test**: Reject executable/recursive/oversized rule definitions,
run a labelled fictional preview, block release when required tests fail, then
complete Draft → Testing → Active → Retired and verify rollback creates a new
Draft without changing history.

### Tests first

- [ ] T098 [P] [US5] Add failing contracts for allowlisted match/capture/normalize/map operations and rejection of executable content, dynamic expressions, recursion, network fields, unknown keys, bidi abuse, and size violations in `src/features/imports/contracts.test.ts`
- [ ] T099 [US5] Add failing contracts for parser rule list/detail/action records, fictional sample markers, test-preview expected/actual values, and limited/context structural omission in `src/features/imports/contracts.test.ts`
- [ ] T100 [US5] Add failing contracts for parser test cases and Draft/Testing/Active/Retired versions, one-active-per-scope, mandatory-test gating, invalid transitions, and rollback-as-new-Draft in `src/features/imports/contracts.test.ts`
- [ ] T101 [P] [US5] Add failing repository tests for all parser-rule, preview, test-case, and version OpenAPI operations with strict request/response validation in `src/features/imports/repository.test.ts`
- [ ] T102 [P] [US5] Add failing hook tests for rule/detail/test/version queries, locked actions, preview isolation, release gating, and precise invalidation in `src/features/imports/hooks.test.ts`
- [ ] T103 [P] [US5] Add failing state tests for immutable version history, one active version per scope, enabled-required-test gating, invalid/stale transitions, idempotency, and rollback lineage in `src/mocks/phase4-import-state.test.ts`
- [ ] T104 [P] [US5] Add failing view tests for declarative editor controls, fictional preview labels, test comparison, lifecycle gates, confirmations, announcements, focus restoration, and 390px desktop-required states in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T105 [P] [US5] Extend the failing Playwright journey across rule list/editor, test cases, and versions with unsafe input, release gating, rollback, permissions, keyboard flow, and no raw customer content in `tests/e2e/imports-parsers.spec.ts`
- [ ] T106 [US5] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx src/mocks/phase4-import-state.test.ts` and confirm the US5 assertions fail for the expected missing behavior

### Implementation

- [x] T107 [US5] Add strict declarative rule-definition, parser rule/detail/action, fictional sample, preview result, test case, version, and version-action schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T108 [US5] Seed deterministic Arabic/English declarative rules, explicitly fictional samples, pass/fail required tests, lifecycle versions, unsafe input, stale version, and projection scenarios in `src/mocks/fixtures/imports.ts`
- [x] T109 [US5] Implement minimal immutable rule/test/version transitions, mandatory-test gating, one-active-per-scope, and rollback-to-new-Draft behavior in `src/mocks/phase4-import-state.ts`
- [x] T110 [US5] Add typed parser rule list/detail/preview/action, test-case list, version list/action repository methods in `src/features/imports/repository.ts`
- [x] T111 [US5] Add parser rule/detail/preview/test/version query and locked mutation hooks with exact invalidation in `src/features/imports/hooks.ts`
- [x] T112 [US5] Implement parser rule list/editor and fictional test-preview views using bounded declarative controls, plain text, permission projections, confirmations, and complete states in `src/features/imports/ParserViews.tsx`
- [x] T113 [US5] Implement parser test-case and version-lifecycle views with required-test gates, immutable history, rollback lineage, accessible outcomes, and desktop-required mobile states in `src/features/imports/ParserViews.tsx`
- [x] T114 [US5] Create the thin permission-aware parser-rule list route in `src/app/admin/parsers/rules/page.tsx`
- [x] T115 [US5] Create the thin validated parser-rule detail/editor route in `src/app/admin/parsers/rules/[ruleId]/page.tsx`
- [x] T116 [US5] Create the thin permission-aware parser test-case route in `src/app/admin/parsers/test-cases/page.tsx`
- [x] T117 [US5] Create the thin permission-aware parser-version route in `src/app/admin/parsers/versions/page.tsx`
- [x] T118 [US5] Implement validated rule list/detail/preview/action handlers with declarative validation, projection enforcement, locks, conflicts, and safe audit results in `src/mocks/handlers/imports.ts`
- [x] T119 [US5] Implement validated test-case and version list/action handlers with required-test gates, one-active-per-scope, immutable history, rollback lineage, and safe errors in `src/mocks/handlers/imports.ts`
- [x] T120 [US5] Add parser rule, test-case, and version destinations to existing Admin navigation/search fixtures without adding a new shell abstraction in `src/mocks/fixtures/foundation.ts`
- [x] T121 [US5] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx src/mocks/phase4-import-state.test.ts` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record exact US5 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US5 is independently testable; no arbitrary parser code runs,
customer data never enters parser tests, and version history remains immutable.

---

## Phase 8: User Story 6 — Maintain Merchant and Category Rules (P2)

**Goal**: Authorized operators can safely simulate bounded merchant-alias and
category-rule maintenance.

**Independent test**: Validate alias count/length, name/pattern/confidence/scope
bounds, overlap conflicts, confirmations, permissions, pending locks, and safe
results on both rule routes.

### Tests first

- [ ] T122 [P] [US6] Add failing contracts for merchant rules/actions, canonical names, maximum 20 unique aliases of 120 characters, scopes, conflicts, revisions, and safe results in `src/features/imports/contracts.test.ts`
- [ ] T123 [US6] Add failing contracts for category rules/actions, allowlisted patterns, confidence bounds, category/scope compatibility, conflicts, revisions, and safe results in `src/features/imports/contracts.test.ts`
- [ ] T124 [P] [US6] Add failing repository and hook tests for merchant/category list/action operations, validation, locked mutations, conflicts, and invalidation in `src/features/imports/repository.test.ts` and `src/features/imports/hooks.test.ts`
- [ ] T125 [P] [US6] Add failing view tests for merchant/category tables, bounded forms, overlap warnings, confirmations, permissions, announcements, and desktop-required bulk controls in `src/features/imports/ImportParserViews.test.tsx`
- [ ] T126 [P] [US6] Extend the failing Playwright journey for merchant/category rules with bounds, overlap conflicts, denied actions, keyboard flow, and responsive behavior in `tests/e2e/imports-parsers.spec.ts`
- [ ] T127 [US6] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and confirm the US6 assertions fail for the expected missing behavior

### Implementation

- [x] T128 [US6] Add strict merchant-rule, category-rule, action-request, and action-result schemas inferred into TypeScript types in `src/features/imports/contracts.ts`
- [x] T129 [US6] Seed deterministic merchant aliases, category patterns, boundary values, overlap conflicts, stale revisions, projections, and empty/large/error scenarios in `src/mocks/fixtures/imports.ts`
- [x] T130 [US6] Add typed merchant/category list/action repository methods and locked hooks with exact cache invalidation in `src/features/imports/repository.ts` and `src/features/imports/hooks.ts`
- [x] T131 [US6] Add merchant/category rule views to the existing cohesive parser view file with safe plain-text rendering, bounded forms, confirmations, and complete states in `src/features/imports/ParserViews.tsx`
- [x] T132 [US6] Create the thin permission-aware merchant-rule route in `src/app/admin/parsers/merchant-rules/page.tsx`
- [x] T133 [US6] Create the thin permission-aware category-rule route in `src/app/admin/parsers/category-rules/page.tsx`
- [x] T134 [US6] Implement validated merchant/category list/action handlers with projection enforcement, overlap checks, revisions, pending locks, and safe audit results in `src/mocks/handlers/imports.ts`
- [x] T135 [US6] Run `npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx` and `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440`, then record exact US6 results in `specs/005-admin-imports-and-parsers/verification-report.md`

**Checkpoint**: US6 is independently testable and does not create real
transactions, categories, parsers, or backend records.

---

## Final Phase: Hardening and Verification

- [x] T136 [P] Extend route-permission Playwright coverage for all 16 Phase 4 routes, all action permissions, hidden/disabled controls, direct forbidden mock mutations, and session-expired states in `tests/e2e/permissions.spec.ts`
- [x] T137 [P] Extend accessibility Playwright coverage for Phase 4 landmarks, headings, tables/cards/forms/dialogs, chart summaries, accessible names, live outcomes, visible focus, focus restoration, 44px targets, and reduced motion in `tests/e2e/accessibility.spec.ts`
- [x] T138 [P] Add approved `/admin/imports` preservation assertions and blocking-overflow checks for Phase 4 routes without introducing new visual design in `tests/e2e/visual-preservation.spec.ts`
- [x] T139 Extend `tests/e2e/imports-parsers.spec.ts` to smoke all 16 routes under success, loading/slow, empty, partial, forbidden, not-found/gone, conflict, rate-limit, unavailable, unsafe-response, internal-error, and pending-duplicate scenarios where applicable
- [x] T140 Run Phase 4 Playwright journeys at 1440px via `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440` and record exact results in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T141 Run Phase 4 Playwright journeys at 1280px via `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1280` and record exact results in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T142 Run Phase 4 Playwright journeys at 1024px via `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=tablet-1024` and record exact results in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T143 Run Phase 4 Playwright journeys at 768px via `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=tablet-768` and record exact results in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T144 Run Phase 4 Playwright journeys at 390px via `npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=mobile-390` and record exact results in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T145 Verify Arabic RTL and English LTR readiness, bidirectional identifiers, logical spacing, keyboard flows, and desktop-required mobile states across all Phase 4 routes, then record evidence in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T146 Scan changed production files for `any`, direct fixtures, `Date.now()`, `Math.random()`, `dangerouslySetInnerHTML`, raw customer/import payloads, browser persistence, debug logs, secrets, unsafe public environment values, backend code, new dependencies, and avoidable raw colors, then record zero findings or exact fixes in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T147 Confirm All/Android/iOS compatibility, authoritative unique-customer totals, explicitly non-duplicated additive events, and retry/replay/duplicate non-inflation through production contract tests in `src/features/imports/contracts.test.ts`
- [x] T148 Confirm customer previews contain only allowlisted masked fields, limited/context responses structurally omit protected data, and full values appear only in labelled fictional parser samples through production tests in `src/features/imports/contracts.test.ts` and `src/features/imports/ImportParserViews.test.tsx`
- [x] T149 Run `npm run typecheck` and record the exact successful exit result in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T150 Run `npm run lint` and record the exact successful exit result in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T151 Run `npm run test` and record exact passing test counts and exit result in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T152 Run `npm run test:e2e` and record exact passing project/test counts and exit result in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T153 Run `npm run build` and record the exact successful exit result in `specs/005-admin-imports-and-parsers/verification-report.md`
- [x] T154 Reconcile FR-001–FR-040, AC-001–AC-016, and SC-001–SC-009 against production files and executed evidence, then mark only supported tasks complete and document every deferral in `specs/005-admin-imports-and-parsers/verification-report.md`

## Dependencies

```text
Phase 1 review
    ↓
Phase 2 foundations
    ↓
US1 overview/sessions
    ├──→ US2 session detail/retry
    └──→ US3 exception triage
US1 + Phase 2
    └──→ US4 bank/sender coverage
US4
    └──→ US5 parser rules/tests/versions
US5
    └──→ US6 merchant/category rules
All selected stories
    ↓
Final hardening and verification
```

- Phase 1 precedes all edits; Phase 2 blocks every user story.
- US2 and US3 may proceed in parallel after US1 because they touch the same
  files in separate commits and must not be edited concurrently in one worktree.
- US4 depends on the shared US1 filters/contracts, not on US2 or US3.
- US5 depends on US4 coverage entities and permissions.
- US6 depends on US5 parser rule conventions and is outside the MVP.
- The final phase runs after every in-scope story selected for release.

## Parallel Execution Examples

### US1

Run T028-T032 in parallel because they edit separate test files. After T033,
perform T034-T042 in order because they share contracts, fixtures, repository,
hooks, views, routes, and handlers.

### US2

Run T044-T048 in parallel. After the RED gate T049, perform T050-T056 in order.

### US3

Run T058, T062, T063, T064, and T065 in parallel; keep T059-T061 sequential
with T058 because they edit the same contract test. Implement T067-T079 in
order.

### US4

Run T081-T085 in parallel. After T086, perform T087-T096 in order.

### US5

Run T098, T101, T102, T103, T104, and T105 in parallel; keep T099-T100
sequential with T098 because they edit the same contract test. Implement
T107-T120 in order.

### US6

Run T122, T124, T125, and T126 in parallel; keep T123 sequential with T122.
Implement T128-T134 in order.

## Implementation Strategy

### MVP first

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Run T043 and verify the approved overview plus filtered sessions.
4. Demonstrate the MVP before beginning session actions or parser management.

### Incremental delivery

1. Add US2 and verify safe session detail/retry.
2. Add US3 and verify all exception queues.
3. Add US4 and verify bank/sender coverage.
4. Add US5 and verify declarative parser/version safety.
5. Add P2 US6 only after all P1 stories pass.
6. Run the final hardening phase once for the assembled Phase 4 scope.

## Independent Test Criteria Summary

- **US1**: authoritative overview and filtered sessions work for All, Android,
  and iOS without derived unique-customer totals.
- **US2**: detail projections mask data structurally and retry is confirmed,
  locked, permission-aware, conflict-safe, and simulated.
- **US3**: all four exception queues support only their specified bounded,
  confirmed, state-aware outcomes.
- **US4**: bank regions render safely and sender changes reject malformed,
  unsafe, overlapping, unauthorized, and stale requests.
- **US5**: only bounded declarative rules are accepted; fictional previews and
  the immutable, test-gated version lifecycle work.
- **US6**: merchant/category changes enforce every alias, pattern, confidence,
  scope, overlap, permission, revision, and pending constraint.

## Completion Rule

Do not mark a test, verification, or completion task checked unless its exact
command or procedure was executed successfully. Similar code, inferred
behavior, placeholders, and false-green tests are not completion evidence.
