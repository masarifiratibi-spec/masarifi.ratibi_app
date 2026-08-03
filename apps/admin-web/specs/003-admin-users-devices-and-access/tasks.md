# Tasks: Users, Devices, Sessions, and Controlled Access

**Input**: `specs/003-admin-users-devices-and-access/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Execution audience**: Lower-cost implementation model; follow tasks in order and do not infer omitted work

## Execution Rules

- Read the named file before editing it and preserve unrelated user changes.
- A test-first task is complete only when the new test fails for the stated missing behavior, not because of syntax, import, or environment errors.
- An implementation task is complete only when its named focused test passes.
- Use the exact contract names from `data-model.md` and `contracts/admin-users-access.openapi.yaml`; do not create aliases beyond `DeviceActionResult` and `SessionActionResult`.
- Do not add packages, initialize a project, create backend code, add Next.js API routes, persist customer/access data in browser storage, or implement later specs.
- Keep Arabic RTL default, English LTR readiness, existing tokens/components/assets, and the approved `/admin/users` identity.
- Do not mark final verification complete unless the command was actually run successfully.

## Shared Interface Map

- `src/core/permissions/role-map.ts` exports the seven exact Phase 2 role assignments and the stable fictional `SIMULATED_ACTORS` role-to-actor map.
- `src/features/users/contracts.ts` exports the Zod schemas and inferred types for `AdminUsersQuery`, `AdminUsersPage`, `UserDetailRequest`, `UserProfileSummary`, `UserDevicesQuery`, `UserDevicesResponse`, `UserSessionsQuery`, `UserSessionsResponse`, all customer-action requests/results, and bulk requests/results.
- `src/features/users/repository.ts` exports `usersRepository.getUsers`, `getUser`, `getDevices`, `getSessions`, `suspendUser`, `reactivateUser`, `updateVerification`, `revokeDevice`, `revokeSessions`, and `runBulkAction`.
- `src/features/users/hooks.ts` exports normalized `usersQueryKeys` plus one query/mutation hook per repository method.
- `src/features/access/contracts.ts` exports the access query/summary/detail/decision/workspace schemas and inferred types from `data-model.md`.
- `src/features/access/repository.ts` exports `accessRepository.listRequests`, `getRequest`, `createRequest`, `decideRequest`, `revokeRequest`, `getWorkspace`, and `endAccess`.
- `src/features/access/hooks.ts` exports normalized `accessQueryKeys` plus one hook per repository method and removes workspace cache on expiry/revocation/end.
- `src/mocks/phase2-state.ts` exports `getPhase2MockState()` and `resetPhase2MockState()`; it is mock/test infrastructure only.

---

## Phase 1: Existing Project and Contract Review

**Goal**: Establish an evidence-backed baseline without changing the application.

- [X] T001 Inspect `git status`, the current diff, and every existing Spec 003 target listed in `plan.md`; record unrelated pre-existing changes and files that must be preserved in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T002 Record the existing `/admin/users` desktop/mobile hierarchy, drawer behavior, semantic tokens, route permission, and current mock/repository flow in `specs/003-admin-users-devices-and-access/verification-report.md`; verify each statement against `src/app/admin/users/page.tsx`.
- [ ] T003 Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before edits; record each real exit result and any pre-existing failure in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T004 Run `rg -n "@/mocks/fixtures|@/data|data/admin" src/app src/components src/features`, `rg -n "\bany\b" src --glob "*.ts" --glob "*.tsx"`, and the storage/secret scans from `quickstart.md`; record reviewed matches in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T005 Compare all 17 operations and 30 named types in `contracts/admin-users-access.openapi.yaml` with `data-model.md`; record zero mismatches or the exact correction required in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T006 Confirm `package.json` and the lockfile already contain every approved dependency and record “no dependency change required” in `specs/003-admin-users-devices-and-access/verification-report.md`; do not install or upgrade anything.

**Gate**: Baseline evidence exists, the approved page is understood, and no project initialization or dependency change is planned.

---

## Phase 2: Frontend Foundations

**Goal**: Add shared permission, safe-error, and region-state support required by every story.

- [ ] T007 Write failing matrix tests for all 13 Phase 2 permission keys, the seven exact role assignments from `spec.md`, and one stable unique fictional actor ID per role in `src/core/permissions/role-map.test.ts`; run `npm run test -- src/core/permissions/role-map.test.ts` and require failure because the new keys and actors are absent.
- [X] T008 Add the 13 exact permission literals to `src/core/permissions/permissions.ts`; extend `permissionsByRole` and export `SIMULATED_ACTORS: Record<AdminRole, string>` with stable fictional IDs in `src/core/permissions/role-map.ts`; run `npm run test -- src/core/permissions/role-map.test.ts` and require pass.
- [ ] T009 [P] Write failing shell tests for `/admin/users/[userId]`, `/admin/access-requests`, request detail, workspace route permission inheritance, and hidden denied navigation in `src/components/admin/AdminShell.test.tsx`; run that test and require failure on missing route mappings.
- [X] T010 Add the new route permission mappings in `src/components/admin/AdminShell.tsx` and the permitted Access Requests navigation item in `src/mocks/fixtures/foundation.ts`; run `npm run test -- src/components/admin/AdminShell.test.tsx src/core/permissions/role-map.test.ts` and require pass.
- [ ] T011 [P] Write failing tests for safe handling of HTTP 401, 404, 410, 422, and 429 responses without raw payloads in `src/core/api/core.test.ts`; run the focused test and require failure on unsupported status normalization.
- [X] T012 Extend the allowlisted error codes/messages and status mapping in `src/core/api/errors.ts` and `src/core/api/client.ts` without exposing response bodies; run `npm run test -- src/core/api/core.test.ts` and require pass.
- [ ] T013 [P] Write failing tests that `RegionState` accepts a caller-supplied permission label and renders forbidden/empty/partial/unavailable states accessibly in `src/components/admin/ui.test.tsx`; run the focused test and require failure on the hard-coded permission.
- [X] T014 Add an optional `permission` prop with the existing `attention.read` value as its backward-compatible default in `src/components/admin/ui.tsx`; require every new Phase 2 caller to pass its applicable permission explicitly, then run `npm run test -- src/components/admin/ui.test.tsx src/app/admin/overview.test.tsx`.
- [X] T015 Extend `src/tests/no-direct-fixtures.test.ts` to scan the new `src/features/access` and new route directories while allowing imports only inside `src/mocks`; run `npm run test -- src/tests/no-direct-fixtures.test.ts`.
- [X] T016 Run `npm run typecheck`, `npm run lint`, and the five focused foundation tests from T007–T015; record the actual foundation gate result in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Gate**: Shared permissions, errors, region states, and architecture guards pass before story code begins.

---

## Phase 3: User Story 1 — Find and Triage a Customer (P1)

**Goal**: Find unique customers with correct All/iOS/Android/Multi-platform semantics and open the approved masked quick summary.

**Independent test**: `/admin/users` shows one multi-platform fixture once in All, in iOS, Android, and Multi-platform filters, with masked identity and additive device counts.

### Contract and filtering tests

- [ ] T017 [US1] Write failing schema tests for normalized defaults, bounded text/dates/page sizes, masked email, registered-platform/device-count invariants, primary-platform membership, and duplicate user IDs in `src/features/users/contracts.test.ts`; run the file and require failure because the schemas are missing.
- [X] T018 [US1] Extend `src/features/users/contracts.ts` with `userIdSchema`, platform/capability enums, `adminUsersQuerySchema`, `adminUserListItemSchema`, `adminUsersPageSchema`, and inferred list types exactly matching `data-model.md`; run `npm run test -- src/features/users/contracts.test.ts`.
- [X] T019 [P] [US1] Write failing filter tests for search, status, plan, country, language, registration/last-activity ranges, app version, verification, risk, sort/order, and All/iOS/Android/Multi membership in `src/lib/admin.test.ts`; include the same multi-platform user in both platform filters but only once in All.
- [X] T020 [US1] Update `filterUsers` and add deterministic `sortUsers` in `src/lib/admin-utils.ts` using the normalized contract fields; run `npm run test -- src/lib/admin.test.ts` and require pass.

### Mock and repository boundary

- [X] T021 [US1] Replace the six-record user fixture shape with typed sanitized iOS-only, Android-only, multi-platform, multi-device, suspended, pending-verification, high-risk, and long mixed-direction records in `src/mocks/fixtures/users.ts`; verify `npm run typecheck` passes and every email matches the mask schema.
- [X] T022 [P] [US1] Extend failing repository tests for default normalization, all filters, pagination envelope, authoritative unique/platform totals, unsafe response rejection, empty, forbidden, rate-limited, and internal-error scenarios in `src/features/users/repository.test.ts`; run and require failures only for missing Spec 003 behavior.
- [X] T023 [US1] Extend the GET `/api/v1/admin/users` handler in `src/mocks/handlers/users.ts` to parse query values, enforce `users.read`, filter/sort/page unique users, return authoritative totals, and reuse safe scenario responses; run `npm run test -- src/features/users/repository.test.ts`.
- [X] T024 [US1] Update `usersRepository.getUsers(input: AdminUsersQuery)` in `src/features/users/repository.ts` to parse normalized input and serialize every allowlisted filter/sort/page/mock-role value; run the repository tests and require pass.
- [X] T025 [US1] Write failing tests for normalized stable list query keys and page reset inputs in `src/features/users/hooks.test.ts`; run the file and require failure on raw/unparsed keys.
- [X] T026 [US1] Update `usersQueryKeys.list` and `useUsers` in `src/features/users/hooks.ts` to use parsed defaults and retain only safe previous page data during refresh; run `npm run test -- src/features/users/hooks.test.ts`.

### Approved list UI

- [X] T027 [US1] Write failing component tests for All/iOS/Android/Multi controls, masked rows, additive device labels, non-color-only status/risk text, page-scoped selection, and empty/error/forbidden states in `src/app/admin/users/users-list.test.tsx`.
- [X] T028 [US1] Extend filters, table columns, accessible sort controls, metric semantics, and unique customer rendering in `src/app/admin/users/page.tsx` without changing the approved header/card/table hierarchy; run `npm run test -- src/app/admin/users/users-list.test.tsx`.
- [X] T029 [US1] Preserve the existing quick-summary drawer and add a keyboard-accessible “open full profile” link to `/admin/users/[userId]` in `src/app/admin/users/page.tsx`; extend the component test to assert focus return, masking, and the exact link.
- [X] T030 [US1] Clear explicit selection whenever search/filter/sort/page size/page changes and ensure bulk scope never becomes “all filtered” in `src/app/admin/users/page.tsx`; extend the component test with selection-reset assertions.
- [X] T031 [US1] Keep mobile user cards semantically equivalent to the desktop rows, including all-platform labels, status/risk text, and 44px actions in `src/app/admin/users/page.tsx`; run the component test at both RTL and programmatic LTR direction.
- [X] T032 [US1] Add the User Story 1 browser journey and platform-count invariants to `tests/e2e/users-access.spec.ts`; run `npm run test:e2e -- tests/e2e/users-access.spec.ts --project=desktop-1440` and require the story checks to pass.
- [X] T033 [US1] Run `npm run typecheck`, `npm run lint`, the four User Story 1 Vitest files, and the desktop User Story 1 Playwright journey; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: User Story 1 is independently usable and is the suggested MVP.

---

## Phase 4: User Story 2 — Review Profile, Devices, and Sessions (P1)

**Goal**: Review masked profile, platform-specific devices, and sanitized sessions with independent state boundaries.

**Independent test**: `/admin/users/USR-10482` shows a masked profile plus correct iOS/Android device capabilities and sanitized sessions; one failed region does not blank its siblings.

### Typed contracts

- [X] T034 [US2] Write failing profile-schema tests for route ID validation, masked identity, aggregate-only financial metadata, platform activity, risk summary, region states, and forbidden prohibited fields in `src/features/users/contracts.test.ts`.
- [X] T035 [US2] Add `userDetailRequestSchema`, `riskSummarySchema`, `userAggregatesSchema`, and `userProfileSummarySchema` plus inferred types in `src/features/users/contracts.ts`; run the focused contract tests.
- [X] T036 [P] [US2] Write failing device-schema tests for iOS/Android capability applicability, revoked timestamp/state consistency, no token/fingerprint fields, item/count consistency, and a 100-item bound in `src/features/users/contracts.test.ts`.
- [X] T037 [US2] Add `userDeviceSchema`, `userDevicesQuerySchema`, and `userDevicesResponseSchema` with cross-field refinements in `src/features/users/contracts.ts`; run the device contract tests.
- [X] T038 [P] [US2] Write failing session-schema tests for coarse region, start/last-activity ordering, active/expired/revoked counts, revoked timestamps, and absence of raw IP/token fields in `src/features/users/contracts.test.ts`.
- [X] T039 [US2] Add `userSessionSchema`, `userSessionsQuerySchema`, and `userSessionsResponseSchema` with the specified refinements in `src/features/users/contracts.ts`; run the session contract tests.

### Mock, repository, and hooks

- [X] T040 [US2] Add deterministic sanitized profile, device, and session fixtures for iOS-only, Android-only, multi-platform, active, expired, revoked, empty, partial, and unsafe-contract cases in `src/mocks/fixtures/users.ts`; run `npm run typecheck`.
- [X] T041 [P] [US2] Write failing repository tests for `getUser`, `getDevices`, and `getSessions`, including independent forbidden/not-found/empty/partial/invalid-response behavior, in `src/features/users/repository.test.ts`.
- [X] T042 [US2] Add GET profile, devices, and sessions handlers with validated IDs/roles, independent region scenarios, and no prohibited fields in `src/mocks/handlers/users.ts`; run the repository tests to confirm only missing repository methods remain.
- [X] T043 [US2] Implement `usersRepository.getUser`, `getDevices`, and `getSessions` with parsed input/response contracts in `src/features/users/repository.ts`; run `npm run test -- src/features/users/repository.test.ts`.
- [X] T044 [US2] Write failing normalized query-key and independent-query tests for profile/devices/sessions in `src/features/users/hooks.test.ts`.
- [X] T045 [US2] Add `usersQueryKeys.detail/devices/sessions` and `useUser`, `useUserDevices`, `useUserSessions` in `src/features/users/hooks.ts`; run the hook tests.

### Detail route and regions

- [X] T046 [US2] Write failing component tests for masked overview, independent loading/empty/error/forbidden regions, iOS/Android not-applicable labels, session semantics, and no prohibited text in `src/features/users/UserDetailView.test.tsx`.
- [X] T047 [US2] Create `UserDetailView` profile header, privacy notice, aggregate counts, platform activity, verification, and risk presentation using existing primitives in `src/features/users/UserDetailView.tsx`; run its component test.
- [X] T048 [US2] Add the Devices region, additive count summary, platform-specific capability labels, revoked state, and permitted action slots in `src/features/users/UserDetailView.tsx`; run the device assertions.
- [X] T049 [US2] Add the Sessions region with coarse region, timestamps, state/risk labels, current-session warning, and permitted action slots in `src/features/users/UserDetailView.tsx`; run the session assertions.
- [X] T050 [US2] Create the thin validated `/admin/users/[userId]` route with `users.read` gating and `UserDetailView` delegation in `src/app/admin/users/[userId]/page.tsx`; run `npm run typecheck`.
- [X] T051 [US2] Add only semantic-token-based detail grid, tab/section, device card, session table/card, RTL/LTR, and responsive rules in `src/app/globals.css`; run `npm run lint` and inspect 1440px/390px for no blocking overflow.
- [X] T052 [US2] Extend `tests/e2e/users-access.spec.ts` with User Story 2 masked profile, independent-region failure, iOS/Android capability, sanitized session, keyboard, and mobile-card journeys; run desktop-1440 and mobile-390 projects.
- [X] T053 [US2] Run the User Story 2 contract/repository/hook/component tests, typecheck, lint, and its two Playwright projects; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: User Story 2 is independently testable after User Story 1 identifiers/contracts.

---

## Phase 5: User Story 3 — Perform Controlled Customer Actions (P1)

**Goal**: Suspend/reactivate, update verification, revoke a device, and revoke selected/all sessions with validation, confirmation, locking, permissions, and safe conflicts.

**Independent test**: Every action rejects invalid input, requires scoped confirmation, locks while pending, updates only its target, and reports success/error/forbidden/conflict accessibly.

### Action contracts and state

- [X] T054 [US3] Write failing tests for `SuspendUserRequest`, `ReactivateUserRequest`, `UpdateVerificationRequest`, `RevokeDeviceRequest`, `RevokeSessionsRequest`, and result schemas, including conditional selected/all session rules, in `src/features/users/contracts.test.ts`.
- [X] T055 [US3] Add the exact action request/result schemas and inferred types from `data-model.md` in `src/features/users/contracts.ts`; run the action contract tests.
- [X] T056 [US3] Write failing state-reset and clone-isolation tests for users/devices/sessions in `src/mocks/phase2-state.test.ts`; require failure because the state module does not exist.
- [X] T057 [US3] Create `getPhase2MockState()` and `resetPhase2MockState()` with structured clones of sanitized fixtures in `src/mocks/phase2-state.ts`; reset it from `src/tests/setup.ts` and run `npm run test -- src/mocks/phase2-state.test.ts`.

### Mutation boundary

- [X] T058 [P] [US3] Write failing repository tests for valid and invalid suspend/reactivate/verification/device/session transitions, permission denial, duplicate pending mutation, stale conflict, rate limit, and safe audit references in `src/features/users/repository.test.ts`.
- [X] T059 [US3] Add validated POST handlers for suspend, reactivate, verification, device revoke, and session revoke to `src/mocks/handlers/users.ts`; enforce current state and granular permission at the handler and mutate only `phase2-state`.
- [X] T060 [US3] Implement the five matching repository methods with exact request/response schemas in `src/features/users/repository.ts`; run the action repository tests.
- [X] T061 [US3] Write failing hook tests for unique lock keys and exact query invalidation after each action in `src/features/users/hooks.test.ts`.
- [X] T062 [US3] Add `useSuspendUser`, `useReactivateUser`, `useUpdateVerification`, `useRevokeDevice`, and `useRevokeSessions` using `useLockedMutation` in `src/features/users/hooks.ts`; run the hook tests.

### Accessible action UI

- [ ] T063 [P] [US3] Write failing component tests for form labels/errors, current/proposed state, scope, consequence, permission, audit event, cancel/focus return, pending lock, success, forbidden, and conflict in `src/features/users/user-actions.test.tsx`.
- [X] T064 [US3] Create the action launcher and shared React Hook Form/Zod confirmation flow in `src/features/users/UserActions.tsx`; reuse `ConfirmDialog` and do not create another modal foundation.
- [X] T065 [US3] Add the suspend form with reason 5–200, duration 1–365, internal note 0–500, notification preference, and `users.status.manage` behavior in `src/features/users/UserActions.tsx`; run its focused tests.
- [X] T066 [US3] Add the reactivate form restricted to suspended users with reason/note and `users.status.manage` behavior in `src/features/users/UserActions.tsx`; run its focused tests.
- [X] T067 [US3] Add the verification transition form requiring a different next state, reason, and `users.verification.manage` behavior in `src/features/users/UserActions.tsx`; run its focused tests.
- [X] T068 [US3] Add device revocation with device label/reason/consequence and `devices.revoke` behavior in `src/features/users/UserActions.tsx`; run its focused tests.
- [X] T069 [US3] Add selected/all session revocation with deduplicated 1–100 selected IDs, reason, current-session warning, and `sessions.revoke` behavior in `src/features/users/UserActions.tsx`; run its focused tests.
- [X] T070 [US3] Integrate `UserActions` into the profile, device, and session action slots and announce mutation outcomes without losing region data in `src/features/users/UserDetailView.tsx`; run both user component test files.
- [X] T071 [US3] Extend `tests/e2e/users-access.spec.ts` with valid/invalid/cancel/pending-lock/success/conflict/forbidden journeys for all five actions and assert no duplicate requests or unexpected console errors.
- [X] T072 [US3] Run User Story 3 contract, state, repository, hook, component, and desktop Playwright tests plus typecheck/lint; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: User Story 3 actions are complete without production authorization claims.

---

## Phase 6: User Story 4 — Request and Decide Temporary Access (P1)

**Goal**: Create, list, inspect, approve/reject/reduce, and revoke time-limited access requests with separation of duties.

**Independent test**: A request requires valid ticket/reason/scope/assignee/duration; the requester cannot approve it; a separate approver can only reduce scope/duration; invalid transitions conflict safely.

### Access contracts and fixtures

- [X] T073 [US4] Write failing access base-schema tests for IDs, status, scope allowlist, paginated query, summaries, masked customer, timeline ordering, and terminal states in `src/features/access/contracts.test.ts`.
- [X] T074 [US4] Add access identifiers/enums, `accessRequestsQuerySchema`, summary/detail/timeline schemas, region/pagination reuse, and inferred types in `src/features/access/contracts.ts`; run the base contract tests.
- [X] T075 [US4] Write failing create/decision/revoke tests for ticket pattern, reason bounds, mandatory masking, unique nonempty scope, 5–60 minute duration/default 30, self-approval denial, subset-only approval, and transition table in `src/features/access/contracts.test.ts`.
- [X] T076 [US4] Add `createAccessRequestSchema`, `accessDecisionRequestSchema`, `revokeAccessRequestSchema`, transition helpers, scope-subset refinement, and exact inferred types in `src/features/access/contracts.ts`; run the mutation contract tests.
- [X] T077 [P] [US4] Add sanitized fictional support tickets and pending/approved/active/expired/rejected/revoked access fixtures with reduced scopes and stable actors in `src/mocks/fixtures/access.ts`; run `npm run typecheck`.
- [X] T078 [US4] Write failing access clone/reset, duplicate-overlap, self-approval, valid-transition, invalid-transition, and timeline tests in `src/mocks/phase2-state.test.ts`.
- [X] T079 [US4] Extend `src/mocks/phase2-state.ts` with cloned tickets/access requests and explicit helpers that enforce overlap, actor separation, subset/duration, transitions, and audit timeline; run the state tests.

### Access repository and handlers

- [X] T080 [P] [US4] Write failing repository tests for list/detail/create plus empty/large/slow/invalid/forbidden/not-found/conflict/rate-limit/unsafe-response cases in `src/features/access/repository.test.ts`.
- [X] T081 [US4] Create GET list/detail and POST create handlers with parsed role-to-actor visibility, pagination, masking, ticket existence, duplicate overlap, and safe errors in `src/mocks/handlers/access.ts`; register them in `src/mocks/handlers/index.ts`.
- [X] T082 [US4] Implement `accessRepository.listRequests`, `getRequest`, and `createRequest` with normalized query/body/response schemas in `src/features/access/repository.ts`; run the matching repository tests.
- [X] T083 [US4] Add normalized `accessQueryKeys.list/detail`, `useAccessRequests`, `useAccessRequest`, and locked `useCreateAccessRequest` with exact invalidations in `src/features/access/hooks.ts`; add and run focused hook tests in `src/features/access/hooks.test.ts`.

### List, create, detail, and decisions

- [X] T084 [US4] Write failing list-view tests for required columns, status filters, masking, pagination, role-limited visibility, loading/empty/error/forbidden states, and accessible row links in `src/features/access/AccessRequestView.test.tsx`.
- [X] T085 [US4] Create the access-request list mode using existing table/card/filter/state primitives in `src/features/access/AccessRequestView.tsx`; run the list-view tests.
- [ ] T086 [US4] Write failing create-form tests for every required field/bound/error, mandatory masking, pending lock, duplicate conflict, and focus return in `src/features/access/AccessRequestView.test.tsx`.
- [X] T087 [US4] Add the React Hook Form/Zod request form and scoped confirmation using `support.request_access` in `src/features/access/AccessRequestView.tsx`; run the create-form tests.
- [ ] T088 [US4] Write failing detail/decision tests for ticket/customer/scope/masking/timeline, requester approval denial, subset/duration reduction, reject, revoke, terminal conflict, and permission labels in `src/features/access/AccessRequestView.test.tsx`.
- [X] T089 [US4] Add detail mode and decision/revoke forms using existing confirmation/pending/error primitives in `src/features/access/AccessRequestView.tsx`; run the detail tests.
- [X] T090 [US4] Add decision and revoke POST handlers with permission checks, actor separation, subset/duration enforcement, transitions, and timeline/audit results in `src/mocks/handlers/access.ts`; run repository tests that still fail on missing methods.
- [X] T091 [US4] Implement `accessRepository.decideRequest/revokeRequest` and `useDecideAccessRequest/useRevokeAccessRequest` with list/detail invalidation in `src/features/access/repository.ts` and `src/features/access/hooks.ts`; run repository/hook/view tests.
- [X] T092 [US4] Create thin `support.access.read`-gated list and detail routes in `src/app/admin/access-requests/page.tsx` and `src/app/admin/access-requests/[requestId]/page.tsx`; validate route IDs before invoking hooks and run `npm run typecheck`.
- [X] T093 [US4] Add only semantic-token access list/detail/form/timeline responsive rules to `src/app/globals.css`; verify RTL/LTR at 1440px and 390px without blocking overflow.
- [X] T094 [US4] Extend `tests/e2e/users-access.spec.ts` with request create/duplicate, requester cannot approve, separate approver reduce/approve/reject/revoke, invalid transition, and permission visibility journeys.
- [X] T095 [US4] Run all User Story 4 access contract/state/repository/hook/component tests, desktop/mobile Playwright journeys, typecheck, and lint; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: User Story 4 request lifecycle is independently testable; no workspace content exists yet.

---

## Phase 7: User Story 5 — Work Within Temporary Access (P1)

**Goal**: Enter only an assigned, active, scope-limited workspace and remove protected data on expiry, revocation, end, permission loss, or session expiry.

**Independent test**: The assigned operator sees only approved masked/aggregate/status sections with persistent ticket/scope/expiry/audit context; content disappears within five seconds of expiry and never returns after refresh/back.

### Workspace boundary

- [X] T096 [US5] Write failing workspace-schema tests for active-only status, future absolute expiry, assignee/request/ticket IDs, approved-scope-to-section equality, allowed classifications, bounded fields, and absence of generic/raw customer maps in `src/features/access/contracts.test.ts`.
- [X] T097 [US5] Add `workspaceFieldSchema`, `workspaceSectionSchema`, `temporaryWorkspaceRequestSchema`, `temporaryWorkspaceSchema`, `endTemporaryAccessRequestSchema`, and result schema with exact scope-projection refinements in `src/features/access/contracts.ts`; run the workspace contract tests.
- [X] T098 [P] [US5] Write failing repository tests for assigned approved-to-active entry, non-assignee denial, expired/revoked/terminal denial, permission loss, exact projection, end access, and 410 expiry in `src/features/access/repository.test.ts`.
- [X] T099 [US5] Add workspace GET and end POST handlers that recheck actor, permission, ticket, status, start/expiry, and allowlisted projection on every request in `src/mocks/handlers/access.ts`; run repository tests to confirm only missing repository methods remain.
- [X] T100 [US5] Implement `accessRepository.getWorkspace/endAccess` with parsed request/response contracts in `src/features/access/repository.ts`; run the workspace repository tests.
- [X] T101 [US5] Write failing hook tests for active workspace query key actor isolation, exact-expiry timeout, focus/visibility recheck, cancellation, cache removal, and end/revoke/session-loss cleanup in `src/features/access/hooks.test.ts`.
- [X] T102 [US5] Add `accessQueryKeys.workspace`, `useTemporaryWorkspace`, and `useEndTemporaryAccess` with one timeout and cache cancellation/removal in `src/features/access/hooks.ts`; run the hook tests.

### Workspace UI and route

- [ ] T103 [P] [US5] Write failing component tests for persistent ticket/assignee/scope/masking/absolute-expiry/audit banner, approved sections only, no hidden unauthorized labels/counts/values, classifications, End Access confirmation, expiry announcement, input clearing, and focus in `src/features/access/access-workspace.test.tsx`.
- [X] T104 [US5] Create `TemporaryAccessWorkspace` with the non-dismissible banner and approved masked/aggregate/status section rendering in `src/features/access/TemporaryAccessWorkspace.tsx`; run banner/projection tests.
- [X] T105 [US5] Add expiry, permission-loss, session-expired, revoked, ended, loading, forbidden, conflict, and safe-error rendering with local input clearing in `src/features/access/TemporaryAccessWorkspace.tsx`; run expiry/privacy tests.
- [X] T106 [US5] Add the End Access form/confirmation using `support.access.revoke`, locked mutation, cache purge, and safe redirect to request detail in `src/features/access/TemporaryAccessWorkspace.tsx`; run end-access tests.
- [X] T107 [US5] Create the thin `support.access.use`-gated route with validated request ID in `src/app/admin/access-requests/[requestId]/workspace/page.tsx`; direct invalid/denied/expired routes must render no protected content.
- [X] T108 [US5] Add only semantic-token workspace banner/watermark/section/card/mobile/print/reduced-motion styles to `src/app/globals.css`; verify the banner remains visible and End Access usable at 1440px, 768px, and 390px.
- [X] T109 [US5] Extend `tests/e2e/users-access.spec.ts` with assigned entry, exact scope projection, non-assignee denial, End Access, cache removal, and direct reopen denial.
- [X] T110 [US5] Add a deterministic near-expiry browser scenario to `tests/e2e/users-access.spec.ts`; assert protected content disappears within five seconds and remains absent after refresh, back navigation, focus, and visibility restoration.
- [X] T111 [US5] Run User Story 5 contract/repository/hook/component tests, desktop/mobile Playwright workspace journeys, typecheck, and lint; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: User Story 5 demonstrates controlled, time-limited access without treating the client as a production trust boundary.

---

## Phase 8: User Story 6 — Apply Bulk Actions Safely (P2)

**Goal**: Apply allowlisted actions to explicit current-page selections with eligibility preview, confirmation, pending lock, partial results, and masked export.

**Independent test**: A mixed selection affects only explicit eligible IDs, reports safe partial results, clears only after completion, and never expands to all filtered records.

- [X] T112 [US6] Write failing bulk-schema tests for allowlisted actions, unique 1–100 explicit IDs, conditional reason/duration fields, count equations, bounded failures, and safe identifiers/messages in `src/features/users/contracts.test.ts`.
- [X] T113 [US6] Add `userBulkActionRequestSchema`, `bulkFailureSchema`, and `userBulkActionResultSchema` with conditional refinements and inferred types in `src/features/users/contracts.ts`; run the bulk contract tests.
- [X] T114 [P] [US6] Write failing repository/state tests for eligibility by action/state/permission, current-page scope, mixed partial success, duplicate lock, masked export allowlist, and notification-handoff-only behavior in `src/features/users/repository.test.ts` and `src/mocks/phase2-state.test.ts`.
- [X] T115 [US6] Add the bounded bulk POST handler and state application in `src/mocks/handlers/users.ts`; return aggregate counts/safe failures/audit reference and never implement real export delivery or notifications.
- [X] T116 [US6] Implement `usersRepository.runBulkAction` with exact body/result parsing in `src/features/users/repository.ts`; run bulk repository/state tests.
- [X] T117 [US6] Add `useUserBulkAction` with one selection-derived lock key and list/affected-detail invalidation in `src/features/users/hooks.ts`; extend and run `src/features/users/hooks.test.ts`.
- [ ] T118 [P] [US6] Write failing component tests for selection count, eligibility preview, clear/cancel behavior, scope/consequence/permission/audit confirmation, pending lock, partial result, and post-success selection clearing in `src/features/users/user-actions.test.tsx`.
- [X] T119 [US6] Add the bulk toolbar/forms for masked export, suspend, reactivate, force logout, and notification handoff in `src/features/users/UserActions.tsx`; integrate it with explicit selected IDs in `src/app/admin/users/page.tsx`.
- [X] T120 [US6] Render masked export and notification handoff as safe mock outcomes only, and render partial failures by safe user ID/code/message in `src/features/users/UserActions.tsx`; run component tests.
- [X] T121 [US6] Extend `tests/e2e/users-access.spec.ts` with selection reset, mixed eligibility, cancel, pending lock, partial success, masked export privacy, and no-real-notification assertions.
- [X] T122 [US6] Run User Story 6 contract/state/repository/hook/component tests, desktop Playwright bulk journey, typecheck, and lint; record exact results in `specs/003-admin-users-devices-and-access/verification-report.md`.

**Checkpoint**: All six user stories are implemented and independently verifiable.

---

## Final Phase: Hardening and Verification

- [X] T123 Add missing default/empty/large/slow/partial/unauthorized/forbidden/not-found/validation/conflict/rate-limited/unavailable/internal-error scenarios to `src/mocks/handlers/users.ts` and `src/mocks/handlers/access.ts`; verify every scenario named in `spec.md` has a focused Vitest or Playwright assertion.
- [X] T124 Update `tests/e2e/permissions.spec.ts` with the complete Phase 2 route/action matrix, direct-denial content removal, temporary-access expiry, and development-only authorization notice; run the desktop-1440 project.
- [X] T125 Update `tests/e2e/accessibility.spec.ts` with keyboard-only list/detail/action/request/workspace flows, focus return, live announcements, non-color status, absolute expiry, 44px touch targets, and reduced motion; run desktop-1440 and mobile-390.
- [X] T126 Extend `tests/e2e/visual-preservation.spec.ts` with `/admin/users` baseline assertions and new-route semantic-token checks without accepting a redesign; run all five Playwright projects for this file.
- [X] T127 Verify Arabic RTL and English LTR plus light/dark themes at 1440px, 1280px, 1024px, 768px, and 390px using `tests/e2e/users-access.spec.ts`; record passed/skipped/failed counts in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T128 Run the architecture/type/style scans from `quickstart.md`, review every match, and record zero production fixture imports, zero application `any`, no new avoidable raw colors, and no backend/API-route additions in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T129 Run the security/privacy scans from `quickstart.md`, inspect source/DOM/storage/logs/errors/screenshots, and record findings for masking, unsafe rendering, URLs, public environment values, secrets, identifiers, IPs, tokens, financial details, workspace cache, and dependencies in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T130 Reconcile every FR-001–FR-042, AC-001–AC-020, SC-001–SC-010, route, role, state, and OpenAPI operation against an implemented file/test; record the traceability table and any genuine deferral in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T131 Run `npm run typecheck`; fix only Spec 003 type errors in the named affected source/test files and record the final successful result in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T132 Run `npm run lint`; fix only Spec 003 lint errors and record the final successful result in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T133 Run `npm run test`; fix Spec 003 regressions, record exact passed file/test counts, and do not mark complete while any test fails in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T134 Run `npm run test:e2e` separately from build; fix Spec 003 regressions and record exact passed/skipped/failed counts plus any intentional viewport skip in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T135 Run `npm run build` only after Playwright finishes; verify all five Spec 003 routes are emitted and record the successful build result in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T136 Inspect the final Git diff for unrelated rewrites, dependency/lockfile changes, backend code, design drift, raw fixtures, unsafe storage, secrets, and unmasked data; remove only Spec 003 violations and record the reviewed file list in `specs/003-admin-users-devices-and-access/verification-report.md`.
- [X] T137 Verify every task marker against actual files and command evidence, then mark only genuinely completed tasks in `specs/003-admin-users-devices-and-access/tasks.md`; leave failed/skipped work unchecked with a reason in the verification report.
- [X] T138 Add the final completed/partial/missing/failed/skipped/deferred summary and future NestJS/Supabase authorization/audit/security expectations to `specs/003-admin-users-devices-and-access/verification-report.md`; do not claim production security.

---

## Dependencies

### Phase order

```text
Phase 1 baseline
    ↓
