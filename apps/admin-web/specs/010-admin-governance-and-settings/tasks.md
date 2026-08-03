# Tasks: Admin Team, Roles, Permissions, Settings, and Final Integration

**Input**: `specs/010-admin-governance-and-settings/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Execution audience**: Tasks are intentionally small, ordered, and explicit for a lower-cost implementation model.

## Execution Rules

- Execute tasks in ID order unless a task carries `[P]` and every earlier dependency named in this ledger is complete.
- Edit only the paths named by the current task. Stop and amend this ledger before touching an additional file.
- Run each test-first task before its implementation task; the new assertions must fail for the named missing behavior, not for syntax, import, or setup errors.
- Use existing utilities, components, contracts, dependencies, and patterns before adding code. Do not add a dependency or a second abstraction for an existing boundary.
- Keep route files thin. Pages and feature components must use typed hooks/repositories and must never import fixtures or mutable mock state.
- Use the fixed mock clock. Production code and fixtures must not use `Date.now()`, `Math.random()`, browser persistence, real providers, a backend, a database, or real authentication.
- Treat UI permissions and MSW authorization as frontend simulation only; production authorization remains deferred to the planned backend.
- A task is complete only when its exact verification command exits 0 or its stated read-only check has been recorded in `specs/010-admin-governance-and-settings/verification-report.md`.
- Never mark a final verification task complete without recording the command, exit code, counts, warnings, and failures in `specs/010-admin-governance-and-settings/verification-report.md`.

## Phase 1: Existing Project and Contract Review

**Purpose**: Prove the feature context and reusable boundaries before changing source code.

- [X] T001 Verify `.specify/feature.json` points to `specs/010-admin-governance-and-settings` and `git branch --show-current` reports `010-admin-governance-and-settings`; record both values in `specs/010-admin-governance-and-settings/verification-report.md` and stop before source edits if either value differs
- [X] T002 [P] Review `src/core/permissions/permissions.ts`, `src/core/permissions/role-map.ts`, `src/components/admin/shell-state.ts`, `src/components/admin/AdminShell.tsx`, and `src/components/admin/Breadcrumbs.tsx`; record the exact Phase 9 reuse points and gaps in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T003 [P] Review `src/features/foundation/schemas.ts`, `src/features/foundation/contracts.ts`, `src/features/foundation/repository.ts`, `src/features/foundation/hooks.ts`, `src/components/admin/GlobalSearch.tsx`, and `src/components/admin/AttentionPanel.tsx`; record the exact search/attention extensions and prohibited duplicate boundaries in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T004 [P] Review `src/mocks/handlers/index.ts`, shared MSW setup/reset files, `src/tests/no-direct-fixtures.test.ts`, and one completed feature's fixture/state/handler pattern; record the files to reuse in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T005 Validate `specs/010-admin-governance-and-settings/contracts/admin-governance-settings.openapi.yaml` with `node` and installed `js-yaml`; verify OpenAPI 3.1.0, 15 path groups, 20 unique operations, and resolvable local `$ref` values, then record the result in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T006 Compare the 20 operations in `specs/010-admin-governance-and-settings/contracts/admin-governance-settings.openapi.yaml` with the endpoint table in `specs/010-admin-governance-and-settings/spec.md`; record zero missing and zero extra operations in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T007 Run baseline `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` from `apps/admin-web`; record each command, exit code, exact counts, warnings, generated routes, and any pre-existing failure in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T008 Confirm `.specify/extensions.yml` does not add a tasks hook and `package.json` requires no dependency change for Spec 010; record both checks in `specs/010-admin-governance-and-settings/verification-report.md`

**Gate**: Do not begin Phase 2 on the wrong feature/branch, with an unresolved contract mismatch, or with an unexplained baseline failure.

---

## Phase 2: Frontend Foundations

**Purpose**: Add only the permissions, route rules, shared contracts, transport boundary, deterministic state boundary, and handler registration required by all seven stories.

### Test-first foundation

- [X] T009 [P] Add failing Phase 9 role-matrix tests for all 24 new permission keys and all seven existing switcher roles in `src/core/permissions/role-map.phase9.test.ts`; run `npm run test -- src/core/permissions/role-map.phase9.test.ts` and confirm failures name only missing Phase 9 permissions or assignments
- [X] T010 [P] Add failing route tests for all 16 Phase 9 routes, static-before-dynamic precedence, malformed admin/role IDs, and denied unmatched paths in `src/components/admin/shell-state.test.ts`; run `npm run test -- src/components/admin/shell-state.test.ts` and confirm only new Phase 9 cases fail
- [X] T011 [P] Add failing governance primitive tests for strict objects, IDs, pagination, safe errors, normalized text, control/bidi rejection, fixed audiences, versions, and timestamps in `src/features/governance/contracts.test.ts`; run `npm run test -- src/features/governance/contracts.test.ts` and confirm red foundation cases
- [X] T012 [P] Extend `src/tests/no-direct-fixtures.test.ts` with failing checks that `src/app/admin/admin-team`, `src/app/admin/roles`, `src/app/admin/settings`, and `src/features/governance` cannot import fixtures or mutable state; run `npm run test -- src/tests/no-direct-fixtures.test.ts` and confirm only the new boundary cases fail if violations already exist

### Permissions, routes, and shell

- [X] T013 Add the exact 24 Spec 010 permission keys to `src/core/permissions/permissions.ts`; verify `npm run test -- src/core/permissions/role-map.phase9.test.ts` now fails only on role assignments
- [X] T014 Assign every Phase 9 permission to Super Admin and only the specified security/maintenance permissions to Security Administrator in `src/core/permissions/role-map.ts`, leaving the other five roles unchanged; verify `npm run test -- src/core/permissions/role-map.phase9.test.ts` exits 0
- [X] T015 Register the 16 Phase 9 route rules in `src/components/admin/shell-state.ts`, placing `/invite`, `/new`, `/permissions`, `/edit`, and named settings routes before dynamic/broad matches; verify `npm run test -- src/components/admin/shell-state.test.ts` exits 0
- [X] T016 Add failing shell navigation tests for Governance entries, active state, localization, and role filtering in `src/components/admin/AdminShell.test.tsx`; run `npm run test -- src/components/admin/AdminShell.test.tsx` and confirm only new Phase 9 assertions fail
- [X] T017 Add Admin Team, Roles, and Settings under the existing Governance navigation in `src/mocks/fixtures/foundation.ts`; verify `npm run test -- src/components/admin/AdminShell.test.tsx` exits 0
- [X] T018 Add Arabic/English labels and dynamic admin/role fallbacks for all Phase 9 paths in `src/components/admin/Breadcrumbs.tsx`; verify `npm run test -- src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts` exits 0

### Shared governance boundary

- [X] T019 Implement only the shared strict primitives proven by T011 in `src/features/governance/contracts.ts`, including branded IDs, version, pagination, safe error, normalized text, fixed audience, and timestamp schemas; verify the foundation cases in `npm run test -- src/features/governance/contracts.test.ts` exit 0
- [X] T020 Define one `GovernanceRepository` object with typed method signatures for the 18 governance/settings operations, excluding search and attention which remain in foundation, in `src/features/governance/repository.ts`; run `npm run typecheck` and verify no duplicate service/interface is introduced
- [X] T021 Add the `['phase9-governance']` query-key factory and shared query options to `src/features/governance/hooks.ts`, reusing existing TanStack Query and locked-mutation helpers; run `npm run typecheck`
- [X] T022 Add failing deterministic-state tests for fixed clock, deep reset, immutable fixture separation, version progression, and repeatable generated IDs in `src/mocks/phase9-governance-state.test.ts`; run `npm run test -- src/mocks/phase9-governance-state.test.ts` and confirm red foundation cases
- [X] T023 Add minimal fictional seed exports for system roles, admins, sessions, invitations, settings groups, flags, and maintenance in `src/mocks/fixtures/governance.ts`; verify `npm run test -- src/features/governance/contracts.test.ts` validates each seed export
- [X] T024 Implement fixed-clock initialization, deep reset, read-only snapshots, and deterministic counters in `src/mocks/phase9-governance-state.ts`; verify the foundation cases in `npm run test -- src/mocks/phase9-governance-state.test.ts` exit 0
- [X] T025 Create the empty typed governance MSW handler list in `src/mocks/handlers/governance.ts` without adding operations before their story tests; run `npm run typecheck`
- [X] T026 Register `governanceHandlers` in `src/mocks/handlers/index.ts` and register the Phase 9 state reset in the existing shared test reset file identified by T004; verify `npm run test -- src/mocks/phase9-governance-state.test.ts` passes twice consecutively with identical counts
- [X] T027 Make the new fixture-boundary assertions pass without exemptions in `src/tests/no-direct-fixtures.test.ts`; run `npm run test -- src/tests/no-direct-fixtures.test.ts` and verify exit 0

### Foundation route shells

- [X] T028 Create thin route files for `src/app/admin/admin-team/page.tsx`, `src/app/admin/admin-team/invite/page.tsx`, and `src/app/admin/admin-team/[adminId]/page.tsx` that render exported governance views without fixture imports; run `npm run typecheck`
- [X] T029 Create thin route files for `src/app/admin/roles/page.tsx`, `src/app/admin/roles/new/page.tsx`, `src/app/admin/roles/permissions/page.tsx`, `src/app/admin/roles/[roleId]/page.tsx`, and `src/app/admin/roles/[roleId]/edit/page.tsx`; run `npm run typecheck`
- [X] T030 Create thin route files for all eight paths under `src/app/admin/settings/` plus `src/app/admin/settings/page.tsx`, each rendering its exported settings view; run `npm run typecheck`
- [X] T031 Add minimal exported loading placeholders for every route shell in `src/features/governance/GovernanceViews.tsx` and `src/features/governance/SettingsViews.tsx`; verify `npm run typecheck` and `npm run test -- src/tests/no-direct-fixtures.test.ts` exit 0
- [X] T032 Run `npm run test -- src/core/permissions/role-map.phase9.test.ts src/components/admin/shell-state.test.ts src/components/admin/AdminShell.test.tsx src/features/governance/contracts.test.ts src/mocks/phase9-governance-state.test.ts src/tests/no-direct-fixtures.test.ts`; record the exit code and counts in `specs/010-admin-governance-and-settings/verification-report.md`

**Gate**: T032 must exit 0 before story implementation. The app must contain no backend runtime, real authentication, new dependency, direct page fixture import, or second governance abstraction.

---

## Phase 3: User Story 1 — Govern the Admin Team Safely (P1)

**Goal**: Let Super Admin list and inspect admins, create only Pending invitations, assign roles safely, revoke eligible sessions, and disable eligible admins without self-disable or last-Super-Admin failure.

**Independent test**: Invite a new admin, assign an eligible role, revoke another session, disable an eligible admin, then verify self-disable, current-session revoke, last Active Super Admin removal, and unresolved-ticket transfer are blocked safely.

### Test-first implementation

- [X] T033 [P] [US1] Add failing admin/invitation/session schemas and validation cases in `src/features/governance/contracts.test.ts`, including status enums, 1–120 names, normalized email, 1–30-day expiry, 1000-character message, versions, and strict unknown-field rejection; run the focused test and confirm red US1 cases
- [X] T034 [P] [US1] Add failing admin transition tests in `src/mocks/phase9-governance-state.test.ts` for Pending invite creation, duplicate email, role assignment, session revoke, Active-to-Disabled only, self/current/last-Super-Admin guards, ticket replacement, stale version, and reset; run the focused test and confirm red US1 cases
- [X] T035 [P] [US1] Add failing admin team component tests for loading, empty, error, permission, list/detail/invite states, validation, confirmation, pending lock, focus restoration, and safe success/error messages in `src/features/governance/GovernanceViews.test.tsx`; run the focused test and confirm red US1 cases
- [X] T036 [US1] Add a failing Playwright `US1` scenario for the independent test, Arabic RTL, English LTR, keyboard-only dialogs, and 390px list/detail/invite usability in `tests/e2e/governance-settings.spec.ts`; run `npm run test:e2e -- tests/e2e/governance-settings.spec.ts --grep "US1"` and confirm failure is missing US1 behavior

### Contracts, state, and transport

- [X] T037 [US1] Implement `AdminUser`, `AdminSession`, `AdminInvitation`, admin list/detail, invitation request/result, role assignment, session revoke, disable request/result, and replacement-selection schemas in `src/features/governance/contracts.ts`; verify focused US1 contract tests exit 0
- [X] T038 [US1] Expand `src/mocks/fixtures/governance.ts` with fictional active/disabled admins, active/revoked/expired sessions, Pending/Accepted/Expired/Revoked invitations, Super Admin edge cases, and open-ticket replacement candidates using fixed timestamps; verify focused contract tests validate every US1 fixture
- [X] T039 [US1] Implement admin reads and all guarded US1 transitions in `src/mocks/phase9-governance-state.ts`, ensuring only invitation creation mutates invitation state and no reactivation/resend/revoke/accept/expire transition exists; verify focused state tests exit 0
- [X] T040 [US1] Add failing repository/handler tests for the seven admin-team operations, query/payload encoding, permission checks, strict response parsing, 403/404 privacy, 409 stale/duplicate/ineligible cases, and safe errors in `src/features/governance/repository.test.ts`; run the focused test and confirm red US1 cases
- [X] T041 [US1] Implement the seven typed admin-team repository methods in `src/features/governance/repository.ts`; verify focused repository tests now fail only because handlers are incomplete
- [X] T042 [US1] Implement the seven admin-team MSW handlers in `src/mocks/handlers/governance.ts`, matching specific session/disable/roles paths before broad admin-user paths and authorizing before state access; verify focused repository and state tests exit 0
- [X] T043 [US1] Add failing hook tests for role/version-aware query keys, locked mutation keys, targeted invalidation, and no invalidation after safe conflicts in `src/features/governance/hooks.test.ts`; run the focused test and confirm red US1 cases
- [X] T044 [US1] Implement admin list/detail/invitation queries and invite/disable/revoke/assign locked mutations in `src/features/governance/hooks.ts`; verify focused hook tests exit 0

### UI and route completion

- [X] T045 [US1] Implement the admin list and filter view in `src/features/governance/GovernanceViews.tsx` with approved table/card patterns, non-color status, loading/empty/error/permission regions, and authorized detail links; verify focused component tests pass the list cases
- [X] T046 [US1] Implement the invite form in `src/features/governance/GovernanceViews.tsx` with normalized input, inline validation, fixed expiry range, pending lock, and a result that creates only Pending invitations; verify focused component tests pass invite cases
- [X] T047 [US1] Implement admin detail, role assignment, session revoke, and disable dialogs in `src/features/governance/GovernanceViews.tsx`, including consequences, replacement selection, protected actions, accessible announcements, and focus restoration; verify `npm run test -- src/features/governance/GovernanceViews.test.tsx` exits 0 for US1
- [X] T048 [US1] Wire the three admin-team route files under `src/app/admin/admin-team/` to the completed views and validated route params; verify `npm run test -- src/components/admin/shell-state.test.ts src/tests/no-direct-fixtures.test.ts` exits 0
- [X] T049 [US1] Make the `US1` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify `npm run test:e2e -- tests/e2e/governance-settings.spec.ts --grep "US1"` exits 0
- [X] T050 [US1] Run `npm run test -- src/features/governance/contracts.test.ts src/mocks/phase9-governance-state.test.ts src/features/governance/repository.test.ts src/features/governance/hooks.test.ts src/features/governance/GovernanceViews.test.tsx`; record US1 counts in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T051 [US1] Verify the US1 UI and contracts expose no invitation accept/expire/resend/revoke action and no admin reactivation action by searching `src/features/governance` and `src/app/admin/admin-team`; record zero-or-explained matches in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US1 is an independently runnable MVP with deterministic mock-only mutations.

---

## Phase 4: User Story 2 — Review and Maintain Least-Privilege Roles (P1)

**Goal**: Let authorized admins inspect system/custom roles and the permission matrix, create Active custom roles, edit them, and disable only roles with zero Active Admin assignments.

**Independent test**: Create an Active custom role with a least-privilege permission set, edit its metadata/permissions, disable it after removing Active Admin assignments, and verify system-role mutation, deletion, and assigned-role disable are unavailable or rejected.

### Test-first implementation

- [X] T052 [P] [US2] Add failing role/permission schemas in `src/features/governance/contracts.test.ts` for key regex/length, bilingual names, description, at least one permission, system/custom state, descriptive approval metadata, assignment counts, and exhaustive permission metadata; run the focused test and confirm red US2 cases
- [X] T053 [P] [US2] Add failing role transition tests in `src/mocks/phase9-governance-state.test.ts` for Active custom-role creation, metadata/permission edit, Active↔Disabled update, assigned-role disable conflict, immutable system roles, duplicate key, stale version, no delete, and reset; run the focused test and confirm red US2 cases
- [X] T054 [P] [US2] Add failing roles/permissions component tests for list/detail/create/edit/matrix states, grouping, search, immutable badges, assignment counts, validation, confirmation, permission denial, and no delete control in `src/features/governance/GovernanceViews.test.tsx`; run the focused test and confirm red US2 cases
- [X] T055 [US2] Append a failing Playwright `US2` scenario for the independent test, keyboard matrix navigation, Arabic/English labels, and 390px read-only fallback in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US2"` and confirm red behavior

