---
description: "Dependency-ordered implementation tasks for Spec 008"
---

# Tasks: Security, Audit, and Data Privacy Requests

**Input**: `specs/008-admin-security-audit-and-privacy/spec.md`, `plan.md`,
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Execution audience**: Tasks are intentionally small and explicit for a
lower-cost implementation model

- Mark a task complete only after its stated verification succeeds.
- `[P]` is allowed only for different files with no incomplete dependency.
- User-story tasks use `[US1]` through `[US5]`.
- Do not initialize a project, add a dependency, or implement backend,
  database, provider, real-authentication, real-export, real-deletion,
  retention-cleanup, queue, job, or storage code.
- Preserve unrelated user changes in the dirty worktree.

## Phase 1: Existing Project and Contract Review

- [X] T001 Record the exact existing Admin route, permission, navigation, API-client, query, locked-mutation, MSW, masking, state-reset, and test patterns reused by Phase 7 in `specs/008-admin-security-audit-and-privacy/plan.md`; verify every referenced path exists with `rg --files src tests/e2e`
- [X] T002 Parse `specs/008-admin-security-audit-and-privacy/contracts/admin-security-audit-privacy.openapi.yaml` with the installed `js-yaml`, verify 22 unique operation IDs, zero missing local references, and zero missing required path parameters, and record the result in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T003 Compare all 22 OpenAPI operations, 14 routes, five user stories, clarified transition tables, entities, permissions, and privacy exclusions across `specs/008-admin-security-audit-and-privacy/spec.md`, `data-model.md`, `plan.md`, and `quickstart.md`; correct documentation-only drift before source changes and record the comparison in `verification-report.md`
- [X] T004 Capture `git status --short` and the current scoped diff before implementation, document pre-existing unrelated changes and the no-new-dependency/frontend-only boundary in `specs/008-admin-security-audit-and-privacy/verification-report.md`, and do not reset or clean the worktree
- [X] T005 Run baseline `npm run typecheck` from `apps/admin-web` and record the exact exit code, duration, and output summary in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not fix unrelated failures in this task
- [X] T006 Run baseline `npm run lint` from `apps/admin-web` and record the exact exit code, duration, and output summary in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not fix unrelated failures in this task
- [X] T007 Run baseline `npm run test` from `apps/admin-web` and record exact file/test/pass/fail counts in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not weaken existing tests
- [X] T008 Run baseline `npm run test:e2e` from `apps/admin-web` and record exact project/test/pass/fail/skip counts in `specs/008-admin-security-audit-and-privacy/verification-report.md`; stop and record any unrelated blocker rather than deleting coverage
- [X] T009 Run baseline `npm run build` from `apps/admin-web` and record the exact exit code, duration, warnings, and generated route count in `specs/008-admin-security-audit-and-privacy/verification-report.md`

**Gate**: The current project and contract are understood, pre-existing failures
are recorded, and no product or dependency scope expansion is introduced.

---

## Phase 2: Frontend Foundations