Phase 2 shared foundations
    ↓
US1 customer discovery
    ├──→ US2 profile/devices/sessions ──→ US3 controlled customer actions
    ├──→ US4 access request lifecycle ──→ US5 temporary workspace
    └──→ US6 bulk actions
              ↓
Final hardening and verification after US2–US6
```

- T001–T016 block all user stories.
- US1 blocks US2, US4, and US6 because they reuse validated customer identifiers and list contracts.
- US2 blocks US3 because actions attach to profile/device/session regions.
- US4 blocks US5 because the workspace requires an approved request lifecycle.
- US4 contract/repository work may proceed in parallel with US2 after US1; do not edit `src/mocks/phase2-state.ts` concurrently with US3.
- US6 may proceed after US1 in parallel with US2/US4 only when no other worker is editing `src/app/admin/users/page.tsx`, `src/features/users/UserActions.tsx`, or `src/mocks/handlers/users.ts`.
- T123–T138 run only after every selected in-scope story checkpoint passes.

## Parallel Opportunities

- After T008, T009, T011, and T013 may be authored in parallel because they touch shell, API, and UI test files independently.
- After T018, T019 and T022 may be authored in parallel; both are red tests and touch different files.
- After T035, T036 and T038 may be authored in parallel inside the same contract-test file only if one worker owns the file; otherwise run sequentially to avoid conflicts.
- After T039, T040 and T041 may proceed in parallel because fixtures and repository tests are separate files.
- After T055, T058 and T063 may be authored in parallel before state/handler/UI implementation.
- After T076, T077 and T080 may proceed in parallel; serialize subsequent edits to `phase2-state.ts`.
- After T097, T098 and T103 may be authored in parallel before workspace implementation.
- After T113, T114 and T118 may be authored in parallel before bulk implementation.

## Parallel Execution Examples

### US2

```text
Worker A: T036 device contract tests
Worker B: T038 session contract tests
Merge in task order, then run T037 and T039 sequentially in contracts.ts.
```

### US4

```text
Worker A: T077 access fixtures
Worker B: T080 repository red tests
Then run T078–T083 sequentially because they share mock state/handlers/repository/hooks.
```

### US5

```text
Worker A: T098 workspace repository red tests
Worker B: T103 workspace component red tests
Then run T099–T102 before T104–T108.
```

### US6

```text
Worker A: T114 bulk repository/state red tests
Worker B: T118 bulk component red tests
Then serialize handler/repository/hook/UI edits T115–T120.
```

## Implementation Strategy

### MVP

Complete T001–T033 only. This delivers User Story 1: privacy-safe unique
customer discovery with correct cross-platform membership, preserved approved
design, typed contracts, MSW, and focused verification.

### Incremental delivery

1. Add US2 for profile/device/session context.
2. Add US3 for controlled customer actions.
3. Add US4 for request creation and decisions.
4. Add US5 for the privacy-critical temporary workspace.
5. Add US6 for bounded bulk efficiency.
6. Run all final hardening tasks; no story is release-complete before T138.

## Completion Rule

Do not mark a task complete because code exists. Mark it complete only when its
named verification passes and the task outcome matches the specification.