### Contracts, state, and transport

- [X] T056 [US2] Implement role, permission metadata, permission group, role list/detail, role create/update request/result, and permission matrix schemas in `src/features/governance/contracts.ts`; verify focused US2 contract tests exit 0
- [X] T057 [US2] Add the seven immutable system roles, representative custom roles, exhaustive `PERMISSION_KEYS` metadata, bilingual labels, grouping, approval descriptions, and assignment counts to `src/mocks/fixtures/governance.ts`; verify focused contract and role-map tests exit 0
- [X] T058 [US2] Implement role reads, permission-matrix derivation, create, and guarded update transitions in `src/mocks/phase9-governance-state.ts`, deriving Active Admin assignment counts from admin state; verify focused US2 state tests exit 0
- [X] T059 [US2] Add failing repository/handler tests for role list/create/detail/update and permission list, including filters, parsing, permissions, immutable system roles, duplicate keys, stale versions, and assigned-disable conflict in `src/features/governance/repository.test.ts`; run the focused test and confirm red US2 cases
- [X] T060 [US2] Implement the five typed role/permission repository methods in `src/features/governance/repository.ts`; verify focused repository tests now fail only on handler behavior
- [X] T061 [US2] Implement the five role/permission handlers in `src/mocks/handlers/governance.ts`, authorizing before lookup and returning safe 403/404/409 errors; verify focused repository and state tests exit 0
- [X] T062 [US2] Add failing hook tests for role list/detail/matrix keys, create/update locks, exact invalidation, and conflict behavior in `src/features/governance/hooks.test.ts`; run the focused test and confirm red US2 cases
- [X] T063 [US2] Implement role list/detail/matrix queries and create/update locked mutations in `src/features/governance/hooks.ts`; verify focused US2 hook tests exit 0