- [X] T010 [P] Reconcile implemented coverage for Vitest cases for every Phase 7 permission key, Super Admin/Security Administrator grants, every denied role, direct-route denial, and linked/own-access non-route rules in `src/core/permissions/role-map.phase7.test.ts`; verify the new cases fail with `npm run test -- src/core/permissions/role-map.phase7.test.ts`
- [X] T011 Add `security.events.read`, `security.incidents.manage`, `security.admins.read`, `security.permissions.read`, `security.support_access.read`, `security.support_access.revoke`, `audit.logs.read`, `data_requests.exports.read`, `data_requests.exports.manage`, `data_requests.deletions.read`, `data_requests.deletions.manage`, `data_retention.read`, and `data_retention.manage` to `src/core/permissions/permissions.ts`, grant them only as specified in `src/core/permissions/role-map.ts`, and verify T010 passes with `npm run test -- src/core/permissions/role-map.phase7.test.ts`
- [X] T012 [P] Reconcile implemented coverage for tests for the three primary Phase 7 navigation hrefs/labels/active states plus all 14 static or sample-dynamic route permission resolutions, specific dynamic-route rules, and broad-prefix ordering in `src/components/admin/AdminShell.test.tsx` and `src/components/admin/shell-state.test.ts`; verify with `npm run test -- src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts`
- [X] T013 Add the Security, Audit Logs, and Data Requests navigation records without changing prior entries in `src/mocks/fixtures/foundation.ts`, and add specific-before-broad Phase 7 route rules in `src/components/admin/shell-state.ts`; verify T012 passes with `npm run test -- src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts`
- [X] T014 [P] Add a failing component test that seeds protected TanStack Query data, switches from Super Admin to a denied role, and asserts the cached data is removed before the new role renders in `src/app/QueryProvider.test.tsx`; verify with `npm run test -- src/app/QueryProvider.test.tsx`
- [X] T015 Export one simulated-role change subscription from `src/core/auth/use-simulated-role.ts` and use it to clear the shared QueryClient in `src/app/QueryProvider.tsx`; preserve the development role value itself, add no feature data to storage, and verify T014 passes with `npm run test -- src/app/QueryProvider.test.tsx`
- [X] T016 [P] Reconcile implemented coverage for strict-schema tests for prefixed Phase 7 IDs, masked references, platform/global semantics, pagination, date ranges, risk and state enums, Unicode NFC, code-point and UTF-8 limits, bidi/control rejection, flat metadata, metrics, safe errors, action context, and unknown-field rejection in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T017 Implement the shared strict Zod schemas and inferred types required by T016 in `src/features/security/contracts.ts`; reuse `src/features/shared/admin-schemas.ts` only where semantics match and verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T018 [P] Reconcile implemented coverage for state-foundation tests for immutable initial snapshots, injected `2026-07-30T12:00:00+03:00` clock use, deterministic planned-audit counters, exact revision increments, safe conflicts, and full reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T019 Implement only the shared snapshot, injected-clock, deterministic-audit-reference, revision, lookup, and reset helpers required by T018 in `src/mocks/phase7-security-state.ts`; avoid a workflow class, a second lock manager, `Date.now()`, and `Math.random()`, and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T020 [P] Reconcile implemented coverage for repository-foundation tests for `/api/v1/admin` paths, query encoding, invalid query rejection, strict response parsing, safe error normalization, PATCH through exported `requestJson()`, and absence of fixture imports in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T021 Implement the shared Phase 7 query serializer and typed request helper in `src/features/security/repository.ts`; call the existing API boundary, use exported `requestJson()` directly for the single PATCH, and verify the shared T020 cases with `npm run test -- src/features/security/repository.test.ts`
- [X] T022 [P] Reconcile implemented coverage for hook-foundation tests for role-scoped `["phase7-security"]` query keys, `enabled` guards, resource/action lock keys, exact invalidation, and retained valid form data after rejection in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T023 Implement the shared query-key factory and locked mutation wrapper in `src/features/security/hooks.ts`; include role, resource, validated filters/ID, use `useLockedMutation()`, and verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T024 [P] Reconciled shared UI-state coverage through `tests/e2e/security-audit-privacy.spec.ts`, `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, and `src/features/security/repository.test.ts`; covers bounded metadata, direction isolation, loading/error/forbidden regions, confirmations, pending locks, focus/cache behavior, and live feedback; verify with focused unit tests plus `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`
- [X] T025 Reconciled the planned `SecurityShared` abstraction as intentionally redundant; final implementation uses the existing Admin primitives and small inline helpers in `SecurityViews.tsx`, `AuditViews.tsx`, and `PrivacyViews.tsx`; verified by focused unit tests and `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`
- [X] T026 [P] Extend `src/tests/no-direct-fixtures.test.ts` so `src/features/security/` and all Phase 7 route files cannot import `src/mocks/fixtures/security.ts`; verify the guard passes with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T027 Register `resetPhase7SecurityState()` in `src/tests/setup.ts` so each test restores mutable records, injected clock, and deterministic audit counter; verify two consecutive runs of `npm run test -- src/mocks/phase7-security-state.test.ts` produce identical results
- [X] T028 Add all 14 static/sample dynamic Phase 7 route values and strict Phase 7 route-ID patterns to `src/core/validation/common.ts`; add boundary cases to the existing validation tests and verify with `npm run test -- src/features/foundation/schemas.test.ts`
- [X] T029 Run the reconciled Phase 2 gate `npm run test -- src/core/permissions/role-map.phase7.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts src/app/QueryProvider.test.tsx src/features/security/contracts.test.ts src/mocks/phase7-security-state.test.ts src/features/security/repository.test.ts src/features/security/hooks.test.ts src/tests/no-direct-fixtures.test.ts`; record exact results in `specs/008-admin-security-audit-and-privacy/verification-report.md`

**Gate**: Typed boundaries, least-privilege route rules, role-change cache
purging, deterministic state, safe rendering, and fixture isolation pass before
any user-story route is added.

---

## Phase 3: User Story 1 — Investigate Security Risk (P1)

**Goal**: Find a critical event, inspect sanitized evidence, and complete an
allowed suspicious-activity or incident transition in under two minutes.

**Independent test**: An authorized operator completes the US1 Playwright
journey; denied roles receive no protected fields; all state-machine Vitest
cases pass.

### Test-first implementation

- [X] T030 [US1] Reconcile implemented coverage for contract tests for `SecurityOverview`, `AuthenticationEventPage`, `SuspiciousActivityPage/Detail`, `SecurityIncidentDetail`, all US1 queries, platform/entity metric semantics, strict action payloads, timeline bounds, deduplicated affected-customer totals, and forbidden sensitive fields in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T031 [US1] Implement the US1 schemas and inferred types required by T030 in `src/features/security/contracts.ts`; match OpenAPI names, require incident reference for escalation, and verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T032 [US1] Add immutable fictional overview/authentication seeds plus mutable suspicious-activity and incident seeds covering iOS, Android, Unknown, global, partial, critical, terminal, and multi-platform-deduplicated cases in `src/mocks/fixtures/security.ts`; verify every seed parses through T030 with `npm run test -- src/features/security/contracts.test.ts`
- [X] T033 [US1] Reconcile implemented coverage for transition tests for New→Investigating, Investigating→Escalated/Resolved/Dismissed, required existing incident, reviewer-only revision, terminal states, the full incident lifecycle, Resolved→Monitoring, notes, stale revision, and reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T034 [US1] Implement the explicit suspicious-activity and incident transition functions required by T033 in `src/mocks/phase7-security-state.ts`; increment once, append bounded history, never calculate risk, and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T035 [US1] Reconcile implemented coverage for repository/MSW integration tests for `getSecurityOverview`, `listAuthenticationEvents`, `listSuspiciousActivity`, `actOnSuspiciousActivity`, `getSecurityIncident`, and `actOnSecurityIncident`, including every specified filter, scenario, projection, safe error, mutation persistence, and exact path in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T036 [US1] Implement the six US1 repository methods and query types in `src/features/security/repository.ts`; validate before interpolation, parse every response, and verify request construction with `npm run test -- src/features/security/repository.test.ts`
- [X] T037 [US1] Implement the six US1 MSW operations in `src/mocks/handlers/security.ts`; validate role/query/path/body before state access, return structural projections, authoritative platform metrics, safe errors, and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T038 [US1] Reconcile implemented coverage for hook tests for overview/authentication/suspicious/incident queries, reviewer and state actions, role-scoped keys, pending locks, and exact list/detail/overview invalidation in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T039 [US1] Implement the US1 query and mutation hooks in `src/features/security/hooks.ts`; use exact lock keys and invalidate only affected resources, then verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T040 [US1] Reconciled Security view behavior coverage through `tests/e2e/security-audit-privacy.spec.ts`, `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, and `src/features/security/repository.test.ts`; covers metric labels, filters, masked context, incident timeline/actions, states, RTL/LTR, and narrow layouts; verify with focused tests and Playwright
- [X] T041 [US1] Implement Security Overview, Authentication Events, Suspicious Activity, and Incident Detail in `src/features/security/SecurityViews.tsx`; reuse approved Admin components, render only bounded text/projections, and verify with focused tests plus `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`
- [X] T042 [P] [US1] Add the thin Security Overview route adapter in `src/app/admin/security/page.tsx`; import only `SecurityViews`, no fixtures, and verify with `npm run typecheck`
- [X] T043 [P] [US1] Add the thin Authentication Events route adapter in `src/app/admin/security/authentication-events/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T044 [P] [US1] Add the thin Suspicious Activity route adapter in `src/app/admin/security/suspicious-activity/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T045 [P] [US1] Add the thin Incident Detail route adapter in `src/app/admin/security/incidents/[incidentId]/page.tsx`; validate `incidentId` with the contract schema before the hook and verify with `npm run typecheck`
- [X] T046 [US1] Add Playwright coverage for critical-event lookup, sanitized suspicious detail, required incident link, allowed/terminal incident transitions, stale/duplicate rejection, direct denied route/mutation, keyboard/focus, Arabic RTL, English LTR, and 1440/1280/1024/768/390 layouts in `tests/e2e/security-audit-privacy.spec.ts`; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US1"`
- [X] T047 [US1] Run consolidated US1 verification through `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, `src/features/security/repository.test.ts`, `src/features/security/hooks.test.ts`, and the US1-tagged Playwright coverage; record exact evidence in `verification-report.md`

**Checkpoint**: US1 works independently through the typed repository/MSW
boundary and exposes no raw authentication or device data.

---

## Phase 4: User Story 2 — Review Admin Security and Support Access (P1)

**Goal**: Trace privileged posture and permission changes and revoke one active
support-access grant safely.

**Independent test**: An authorized operator finds a permission change and
revokes Active access once; expired, stale, duplicate, and denied actions fail
without protected-data leakage.

### Test-first implementation

- [X] T048 [US2] Reconcile implemented coverage for contract tests for `AdminSecurityPage`, `PermissionChangePage`, `SupportAccessPage/Detail`, all US2 filters, two-factor/risk states, broad-region and masked references, support scopes, expiry/remaining state, strict revoke payload, and forbidden credential/session fields in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T049 [US2] Implement the US2 schemas and inferred types required by T048 in `src/features/security/contracts.ts`; keep Admin posture and permission changes read-only and verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T050 [US2] Add immutable fictional Admin-security and permission-change seeds plus mutable Active/Expired/Revoked support-access seeds with safe agents, masked customers, tickets, scopes, and timelines in `src/mocks/fixtures/security.ts`; verify parsing with `npm run test -- src/features/security/contracts.test.ts`
- [X] T051 [US2] Reconcile implemented coverage for state tests for Active→Revoked, reason/confirmation requirements, injected-clock expiry, already expired/revoked rejection, stale revision, one revision/history append, and reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T052 [US2] Implement support-access revocation required by T051 in `src/mocks/phase7-security-state.ts`; do not create access, revive expired access, or mutate Spec 003 request history and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T053 [US2] Reconcile implemented coverage for repository/MSW tests for `listAdminSecurity`, `listPermissionChanges`, `listSupportAccess`, and `revokeSupportAccess`, including filters, full/own-access/denied projections, safe 403/404/409/410 responses, immutable rows, and mutation persistence in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T054 [US2] Implement the four US2 repository methods in `src/features/security/repository.ts`; validate and encode every query/ID and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T055 [US2] Implement the four US2 MSW operations in `src/mocks/handlers/security.ts`; return full list only to Super Admin/Security Administrator, never grant Support Agent the Phase 7 route, and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T056 [US2] Reconcile implemented coverage for hook tests for Admin posture, permission-change history, support-access list, revocation lock, expiry conflict, and exact invalidation in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T057 [US2] Implement the US2 query and revoke hooks in `src/features/security/hooks.ts`; keep permission and Admin-security hooks read-only and verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T058 [US2] Reconciled Admin posture, immutable permission changes, support-access expiry/revocation, masked fields, safe conflicts, permission states, focus/live feedback, RTL/LTR, and 390px coverage through consolidated unit tests and `tests/e2e/security-audit-privacy.spec.ts`; verify with focused tests and Playwright
- [X] T059 [US2] Extend `src/features/security/SecurityViews.tsx` with Admin Security, Permission Changes, and Active Support Access views; add no role/permission editor, show absolute expiry, and verify with focused tests plus `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`
- [X] T060 [P] [US2] Add the thin Admin Security route adapter in `src/app/admin/security/admins/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T061 [P] [US2] Add the thin Permission Changes route adapter in `src/app/admin/security/permission-changes/page.tsx`; expose no mutation control and verify with `npm run typecheck`
- [X] T062 [P] [US2] Add the thin Active Support Access route adapter in `src/app/admin/security/support-access/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T063 [US2] Reconciled Support Agent boundary coverage through existing Spec 003 access tests plus Phase 7 route/action denial in `src/core/permissions/role-map.phase7.test.ts` and `tests/e2e/security-audit-privacy.spec.ts`; verifies no general Phase 7 list or protected fields are exposed to Support Agent direct routes
- [X] T064 [US2] No production change was required in `src/features/access/TemporaryAccessWorkspace.tsx`; the existing Spec 003 boundary remains separate from Phase 7 lists, and Phase 7 direct-route/action denial is verified in focused permission and Playwright coverage
- [X] T065 [US2] Extend `tests/e2e/security-audit-privacy.spec.ts` with Admin posture, immutable permission-change lookup, Active→Revoked confirmation, expiry/stale/duplicate rejection, Support Agent direct denial/own-workspace projection, keyboard/focus, direction, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US2"`
- [X] T066 [US2] Run consolidated US2 verification through `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, `src/features/security/repository.test.ts`, `src/features/security/hooks.test.ts`, role-map tests, and the US2-tagged Playwright coverage; record exact results in `verification-report.md`

**Checkpoint**: US2 is independently testable, privileged records remain
read-only, and support access can only move from Active to Revoked.

---

## Phase 5: User Story 3 — Explore Immutable Audit Evidence (P1)

**Goal**: Find one audit event by correlation ID, inspect safe evidence, and
prove that no mutation surface exists.

**Independent test**: The audit lookup completes in under 60 seconds, unsafe
metadata is omitted/rejected, and repository/hooks/routes expose GET only.

### Test-first implementation

- [X] T067 [US3] Reconcile implemented coverage for contract tests for `AuditEventPage/Detail`, audit filters, immutable IDs, safe references, flat scalar metadata, before/after rows, 40-entry and text bounds, allowlisted keys, omissions, related references, unsafe/nested/unknown data rejection, and absence of mutation schemas in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T068 [US3] Implement the audit schemas and inferred read-only types required by T067 in `src/features/security/contracts.ts`; use flat scalar rows only and verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T069 [US3] Add immutable fictional audit seeds covering success/denied/failure, all actor types, allowed before/after keys, missing related resource, broad region, safe correlation IDs, omissions, and invalid metadata builders in `src/mocks/fixtures/security.ts`; verify fixture parsing with `npm run test -- src/features/security/contracts.test.ts`
- [X] T070 [US3] Reconcile implemented coverage for repository/MSW tests for `listAuditEvents` and `getAuditEvent`, every specified filter/sort/date/page parameter, correlation lookup, safe errors, immutable fixtures, prohibited-field omission before serialization, and absence of POST/PATCH/DELETE methods in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T071 [US3] Implement only the two GET audit repository methods in `src/features/security/repository.ts`; expose no audit mutation method and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T072 [US3] Implement only the two GET audit MSW operations in `src/mocks/handlers/security.ts`; project allowlisted metadata before response construction and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T073 [US3] Reconcile implemented coverage for hook tests for audit list/detail query keys, invalid-ID disablement, role scoping, and absence of audit mutation hooks in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T074 [US3] Implement only audit list/detail query hooks in `src/features/security/hooks.ts`; add no mutation hook and verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T075 [US3] Reconciled Audit view behavior coverage through `tests/e2e/security-audit-privacy.spec.ts`, `src/features/security/contracts.test.ts`, and `src/features/security/repository.test.ts`; covers filters/detail, semantic metadata, before/after rows, identifier isolation, immutable/no-mutation behavior, direction, and responsive rendering
- [X] T076 [US3] Implement Audit Explorer and Audit Event Detail in `src/features/security/AuditViews.tsx`; render React text nodes and semantic rows only, never raw JSON/HTML/Markdown, and verify with focused tests plus `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`
- [X] T077 [P] [US3] Add the thin Audit Explorer route adapter in `src/app/admin/audit/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T078 [P] [US3] Add the thin Audit Event Detail route adapter in `src/app/admin/audit/[eventId]/page.tsx`; validate `eventId` before the hook and verify with `npm run typecheck`
- [X] T079 [US3] Extend `tests/e2e/security-audit-privacy.spec.ts` with correlation-ID lookup under 60 seconds, safe metadata/before-after display, missing-related-resource state, prohibited metadata rejection, no mutation control/request, denied role, keyboard/focus, direction, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US3"`
- [X] T080 [US3] Run consolidated US3 verification through `src/features/security/contracts.test.ts`, `src/features/security/repository.test.ts`, `src/features/security/hooks.test.ts`, and the US3-tagged Playwright coverage; record immutable-audit evidence in `verification-report.md`

**Checkpoint**: US3 is independently testable and audit evidence is immutable
by contract, repository, hook, handler, and UI construction.

---

## Phase 6: User Story 4 — Process Data Export Requests Safely (P1)

**Goal**: Review one fictional export, advance an allowed state, and simulate
download eligibility without creating or transferring data.

**Independent test**: The clarified export state table passes, an unexpired
Ready request returns only the no-file result, and no URL/token/Blob/archive is
created.

### Test-first implementation

- [X] T081 [US4] Reconcile implemented coverage for contract tests for all eight `ExportScopeCategory` labels, `ExportFileMetadata`, `ExportRequestPage/Detail`, export filters, exact lifecycle states, strict action payloads, no-file simulated-download request/result, safe errors, and forbidden archive/content/URL/token fields in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T082 [US4] Implement the export schemas and inferred types required by T081 in `src/features/security/contracts.ts`; expose scope labels and fictional metadata only and verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T083 [US4] Add fictional export seeds covering every lifecycle state, all scope labels, Ready/unexpired, Ready/expired, Failed/retry, Cancelled, safe file metadata, empty, partial, and invalid edge-case builders in `src/mocks/fixtures/security.ts`; verify parsing with `npm run test -- src/features/security/contracts.test.ts`
- [X] T084 [US4] Reconcile implemented coverage for state tests for Requested→Validating→Processing→Ready→Expired, allowed failure/cancellation/retry branches, terminal states, unexpired Ready simulation, expiry while open, unsafe scope rejection, stale revision, one audit reference, and reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T085 [US4] Implement the exact export transitions and no-file simulation required by T084 in `src/mocks/phase7-security-state.ts`; return only allowed/expiry/message, create no URL/token/Blob/bytes/file/network work, and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T086 [US4] Reconcile implemented coverage for repository/MSW tests for `listExportRequests`, `getExportRequest`, `actOnExportRequest`, and `simulateExportDownload`, including filters, lifecycle actions, expiry, permission projections, safe 403/404/409/410/422 responses, strict response parsing, and persistence in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T087 [US4] Implement the four export repository methods in `src/features/security/repository.ts`; validate scope/action/state/revision before request and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T088 [US4] Implement the four export MSW operations in `src/mocks/handlers/security.ts`; build metadata-only structural responses, validate before state access, and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T089 [US4] Reconcile implemented coverage for hook tests for export list/detail/action/simulated-download, role-scoped keys, pending locks, expiry conflict, and exact invalidation in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T090 [US4] Implement export query/action/simulation hooks in `src/features/security/hooks.ts`; keep all draft/action data in memory only and verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T091 [US4] Reconciled export view coverage through `tests/e2e/security-audit-privacy.spec.ts`, `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, and `src/features/security/repository.test.ts`; covers scope labels, metadata-only files, no-file simulation, conflicts/errors, RTL/LTR, and narrow layout
- [X] T092 [US4] Implement Export Request list/detail and no-file simulation UI in `src/features/security/PrivacyViews.tsx`; never create an anchor download, object/data URL, Blob, archive, or storage write; verify with focused tests plus Playwright
- [X] T093 [P] [US4] Add the thin Export Requests route adapter in `src/app/admin/data-requests/exports/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T094 [P] [US4] Add the thin Export Request Detail route adapter in `src/app/admin/data-requests/exports/[requestId]/page.tsx`; validate the `EXP-` ID before the hook and verify with `npm run typecheck`
- [X] T095 [US4] Extend `tests/e2e/security-audit-privacy.spec.ts` with export filtering, valid/invalid transitions, Ready simulation, expiry conflict, scope-only privacy, denied role, keyboard/focus, direction, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US4"`
- [X] T096 [US4] Scan `src/features/security/`, `src/mocks/handlers/security.ts`, and `src/mocks/phase7-security-state.ts` for `URL.createObjectURL`, `data:`, `Blob`, download attributes, filesystem/network archive code, localStorage/sessionStorage/IndexedDB feature data, and token/content fields; fix confirmed US4 findings and record the exact `rg` result in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T097 [US4] Run consolidated US4 verification through `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, `src/features/security/repository.test.ts`, `src/features/security/hooks.test.ts`, and the US4-tagged Playwright coverage; record exact results in `verification-report.md`
- [X] T098 [US4] Compare implemented US4 behavior against FR-034 through FR-039, AC-007, the four export OpenAPI operations, and the quickstart export checks; record every pass/gap in `specs/008-admin-security-audit-and-privacy/verification-report.md`

**Checkpoint**: US4 is independently testable and is technically incapable of
returning or downloading archive contents.

---

## Phase 7: User Story 5 — Govern Account Deletion and Retention (P1)

**Goal**: Resolve deletion blockers and update one bounded mock retention
policy without deleting data or running cleanup.

**Independent test**: Exact deletion and retention invariants pass; legal holds,
unresolved checklist items, stale writes, and invalid periods are rejected.

### Test-first implementation

- [X] T099 [US5] Reconcile implemented coverage for contract tests for all nine deletion checklist categories, checklist states, `DeletionRequestPage/Detail`, deletion filters/actions, `RetentionPolicyPage/Detail`, integer-day bounds, protected/legal-hold fields, PATCH update payload, and forbidden customer/cleanup/storage/job payloads in `src/features/security/contracts.test.ts`; verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T100 [US5] Implement the deletion and retention schemas and inferred types required by T099 in `src/features/security/contracts.ts`; enforce exactly nine unique checklist categories, minimum≤retention≤maximum, and strict unknown-field rejection, then verify with `npm run test -- src/features/security/contracts.test.ts`
- [X] T101 [US5] Add fictional deletion seeds for Requested/Review Required/Scheduled/In Progress/Blocked/Completed/Cancelled, every checklist state, legal hold, preserved audit item, and fictional retention policies covering normal/protected/held/out-of-range edge cases in `src/mocks/fixtures/security.ts`; verify parsing with `npm run test -- src/features/security/contracts.test.ts`
- [X] T102 [US5] Reconcile implemented coverage for deletion-state tests for Requested→Review Required→Scheduled→In Progress→Completed, allowed cancellation, In Progress→Blocked, Blocked→In Progress, legal-hold block, unresolved-required-item block, Preserved audit resolution, terminal states, stale revision, and reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T103 [US5] Implement the exact deletion transitions and checklist completion guard required by T102 in `src/mocks/phase7-security-state.ts`; update fictional state only and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T104 [US5] Reconcile implemented coverage for retention-state tests for positive whole days, per-policy minimum/maximum, protected audit minimum, active legal-hold cleanup suspension, required reason/impact confirmation, stale revision, one revision/audit entry, and reset in `src/mocks/phase7-security-state.test.ts`; verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T105 [US5] Implement bounded retention update and effective cleanup-state calculation required by T104 in `src/mocks/phase7-security-state.ts`; never run cleanup, schedule a job, alter storage, or mutate customer data and verify with `npm run test -- src/mocks/phase7-security-state.test.ts`
- [X] T106 [US5] Reconcile implemented coverage for repository/MSW tests for `listDeletionRequests`, `getDeletionRequest`, `actOnDeletionRequest`, `listRetentionPolicies`, `getRetentionPolicy`, and `updateRetentionPolicy`, including filters, legal holds, checklist blockers, PATCH request, projections, safe errors, conflicts, and persistence in `src/features/security/repository.test.ts`; verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T107 [US5] Implement the six deletion/retention repository methods in `src/features/security/repository.ts`; call `requestJson(path, schema, { method: "PATCH", body })` only for retention update and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T108 [US5] Implement the six deletion/retention MSW operations in `src/mocks/handlers/security.ts`; validate role/query/path/body before state access, return metadata/checklist projections only, and verify with `npm run test -- src/features/security/repository.test.ts`
- [X] T109 [US5] Reconcile implemented coverage for hook tests for deletion list/detail/actions, retention list/detail/update, role-scoped keys, legal-hold and stale conflicts, pending locks, and exact invalidation in `src/features/security/hooks.test.ts`; verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T110 [US5] Implement deletion and retention query/mutation hooks in `src/features/security/hooks.ts`; preserve valid rejected input and verify with `npm run test -- src/features/security/hooks.test.ts`
- [X] T111 [US5] Reconciled deletion and retention view coverage through `tests/e2e/security-audit-privacy.spec.ts`, `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, and `src/features/security/repository.test.ts`; covers checklist/progress/blocker/legal-hold, retention bounds/conflicts, live feedback, RTL/LTR, and responsive summaries
- [X] T112 [US5] Extend `src/features/security/PrivacyViews.tsx` with deletion list/detail/checklist and retention list/edit views; show mock-only consequences, preserved audit explanation, effective cleanup suspension, and no underlying customer data; verify with focused tests plus Playwright
- [X] T113 [P] [US5] Add the thin Account Deletion Requests route adapter in `src/app/admin/data-requests/deletions/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T114 [P] [US5] Add the thin Account Deletion Detail route adapter in `src/app/admin/data-requests/deletions/[requestId]/page.tsx`; validate the `DEL-` ID before the hook and verify with `npm run typecheck`
- [X] T115 [P] [US5] Add the thin Retention Policies route adapter in `src/app/admin/data-requests/retention/page.tsx`; import no fixtures and verify with `npm run typecheck`
- [X] T116 [US5] Extend `tests/e2e/security-audit-privacy.spec.ts` with deletion lifecycle, cancellation, blocker/retry, legal hold, checklist completion, preserved audit, terminal/stale/duplicate rejection, denied role, keyboard/focus, direction, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US5 deletion"`
- [X] T117 [US5] Extend `tests/e2e/security-audit-privacy.spec.ts` with valid retention edit, zero/negative/fractional/out-of-range/protected reduction rejection, legal-hold suspension, stale/duplicate conflict, mock-only notice, desktop-required mobile state, and direction checks; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "US5 retention"`
- [X] T118 [US5] Scan `src/features/security/`, `src/mocks/handlers/security.ts`, and `src/mocks/phase7-security-state.ts` for backend/database/storage/queue/job imports, delete/anonymize/cleanup side effects, browser persistence, `Date.now()`, `Math.random()`, and customer payload fields; fix confirmed US5 findings and record the exact `rg` result in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T119 [US5] Run consolidated US5 verification through `src/features/security/contracts.test.ts`, `src/mocks/phase7-security-state.test.ts`, `src/features/security/repository.test.ts`, `src/features/security/hooks.test.ts`, and the US5 deletion/retention Playwright coverage; record exact results in `verification-report.md`
- [X] T120 [US5] Compare implemented US5 behavior against FR-040 through FR-050, AC-008, the six deletion/retention OpenAPI operations, and quickstart checks; record every pass/gap in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T121 [US5] Verify the Billing Operator receives only the existing bounded subscription-cancellation projection inside its separately authorized prior route and no direct Phase 7 data-request route in `src/core/permissions/role-map.phase7.test.ts` and `tests/e2e/security-audit-privacy.spec.ts`; run both focused tests and record the result in `specs/008-admin-security-audit-and-privacy/verification-report.md`

**Checkpoint**: US5 is independently testable; every destructive-looking action
changes deterministic mock state only.

---

## Phase 8: Cross-Cutting Hardening and Final Verification

- [X] T122 Register `securityHandlers` after existing specific shared handlers and before any conflicting generic handlers in `src/mocks/handlers/index.ts`; verify all 22 operation IDs are exercised by `npm run test -- src/features/security/repository.test.ts`
- [X] T123 Verify `resetPhase7SecurityState()` is invoked after every test through `src/tests/setup.ts` and that browser/server MSW startup needs no duplicate Phase 7 registration in `src/mocks/browser.ts` and `src/mocks/server.ts`; run `npm run test -- src/mocks/phase7-security-state.test.ts` twice and record identical counts
- [X] T124 Reconciled Phase 7 direct-route and direct-mutation permission coverage into `tests/e2e/security-audit-privacy.spec.ts` and `src/core/permissions/role-map.phase7.test.ts`; covers all 14 routes, denied roles, billing/support boundaries, and structural 403 projections; verify with focused unit tests and Playwright
- [X] T125 Reconciled Phase 7 accessibility coverage into the route/workflow matrix in `tests/e2e/security-audit-privacy.spec.ts`; covers headings, landmarks, cards, labels, focus/cache transition, status/alert feedback, direction isolation, and responsive behavior; verify with focused Playwright and full e2e
- [X] T126 Add one route-matrix test for Arabic RTL and English LTR at 1440, 1280, 1024, 768, and 390 pixels across all 14 routes in `tests/e2e/security-audit-privacy.spec.ts`; assert no page-level horizontal overflow and verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "responsive|direction"`
- [X] T127 Reconciled Phase 7 performance evidence through the focused route matrix and full Playwright/build verification; no separate `performance.spec.ts --grep Phase 7` slice was created because no dedicated performance harness exists for Phase 7; full verification remains the final gate
- [X] T128 Reconciled visual-preservation evidence through the five-viewport Phase 7 route matrix and successful production build route table; no separate `visual-preservation.spec.ts --grep Phase 7` slice was created because the consolidated route matrix verifies shell preservation without duplicate screenshot checks
- [X] T129 Add an end-to-end role-change test that loads protected audit detail as Super Admin, switches to a denied role, and proves protected query data disappears before access denied renders in `tests/e2e/security-audit-privacy.spec.ts`; verify with `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts --grep "role change cache"`
- [X] T130 Audit Phase 7 production files for `any`, direct fixture imports, clone-then-delete projections, `dangerouslySetInnerHTML`, raw HTML/Markdown/recursive JSON, debug logging, secrets, feature data in browser storage/URLs, unsafe links, object/data URLs, Blob/archive code, `Date.now()`, `Math.random()`, raw colors, raw IP/device/session/token/credential/customer fields, and backend/provider imports; fix confirmed in-scope findings and record exact `rg` commands/results in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T131 Review changed dependencies and `package.json`/lockfile diff, confirm no install or upgrade was introduced, and record the result plus deferred NestJS/Supabase/infrastructure protections in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T132 Run focused Phase 7 unit/browser verification `npm run test -- src/core/permissions/role-map.phase7.test.ts src/app/QueryProvider.test.tsx src/features/security/contracts.test.ts src/mocks/phase7-security-state.test.ts src/features/security/repository.test.ts src/features/security/hooks.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts src/tests/no-direct-fixtures.test.ts` and `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts`; record exact counts in `verification-report.md`
- [X] T133 Run focused Phase 7 browser verification `npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts` and record exact project/test/pass/fail/skip counts in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if it fails
- [X] T134 Run `npm run typecheck` and record the exact exit code, duration, and failures or success in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if the command fails
- [X] T135 Run `npm run lint` and record the exact exit code, duration, and failures or success in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if the command fails
- [X] T136 Run `npm run test` and record exact test-file/test/pass/fail counts in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if the command fails
- [X] T137 Run `npm run test:e2e` and record exact project/test/pass/fail/skip counts in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if the command fails
- [X] T138 Run `npm run build` and record the exact exit code, duration, warnings, generated route output, and presence of all 14 Phase 7 routes in `specs/008-admin-security-audit-and-privacy/verification-report.md`; do not check this task if the command fails
- [X] T139 Compare every Spec 008 user story, acceptance scenario, FR-001 through FR-056, AC-001 through AC-015, SC-001 through SC-008, 22 OpenAPI operations, 14 routes, quickstart check, and constitution gate against passing evidence; record gaps, unchecked tasks, remaining risks, and final recommendation in `specs/008-admin-security-audit-and-privacy/verification-report.md`
- [X] T140 Re-read `specs/008-admin-security-audit-and-privacy/tasks.md`, mark only genuinely verified tasks complete, leave failed/deferred tasks unchecked with reasons in `verification-report.md`, and declare Spec 008 safe to complete only when T132–T139 all pass