### UI and route completion

- [X] T064 [US2] Implement role list/detail views in `src/features/governance/GovernanceViews.tsx` with system/custom identity, state, assignment counts, descriptive approval metadata, and permission summaries; verify focused component tests pass list/detail cases
- [X] T065 [US2] Implement shared create/edit role form behavior directly in `src/features/governance/GovernanceViews.tsx`, reusing existing controls and validating bilingual names, key, description, and one-or-more permissions; verify focused component tests pass form cases
- [X] T066 [US2] Implement the permission matrix view in `src/features/governance/GovernanceViews.tsx` from exhaustive metadata and the existing role map, with semantic table/compact-card behavior and no independent permission mutation endpoint; verify focused component tests pass matrix cases
- [X] T067 [US2] Add guarded role-disable confirmation to `src/features/governance/GovernanceViews.tsx`, showing assignment blockers and never rendering delete or system-role edit controls; verify `npm run test -- src/features/governance/GovernanceViews.test.tsx` exits 0 for US2
- [X] T068 [US2] Wire all five role route files under `src/app/admin/roles/` to completed views and validated params; verify route and no-direct-fixture tests exit 0
- [X] T069 [US2] Make the `US2` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify the command with `--grep "US2"` exits 0
- [X] T070 [US2] Run the focused US2 contract/state/repository/hook/component tests and record exact counts plus zero delete endpoints/controls in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US2 is independently testable and keeps switcher roles, system roles, and custom governance roles distinct.

---

## Phase 5: User Story 3 — Configure Platform and Mobile Settings (P1)

**Goal**: Let authorized admins read and atomically update General, Mobile, Imports, AI, Subscriptions, and Security settings using changed fields plus expected group version.

**Independent test**: Save a valid change in each settings group, verify only changed fields persist and the version advances once, then submit invalid and stale updates and verify the whole group is rejected and reloaded without partial mutation.

### Test-first implementation

- [X] T071 [P] [US3] Add failing strict schema tests for all six settings groups and their exact numeric, enum, URL-host, IANA timezone, allowlist, ordering, and cross-field rules in `src/features/governance/contracts.test.ts`; run the focused test and confirm red US3 cases
- [X] T072 [P] [US3] Add failing atomic settings-state tests in `src/mocks/phase9-governance-state.test.ts` for changed-fields-only updates, expected group version, one version increment, invalid/stale whole-group rejection, no partial write, and reset in every group; run the focused test and confirm red US3 cases
- [X] T073 [P] [US3] Add failing settings component tests for six read/edit screens, dirty tracking, inline validation, save/cancel, pending lock, stale reload, permission states, success/error announcements, RTL/LTR, and responsive layout in `src/features/governance/SettingsViews.test.tsx`; run the focused test and confirm red US3 cases
- [X] T074 [US3] Append a failing Playwright `US3` scenario for the independent test, one representative boundary per group, keyboard forms, and 390px behavior in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US3"` and confirm red behavior

### Contracts and deterministic state

- [X] T075 [US3] Implement General and Mobile settings schemas, field-level patch schemas, and cross-field validation in `src/features/governance/contracts.ts`; verify focused contract tests pass only those two groups
- [X] T076 [US3] Implement Imports and AI settings schemas, patch schemas, and cross-field validation in `src/features/governance/contracts.ts`; verify focused contract tests pass only those two groups
- [X] T077 [US3] Implement Subscriptions and Security settings schemas, patch schemas, and cross-field validation in `src/features/governance/contracts.ts`; verify all focused US3 contract tests exit 0
- [X] T078 [US3] Add valid boundary-rich fixed fixtures for all six settings groups to `src/mocks/fixtures/governance.ts`; verify contract tests parse every settings fixture
- [X] T079 [US3] Implement group lookup and one atomic `updateSettingsGroup` transition in `src/mocks/phase9-governance-state.ts`, selecting the correct existing schema by group without a new abstraction; verify focused US3 state tests exit 0