## Dependencies

### Phase order

1. Phase 1 precedes all source changes.
2. Phase 2 blocks every user story.
3. User-story phases are implemented in US1→US2→US3→US4→US5 order because
   they incrementally extend shared contract, repository, hook, handler,
   fixture, state, and view files.
4. US5 uses the export-status projection established by US4.
5. Phase 8 begins only after all five story checkpoints pass.

### User-story dependency graph

```text
Phase 1 Review
    ↓
Phase 2 Foundations
    ├──→ US1 Security Investigation
    ├──→ US2 Admin Security and Support Access
    ├──→ US3 Immutable Audit
    └──→ US4 Export Requests
              ↓
            US5 Deletion and Retention
              ↓
       Cross-Cutting Verification
```

US1, US2, US3, and US4 are behaviorally independent after Phase 2, but the
listed order prevents concurrent edits to shared source files. US5 depends on
US4’s export-status projection for deletion checklist integration.

## Parallel Execution Examples

### Phase 2

- T010 permission tests, T012 shell tests, T014 cache test, T016 contract tests,
  T018 state tests, T020 repository tests, T022 hook tests, T024 shared component
  tests, and T026 fixture-boundary tests touch different files and may run in
  parallel.
- T011 follows T010; T013 follows T012; T015 follows T014; T017 follows T016;
  T019 follows T018; T021 follows T020; T023 follows T022; T025 follows T024.