### Transport and hooks

- [X] T080 [US3] Add failing repository/handler tests for GET and PUT `/api/v1/admin/settings/:group`, all six group names, changed-fields-only payloads, permission projection, strict responses, invalid group, stale version, and safe errors in `src/features/governance/repository.test.ts`; run the focused test and confirm red US3 cases
- [X] T081 [US3] Implement `getSettingsGroup()` and `updateSettingsGroup()` in `src/features/governance/repository.ts`; verify focused repository tests fail only on handlers
- [X] T082 [US3] Implement the settings GET/PUT handlers in `src/mocks/handlers/governance.ts`, validating group and payload before state access and returning 409 with safe reload guidance for stale versions; verify focused repository/state tests exit 0
- [X] T083 [US3] Add failing hook tests for group/role/version-aware keys, per-group mutation locks, exact invalidation, stale reload, and no cross-group invalidation in `src/features/governance/hooks.test.ts`; run the focused test and confirm red US3 cases
- [X] T084 [US3] Implement settings group query and locked update hook in `src/features/governance/hooks.ts`; verify focused US3 hook tests exit 0

### UI and route completion

- [X] T085 [US3] Implement the settings landing view and General/Mobile forms in `src/features/governance/SettingsViews.tsx`, reusing existing field/state components and sending only dirty fields; verify focused component tests pass those screens
- [X] T086 [US3] Implement Imports/AI forms in `src/features/governance/SettingsViews.tsx`, including safe numeric bounds, priority uniqueness, and no secret/provider credential fields; verify focused component tests pass those screens
- [X] T087 [US3] Implement Subscriptions/Security forms in `src/features/governance/SettingsViews.tsx`, including retry dependency and strictly increasing risk thresholds; verify `npm run test -- src/features/governance/SettingsViews.test.tsx` exits 0 for US3
- [X] T088 [US3] Wire `src/app/admin/settings/page.tsx`, `mobile/page.tsx`, `imports/page.tsx`, `ai/page.tsx`, `subscriptions/page.tsx`, and `security/page.tsx` to completed views, make `US3` Playwright green, and verify route/no-fixture tests plus `npm run test:e2e -- tests/e2e/governance-settings.spec.ts --grep "US3"` exit 0

**Checkpoint**: US3 independently proves per-group atomic optimistic-concurrency behavior with no partial save.

---

## Phase 6: User Story 4 — Stage Feature Availability and Maintenance (P1)

**Goal**: Let authorized admins manage fixed-audience feature flags and valid maintenance transitions while keeping Ended flags read-only and rejecting invalid state changes.

**Independent test**: Update rollout/audiences for an editable flag, verify an Ended flag is read-only, schedule and activate maintenance, turn Active maintenance Off, and verify Active-to-Scheduled and Off-to-Off are rejected.

### Test-first implementation

- [X] T089 [P] [US4] Add failing feature-flag and maintenance schemas in `src/features/governance/contracts.test.ts` for statuses, platform, 0–100 rollout, five fixed audiences, schedule fields, versions, and exact maintenance transition requests; run the focused test and confirm red US4 cases
- [X] T090 [P] [US4] Add failing state tests in `src/mocks/phase9-governance-state.test.ts` for editable/Ended flags, fixed audiences, stale versions, and all allowed/rejected maintenance transitions from the data model; run the focused test and confirm red US4 cases
- [X] T091 [P] [US4] Add failing flag/maintenance component tests for list/edit/read-only states, validation, confirmations, pending locks, transition-specific controls, safe conflicts, announcements, and responsive layouts in `src/features/governance/SettingsViews.test.tsx`; run the focused test and confirm red US4 cases
- [X] T092 [US4] Append a failing Playwright `US4` scenario for the independent test, keyboard confirmation, RTL/LTR, and 390px urgent maintenance controls in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US4"` and confirm red behavior

### Contracts, state, and transport

- [X] T093 [US4] Implement feature flag list/update and maintenance read/update schemas in `src/features/governance/contracts.ts`; verify focused US4 contract tests exit 0
- [X] T094 [US4] Add fictional flags covering Disabled/Scheduled/Active/Ended, iOS/Android/Shared, every fixed audience, plus Off/Scheduled/Active maintenance fixtures in `src/mocks/fixtures/governance.ts`; verify focused contract tests parse every fixture
- [X] T095 [US4] Implement guarded feature-flag update and explicit maintenance transition table in `src/mocks/phase9-governance-state.ts`; verify focused US4 state tests exit 0
- [X] T096 [US4] Add failing repository/handler tests for feature-flag GET/PUT and maintenance GET/PUT, including permissions, expected versions, Ended immutability, invalid transitions, 403/404 privacy, and safe 409 errors in `src/features/governance/repository.test.ts`; run the focused test and confirm red US4 cases
- [X] T097 [US4] Implement the four typed feature-flag/maintenance repository methods in `src/features/governance/repository.ts`; verify focused tests fail only on handlers
- [X] T098 [US4] Implement the four MSW handlers in `src/mocks/handlers/governance.ts`, authorizing and validating before state access; verify focused repository and state tests exit 0
- [X] T099 [US4] Add failing hook tests for flag/maintenance keys, entity-specific locks, targeted invalidation, and safe conflicts in `src/features/governance/hooks.test.ts`; run the focused test and confirm red US4 cases
- [X] T100 [US4] Implement feature-flag and maintenance queries/mutations in `src/features/governance/hooks.ts`; verify focused US4 hook tests exit 0

### UI and route completion

- [X] T101 [US4] Implement feature flag list/edit UI in `src/features/governance/SettingsViews.tsx`, using only the five fixed audience choices and rendering Ended flags without mutation controls; verify focused component tests pass flag cases
- [X] T102 [US4] Implement maintenance state, schedule, activation, and turn-off UI in `src/features/governance/SettingsViews.tsx`, rendering only currently valid transitions and still handling server conflicts safely; verify focused component tests pass maintenance cases
- [X] T103 [US4] Wire `src/app/admin/settings/feature-flags/page.tsx` and `src/app/admin/settings/maintenance/page.tsx` to the completed views; verify route and no-direct-fixture tests exit 0
- [X] T104 [US4] Make the `US4` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify the command with `--grep "US4"` exits 0
- [X] T105 [US4] Run focused US4 contract/state/repository/hook/component tests and record exact counts in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T106 [US4] Search the feature contracts, handlers, and UI for custom audience queries, customer ID lists, arbitrary audience text, Ended-flag mutation, and unapproved maintenance transitions; record zero-or-explained matches in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US4 is independently testable with a closed audience set and explicit transition table.

---

## Phase 7: User Story 5 — Search the Completed Admin Product (P1)

**Goal**: Extend the existing global search to include Admin User while preserving all ten prior entity groups, authorization projection, safe snippets, and navigation behavior.

**Independent test**: Search one term that matches navigation and multiple authorized entity groups including Admin User, open an admin result, return with search state preserved, and verify unauthorized groups/results never appear.

### Test-first implementation

- [X] T107 [P] [US5] Add failing foundation schema tests for the eleventh `admin_user` result group, admin result payload, safe snippets, route validation, and strict absence of sensitive admin/session fields in `src/features/foundation/schemas.test.ts`; run the focused test and confirm red US5 cases
- [X] T108 [P] [US5] Add failing repository/handler tests for GET `/api/v1/admin/search` returning all 11 groups with role projection, normalized query, limits, safe errors, and no unauthorized-result existence leak in `src/features/foundation/repository.test.ts`; run the focused test and confirm red US5 cases
- [X] T109 [P] [US5] Add failing Global Search component tests for Admin User grouping, bilingual labels, keyboard selection, state preservation, authorization filtering, empty/error states, and safe rendering in `src/components/admin/GlobalSearch.test.tsx`; run the focused test and confirm red US5 cases
- [X] T110 [US5] Append a failing Playwright `US5` scenario for the independent test, keyboard-only selection, RTL/LTR, and 390px search overlay in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US5"` and confirm red behavior

### Existing-boundary extension

- [X] T111 [US5] Extend the existing global-search schemas/types in `src/features/foundation/schemas.ts` and `src/features/foundation/contracts.ts` with `admin_user`, reusing the current discriminated union and adding no governance search repository; verify focused schema tests exit 0
- [X] T112 [US5] Extend the existing search repository response parsing in `src/features/foundation/repository.ts` for the eleventh group without changing the endpoint or query contract; verify focused repository tests fail only on handler fixtures
- [X] T113 [US5] Add safe fictional Admin User search documents and exact permission projection to `src/mocks/handlers/search.ts`, sourcing allowed read snapshots through the existing state boundary rather than importing mutable arrays into UI code; verify focused repository tests exit 0
- [X] T114 [US5] Update the existing search query key/result typing in `src/features/foundation/hooks.ts` only if required by the discriminated union; verify the focused foundation hook tests and `npm run typecheck` exit 0
- [X] T115 [US5] Render Admin User results and bilingual group labels through the existing result renderer in `src/components/admin/GlobalSearch.tsx`, preserving current keyboard, focus, URL, empty, loading, and error behavior; verify `npm run test -- src/components/admin/GlobalSearch.test.tsx` exits 0
- [X] T116 [US5] Make the `US5` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify the command with `--grep "US5"` exits 0
- [X] T117 [US5] Run focused foundation schema/repository/hook/GlobalSearch tests and record exact counts in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T118 [US5] Verify no second search endpoint, repository, hook, result renderer, or client-side full-data search was added under `src/features/governance`; record the `rg` evidence in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US5 extends the single existing global-search flow and preserves structural authorization.

---

## Phase 8: User Story 6 — Review Cross-Module Attention (P1)

**Goal**: Extend the existing attention panel with ten exact event types, severities, authorized routes, and safe summaries across the completed product.

**Independent test**: Open attention, review events across severity levels, follow an authorized governance event to its target, and verify denied or missing targets are absent rather than disabled or disclosed.

### Test-first implementation

- [X] T119 [P] [US6] Add failing attention schema tests for the ten exact event types, critical/high/medium/low/info severities, safe summaries, timestamps, target routes, stable IDs, and strict unknown-field rejection in `src/features/foundation/schemas.test.ts`; run the focused test and confirm red US6 cases
- [X] T120 [P] [US6] Add failing repository/handler tests for GET `/api/v1/admin/attention`, exact event coverage, severity ordering, stable ties, role projection, denied-target omission, safe errors, and fixed clock in `src/features/foundation/repository.test.ts`; run the focused test and confirm red US6 cases
- [X] T121 [P] [US6] Add failing attention panel tests for severity labels, non-color indicators, bilingual safe summaries, authorized links, omitted denied events, loading/empty/error states, keyboard behavior, and live updates in `src/components/admin/AttentionPanel.test.tsx`; run the focused test and confirm red US6 cases
- [X] T122 [US6] Append a failing Playwright `US6` scenario for the independent test, keyboard navigation, RTL/LTR, and 390px panel behavior in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US6"` and confirm red behavior

### Existing-boundary extension