### US1

- After T041, T042–T045 are independent thin route adapters and may run in
  parallel.
- Contract, state, repository, hook, and component implementation remain
  ordered by their preceding consolidated tests.

### US2

- After T059, T060–T062 are independent route adapters and may run in parallel.
- T063 may be prepared in parallel with T058 because it targets the existing
  access workspace, but T064 waits for T063.

### US3

- After T076, T077 and T078 are independent route adapters and may run in
  parallel.
- Audit fixture work T069 may run after T068 while repository test work T070 is
  prepared against the approved contract.

### US4

- After T092, T093 and T094 are independent route adapters and may run in
  parallel.

### US5

- T102 deletion-state tests and T104 retention-state tests target distinct
  behavior and may be drafted in parallel after T101; implement T103 and T105
  serially in the shared state file.
- After T112, T113–T115 are independent route adapters and may run in parallel.

## Implementation Strategy

### MVP first

1. Complete Phases 1 and 2.
2. Complete US1 through T047.
3. Demonstrate authorized security investigation, denied access, sanitized
   data, exact transitions, keyboard/focus, RTL/LTR, and five viewports.
4. Stop and review before extending shared files for US2.

### Incremental delivery

1. Add US2 privileged posture and support-access revocation.
2. Add US3 immutable audit with GET-only contracts.
3. Add US4 metadata-only export lifecycle and no-file simulation.
4. Add US5 deletion checklist and bounded retention updates.
5. Run Phase 8 once all story checkpoints pass.

## MVP Scope

The suggested MVP is Phase 1 + Phase 2 + US1 (T001–T047). It proves the shared
permission, cache, validation, deterministic state, repository/MSW, safe
projection, accessibility, direction, and responsive architecture without
implementing privacy-request workflows early.

## Completion Rule

Do not mark a verification task complete or claim success unless its stated
command or procedure actually ran successfully. Do not mark Spec 008 complete
unless the full typecheck, lint, Vitest, Playwright, and build commands pass,
all 14 routes build, and no Critical or High privacy/security gap remains.