- [X] T123 [US6] Extend the existing attention schemas/types in `src/features/foundation/schemas.ts` and `src/features/foundation/contracts.ts` with the ten event types and five severities, adding no governance attention repository; verify focused schema tests exit 0
- [X] T124 [US6] Extend the existing attention response parsing in `src/features/foundation/repository.ts` without changing the endpoint boundary; verify focused repository tests fail only on handler content
- [X] T125 [US6] Add fixed fictional cross-module events, stable severity ordering, and target-permission projection to `src/mocks/handlers/attention.ts`; verify focused repository tests exit 0
- [X] T126 [US6] Update the existing attention query typing/key in `src/features/foundation/hooks.ts` only where required by the new union; verify focused foundation hook tests and `npm run typecheck` exit 0
- [X] T127 [US6] Render the new event types through the existing `src/components/admin/AttentionPanel.tsx` layout with safe text, semantic links, and no disabled denied items; verify focused panel tests exit 0
- [X] T128 [US6] Make the `US6` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify the command with `--grep "US6"` exits 0
- [X] T129 [US6] Run focused foundation schema/repository/hook/AttentionPanel tests and record exact counts in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T130 [US6] Verify no second attention endpoint, repository, hook, component, or client-side permission filter was added under `src/features/governance`; record the `rg` evidence in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US6 extends the single existing attention boundary and omits unauthorized events structurally.

---

## Phase 9: User Story 7 — Verify the Complete Admin Frontend (P1)

**Goal**: Prove all ten specs work together across navigation, permissions, localization, accessibility, responsive layouts, deterministic mock state, and final route coverage.

**Independent test**: For each of the seven switcher roles, traverse every authorized navigation destination, confirm every denied destination is absent/directly denied, switch Arabic/English, exercise global search and attention, and complete one safe Phase 9 mutation without regressing prior modules.

### Test-first integration

- [X] T131 [P] [US7] Extend `tests/e2e/permissions.spec.ts` with the complete seven-role Phase 9 navigation/direct-route matrix and verify the new cases fail before integration fixes
- [X] T132 [P] [US7] Extend `tests/e2e/accessibility.spec.ts` with Phase 9 landmarks, headings, labels, error association, dialogs, focus restoration, non-color state, 44px targets, and reduced-motion checks; run the Phase 9 subset and confirm red cases identify missing integration behavior
- [X] T133 [P] [US7] Extend `tests/e2e/performance.spec.ts` with representative admin list, permission matrix, settings form, flag list, maintenance, search, and attention usable-content/interaction samples; run the Phase 9 subset and confirm the measurements execute
- [X] T134 [P] [US7] Extend `tests/e2e/visual-preservation.spec.ts` with Phase 9 route screenshots at approved desktop/tablet/mobile viewports in Arabic and representative English; run the Phase 9 subset and review only new baseline diffs
- [X] T135 [US7] Append a failing Playwright `US7` end-to-end scenario for the independent test in `tests/e2e/governance-settings.spec.ts`; run with `--grep "US7"` and confirm red behavior names an integration gap

### Shell and cross-feature integration

- [X] T136 [US7] Correct only Phase 9 permission/navigation inconsistencies found by T131 in `src/core/permissions/role-map.ts`, `src/components/admin/shell-state.ts`, and `src/mocks/fixtures/foundation.ts`; verify the Phase 9 subset of `tests/e2e/permissions.spec.ts` exits 0
- [X] T137 [US7] Correct only Phase 9 shell active-state, breadcrumb, search-return-state, and attention-link inconsistencies in `src/components/admin/AdminShell.tsx`, `src/components/admin/Breadcrumbs.tsx`, `src/components/admin/GlobalSearch.tsx`, and `src/components/admin/AttentionPanel.tsx`; verify related unit tests exit 0
- [X] T138 [US7] Correct Phase 9 accessibility defects found by T132 in `src/features/governance/GovernanceViews.tsx` and `src/features/governance/SettingsViews.tsx` without changing approved information architecture; verify the Phase 9 accessibility subset exits 0
- [X] T139 [US7] Correct Phase 9 responsive/RTL/LTR defects found by T134 in `src/features/governance/GovernanceViews.tsx` and `src/features/governance/SettingsViews.tsx`, reusing existing layout utilities and tokens; verify the Phase 9 visual-preservation subset exits 0
- [X] T140 [US7] Remove only measured Phase 9 performance blockers found by T133 from `src/features/governance/GovernanceViews.tsx`, `src/features/governance/SettingsViews.tsx`, or their hooks, adding no memoization unless a failing measurement proves it; verify the Phase 9 performance subset exits 0
- [X] T141 [US7] Ensure all Phase 9 state and handler resets are included in the existing shared reset path in `src/mocks/phase9-governance-state.ts` and the reset registration file identified by T004; run governance state/repository/e2e `US1` once, reset, rerun it, and verify identical counts/state

### Complete-product proof

- [X] T142 [US7] Make the `US7` Playwright scenario green in `tests/e2e/governance-settings.spec.ts`; verify the command with `--grep "US7"` exits 0
- [X] T143 [US7] Run `npm run test:e2e -- tests/e2e/governance-settings.spec.ts` and record exact pass/fail/skip counts for US1–US7 in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T144 [US7] Run `npm run test:e2e -- tests/e2e/permissions.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/performance.spec.ts tests/e2e/visual-preservation.spec.ts`; record exact counts, timings, and screenshot decisions in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T145 [US7] Verify all 16 Phase 9 routes render their authorized default/loading/empty/error/permission states without uncaught console errors using the route matrix in `specs/010-admin-governance-and-settings/quickstart.md`; record route-by-route evidence in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T146 [US7] Verify the complete seven-role navigation/direct-route matrix and the 11 search groups plus 10 attention event types against `specs/010-admin-governance-and-settings/spec.md`; record zero missing/extra entries in `specs/010-admin-governance-and-settings/verification-report.md`

**Checkpoint**: US7 proves the complete frontend without adding new product behavior.

---

## Final Phase: Hardening and Verification

**Purpose**: Run complete checks and record evidence; do not add features during this phase.

- [X] T147 Verify Arabic RTL and English LTR at 1440×1000, 1280×900, 1024×900, 768×1024, and 390×844 through `tests/e2e/governance-settings.spec.ts`; record exact viewport outcomes in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T148 Verify keyboard navigation, visible focus, focus restoration, semantic tables/cards/forms, accessible names/descriptions/errors, live announcements, non-color states, contrast, 44px targets, identifier isolation, and reduced motion through the focused accessibility/e2e tests; record results in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T149 Search changed Phase 9 production files for `any`, `dangerouslySetInnerHTML`, direct fixtures, browser storage, `Date.now()`, `Math.random()`, `console`, raw colors, raw HTML/Markdown, public secrets, real provider/backend clients, and new dependencies; record exact `rg` commands and zero-or-explained matches in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T150 Review input/response validation, authorization projection, 403/404 privacy, mutation locks, optimistic concurrency, safe errors, logging, fictional data, links, state reset, and deferred production controls against `specs/010-admin-governance-and-settings/spec.md`; record pass/fail evidence in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T151 Run the focused Vitest command from `specs/010-admin-governance-and-settings/quickstart.md`; record exact file/test/pass/fail/skip counts in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T152 Run `npm run typecheck` from `apps/admin-web`; record the command, exit code, and exact diagnostics in `specs/010-admin-governance-and-settings/verification-report.md`, and leave this task unchecked if nonzero
- [X] T153 Run `npm run lint` from `apps/admin-web`; record the command, exit code, and exact warning/error counts in `specs/010-admin-governance-and-settings/verification-report.md`, and leave this task unchecked if nonzero
- [X] T154 Run `npm run test` from `apps/admin-web`; record the command, exit code, and exact Vitest file/test/pass/fail/skip counts in `specs/010-admin-governance-and-settings/verification-report.md`, and leave this task unchecked if nonzero
- [X] T155 Run `npm run test:e2e` from `apps/admin-web`; record the command, exit code, and exact Playwright pass/fail/skip counts in `specs/010-admin-governance-and-settings/verification-report.md`, and leave this task unchecked if nonzero
- [X] T156 Run `npm run build` from `apps/admin-web`; record the command, exit code, warnings, and generated presence of all 16 Phase 9 routes in `specs/010-admin-governance-and-settings/verification-report.md`, and leave this task unchecked if nonzero
- [X] T157 Revalidate `specs/010-admin-governance-and-settings/contracts/admin-governance-settings.openapi.yaml` and reconcile all 20 operations with implemented repository methods and handlers; record zero missing/extra operations in `specs/010-admin-governance-and-settings/verification-report.md`
- [X] T158 Reconcile every checked item in `specs/010-admin-governance-and-settings/tasks.md` with executable evidence in `specs/010-admin-governance-and-settings/verification-report.md`; uncheck unsupported claims, list every remaining limitation or deferred backend control, and verify zero unsupported checked items remain

---

## Dependencies

### Phase ordering

1. Phase 1 blocks all source changes.
2. Phase 2 blocks every user story.
3. US1, US2, and US3 can begin independently after Phase 2, but tasks inside each story remain ordered.
4. US4 requires Phase 2 only; it may run alongside US1–US3 because its state slices and UI route files are distinct.
5. US5 requires US1 and US2 so Admin User routes, permissions, and role-aware results exist.
6. US6 requires US1–US4 so every governance/setting attention target exists and is permission-addressable.
7. US7 requires US1–US6.
8. Final hardening requires US7.

### User-story dependency graph

```text
Phase 1 → Phase 2 ─┬→ US1 ─┬→ US5 ─┐
                   ├→ US2 ─┘       │
                   ├→ US3 ─┐       ├→ US7 → Final
                   └→ US4 ─┴→ US6 ─┘
```

## Parallel Execution Examples

- **Foundation**: After T008, T009, T010, T011, and T012 can run in parallel because they touch four different test files; merge before T013.
- **US1**: After T032, T033, T034, and T035 can run in parallel; T036 may also run in parallel because it touches only the E2E file, but no later story may edit that file concurrently.
- **US2**: After US1 has released shared files, T052, T053, and T054 can run in parallel; run T055 separately from other E2E edits.
- **US3**: T071, T072, and T073 can run in parallel; T075–T077 must remain ordered because they share `contracts.ts`.
- **US4**: T089, T090, and T091 can run in parallel after Phase 2; serialize any shared `contracts.ts`, state, handler, hook, or E2E edits with US1–US3.
- **US5**: T107, T108, and T109 can run in parallel; implementation remains in the existing foundation boundary.
- **US6**: T119, T120, and T121 can run in parallel; do not overlap their shared foundation implementation files with unfinished US5 work.
- **US7**: T131–T134 can run in parallel because each touches a distinct E2E file; T135 must not overlap other edits to `governance-settings.spec.ts`.

## Implementation Strategy

### MVP

Complete T001–T051. This delivers the foundation plus independently testable Admin Team governance without waiting for settings, search, attention, or final-product verification.

### Incremental delivery

1. Deliver US1 as the MVP.
2. Add US2 least-privilege role maintenance.
3. Add US3 atomic settings groups.
4. Add US4 feature flags and maintenance.
5. Extend the existing search with US5.
6. Extend the existing attention panel with US6.
7. Run US7 and final hardening only after all independent stories are green.

## Completion Rule

Do not mark a verification task complete or claim success unless its command or procedure was actually executed successfully and recorded. A lower-cost executor must stop at the first unexplained failure, preserve the failure evidence, and fix only the currently scoped task.




