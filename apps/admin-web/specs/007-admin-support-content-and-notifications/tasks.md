# Tasks: Support, Feedback, Content, and Notifications

**Input**: `specs/007-admin-support-content-and-notifications/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for every changed behavior  
**Execution rule**: Complete tasks in ID order unless a task is marked `[P]`. Run the task-level verification before checking the task.

Every task uses:

```text
- [x] T### [P?] [US?] Imperative description with exact file path and verification
```

## Phase 1: Existing Project and Contract Review

- [x] T001 Record the exact existing Admin route, component, permission, API-client, MSW, mutation-lock, and test patterns that Phase 6 will reuse in `specs/007-admin-support-content-and-notifications/plan.md`; verify every referenced path exists with `rg --files src tests/e2e`
- [x] T002 Compare all 27 operations in `specs/007-admin-support-content-and-notifications/contracts/admin-support-content-notifications.openapi.yaml` with the requirements and entity names in `specs/007-admin-support-content-and-notifications/spec.md` and `specs/007-admin-support-content-and-notifications/data-model.md`; correct documentation-only drift and parse the YAML with the installed `js-yaml`
- [x] T003 Record the current results of `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` under a dated baseline section in `specs/007-admin-support-content-and-notifications/quickstart.md`; do not fix unrelated pre-existing failures
- [x] T004 Confirm the implementation will add no dependency, backend, database, provider integration, browser storage, real authentication, or raw attachment bytes, and record any discovered scope conflict in `specs/007-admin-support-content-and-notifications/plan.md`

**Gate**: The selected contract, existing reuse points, baseline failures, and frontend-only scope are documented.

---

## Phase 2: Frontend Foundations

- [x] T005 [P] Add failing Vitest cases for every Phase 6 permission key, role grant, direct-route denial, and linked-only projection rule in `src/core/permissions/role-map.test.ts`; verify the new cases fail with `npm run test -- src/core/permissions/role-map.test.ts`
- [x] T006 [P] Add failing strict-schema tests for shared IDs, masked references, pagination, safe errors, Unicode NFC, code-point limits, UTF-8 KiB limits, bidi/control rejection, attachment metadata, action context, and unknown-field rejection in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T007 Implement the smallest Phase 6 permission-key additions in `src/core/permissions/permissions.ts` and exact role grants in `src/core/permissions/role-map.ts`; verify T005 passes with `npm run test -- src/core/permissions/role-map.test.ts`
- [x] T008 Add the 22 Phase 6 navigation entries and route permission requirements without changing existing entries in `src/components/admin/AdminShell.tsx`; verify route labels and hrefs with `npm run typecheck`
- [x] T009 Implement the shared strict Zod schemas and exported TypeScript inference for T006 in `src/features/communications/contracts.ts`; reuse `src/features/shared/admin-schemas.ts` where compatible and verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T010 Add failing tests for a fixed/injected `2026-07-29T12:00:00+03:00` clock, immutable initial snapshots, revision increments, audit references, pending-action keys, and full reset behavior in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T011 Implement only the shared clock, snapshot cloning, revision/audit helpers, pending-action lock, and reset boundary required by T010 in `src/mocks/phase6-communications-state.ts`; do not use `Date.now()` or `Math.random()` and verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T012 Add failing tests for query-key structure, URL encoding, strict response parsing, safe error parsing, targeted invalidation, and no direct fixture access in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T013 Implement the shared `/api/v1/admin` request helper, query serialization, response validation, and safe error mapping in `src/features/communications/repository.ts`; reuse the existing Admin API client pattern and verify the shared T012 cases with `npm run test -- src/features/communications/repository.test.ts`
- [x] T014 Add failing tests for deterministic query keys, `enabled` guards, `useLockedMutation`, resource/action lock keys, focused invalidation, and retained form data after rejection in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T015 Implement the shared Phase 6 query-key factory and mutation wrapper in `src/features/communications/hooks.ts`; reuse `src/features/foundation/useLockedMutation.ts` and verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T016 [P] Add component tests for plain-text rendering, loading/empty/partial/unavailable regions, permission denial, labelled filters, confirmation focus restoration, pending state, live success/error feedback, RTL/LTR direction, and reduced motion in `src/features/communications/shared/CommunicationShared.test.tsx`; verify failure with `npm run test -- src/features/communications/shared/CommunicationShared.test.tsx`
- [x] T017 Implement `OperationalFilters`, `SafeText`, and `CommunicationActionDialog` with existing Admin primitives in `src/features/communications/shared/OperationalFilters.tsx`, `src/features/communications/shared/SafeText.tsx`, and `src/features/communications/shared/CommunicationActionDialog.tsx`; verify with `npm run test -- src/features/communications/shared/CommunicationShared.test.tsx`

**Gate**: Shared validation, permissions, deterministic state, repository/hook boundaries, and accessible UI states pass without adding dependencies.

---

## Phase 3: User Story 1 — Triage and Resolve Support Tickets (P1)

**Goal**: An authorized Support Agent can monitor SLA risk, find a ticket, inspect a privacy-safe detail, assign it, reply or add a note, and perform allowed transitions.

**Independent test**: Seed `TKT-1001` as urgent/at-risk, assign it, add a customer reply, resolve it, and confirm one revision per action, a safe audit reference, restored focus, and no unrelated customer or financial data.

### Test-first implementation

Each failing test task is followed by the smallest implementation task that makes that layer pass.

- [x] T018 [US1] Add failing contract tests for `SupportOverview`, `TicketPage`, `TicketDetail`, `SupportCategory`, ticket/category queries, action-discriminated payloads, state-specific expected values, and masked projections in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T019 [US1] Implement the support and category schemas required by T018 in `src/features/communications/contracts.ts`; match the OpenAPI field names exactly and verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T020 [US1] Add fictional bilingual support overview, ticket, message, attachment-metadata, activity, linked-reference, and support-category seeds covering iOS, Android, multi-platform, Unknown, empty, and partial cases in `src/mocks/fixtures/communications.ts`; verify fixture parsing with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T021 [US1] Add failing state tests for assignment, priority change, reply, internal note, await/resolved/closed/reopen transitions, closed-ticket reply rejection, stale revision, duplicate pending action, support-category update/retire replacement, and reset in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T022 [US1] Implement the support/category transitions required by T021 in `src/mocks/phase6-communications-state.ts`; append immutable history, enforce one owning team, increment once, and return bounded `ActionResult` values, then verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T023 [US1] Add failing repository/MSW tests for the seven support operations, every specified filter/sort/date/page parameter, scenario responses, strict request validation, structural role projections, safe 4xx/5xx errors, and mutation persistence in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T024 [US1] Implement support repository methods and support/category query keys in `src/features/communications/repository.ts`; verify request paths and parsed responses with `npm run test -- src/features/communications/repository.test.ts`
- [x] T025 [US1] Implement the six support MSW operations in `src/mocks/handlers/communications.ts`; register specific paths before parameterized paths, validate inputs, apply permission projections, and verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T026 [US1] Add failing hook tests for support overview/list/detail/category queries, ticket/category actions, resource-specific locks, and targeted invalidation in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T027 [US1] Implement the support query and mutation hooks in `src/features/communications/hooks.ts`; route ticket access requests through the existing Spec 003 `useCreateAccessRequest` boundary and verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T028 [US1] Add failing component tests for support metrics, URL-backed filters, sanitized detail, attachment metadata, SLA state, assignment, priority, reply/note visibility, confirmation, conflicts, access-request eligibility, and 390px overflow behavior in `src/features/communications/support/SupportViews.test.tsx`; verify failure with `npm run test -- src/features/communications/support/SupportViews.test.tsx`
- [x] T029 [US1] Implement the support overview, ticket list/detail, and support-category views in `src/features/communications/support/SupportViews.tsx`; use shared Admin components, render customer content through `SafeText`, preserve rejected form text, and verify with `npm run test -- src/features/communications/support/SupportViews.test.tsx`
- [x] T030 [P] [US1] Add the thin support-overview route adapter in `src/app/admin/support/page.tsx`; export no mock data and verify with `npm run typecheck`
- [x] T031 [P] [US1] Add the thin ticket-list route adapter in `src/app/admin/support/tickets/page.tsx`; export no mock data and verify with `npm run typecheck`
- [x] T032 [P] [US1] Add the thin ticket-detail route adapter in `src/app/admin/support/tickets/[ticketId]/page.tsx`; pass only the validated route ID to the view and verify with `npm run typecheck`
- [x] T033 [P] [US1] Add the thin support-category route adapter in `src/app/admin/support/categories/page.tsx`; verify with `npm run typecheck`
- [x] T034 [US1] Add Playwright coverage for the complete US1 journey, forbidden direct access, keyboard-only confirmation/focus restoration, Arabic RTL, English LTR, and 1440/1280/1024/768/390 layouts in `tests/e2e/support-content-notifications.spec.ts`; verify with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "US1"`

**Checkpoint**: US1 passes its focused Vitest and Playwright commands without requiring any later story.

---

## Phase 4: User Story 2 — Review Feedback and Abuse Reports (P1)

**Goal**: Authorized operators can classify and link feedback while abuse evidence remains restricted to Security Administrator and Super Admin projections.

**Independent test**: Link `FDB-1001` once to a valid ticket, reject a duplicate link, and prove an unauthorized abuse request returns no reporter, target, evidence, or reviewer fields.

### Test-first implementation

Each failing test task is followed by the smallest implementation task that makes that layer pass.

- [x] T035 [US2] Add failing contract tests for `FeedbackPage`, `FeedbackDetail`, `AbuseReportPage`, feedback/abuse filters, app/OS/device context, action-specific link/reviewer fields, masked references, bounded notes, and unsafe input rejection in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T036 [US2] Implement the feedback and abuse schemas required by T035 in `src/features/communications/contracts.ts`; enforce strict unknown-field rejection and verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T037 [US2] Add fictional feedback and abuse seeds with ratings, AI/import types, safe device context, safe attachment metadata, linked records, restricted evidence, and every lifecycle state in `src/mocks/fixtures/communications.ts`; verify fixture parsing with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T038 [US2] Add failing state tests for feedback review/plan/link/resolve/dismiss/close, duplicate-link rejection, abuse investigate/assign/escalate/resolve/dismiss/reopen, stale revision, duplicate pending action, and reset in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T039 [US2] Implement the feedback and abuse transitions required by T038 in `src/mocks/phase6-communications-state.ts`; increment revisions exactly once and verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T040 [US2] Add failing repository/MSW tests for the five feedback/abuse operations, all filters, safe scenarios, linked-only projections, restricted abuse projections, direct mutation denial, and mutation persistence in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T041 [US2] Implement feedback and abuse repository methods and query keys in `src/features/communications/repository.ts`; verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T042 [US2] Implement the five feedback/abuse MSW operations in `src/mocks/handlers/communications.ts`; place `/feedback/abuse-reports` before `/feedback/:feedbackId`, validate before state access, and verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T043 [US2] Add failing hook tests for feedback list/detail actions, abuse list/actions, locks, restricted query enablement, and targeted invalidation in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T044 [US2] Implement feedback and abuse hooks in `src/features/communications/hooks.ts`; verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T045 [US2] Add failing view tests for metrics/filters, plain-text feedback detail, safe device and attachment metadata, link/disposition dialogs, restricted abuse cards, denial states, live feedback, RTL/LTR, and narrow layouts in `src/features/communications/feedback/FeedbackViews.test.tsx`; verify failure with `npm run test -- src/features/communications/feedback/FeedbackViews.test.tsx`
- [x] T046 [US2] Implement feedback overview/detail and restricted abuse views in `src/features/communications/feedback/FeedbackViews.tsx`; never render raw markup or hidden restricted fields and verify with `npm run test -- src/features/communications/feedback/FeedbackViews.test.tsx`
- [x] T047 [P] [US2] Add the thin feedback-overview route adapter in `src/app/admin/feedback/page.tsx`; verify with `npm run typecheck`
- [x] T048 [P] [US2] Add the thin feedback-detail route adapter in `src/app/admin/feedback/[feedbackId]/page.tsx`; validate the route ID through the contract schema and verify with `npm run typecheck`
- [x] T049 [P] [US2] Add the thin restricted abuse route adapter in `src/app/admin/feedback/abuse/page.tsx`; verify the route guard denies unapproved roles with `npm run test -- src/core/permissions/role-map.test.ts`
- [x] T050 [US2] Extend `tests/e2e/support-content-notifications.spec.ts` with the US2 link/disposition journey, duplicate rejection, abuse privacy denial, unsafe-text rejection, keyboard flow, RTL/LTR, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "US2"`

**Checkpoint**: US2 passes independently and restricted abuse data is absent from unauthorized responses, not merely hidden.

---

## Phase 5: User Story 3 — Govern Bilingual Content (P1)

**Goal**: A Content Manager can maintain categories, tips, FAQs, onboarding, and help-center content with strict bilingual, hierarchy, ordering, scope, preview, publish, and retirement rules.

**Independent test**: Publish one valid bilingual draft, reject a missing-translation draft and a cyclic category, then require a replacement before retiring an in-use item.

### Test-first implementation

Each failing test task is followed by the smallest implementation task that makes that layer pass.

- [x] T051 [US3] Add failing contract tests for `ContentPage`, `ContentItem`, all six collection values, content queries, localized variants, audience locales, single-language reason, platform scope, token allowlists, schedules, and update/publish/retire payloads in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T052 [US3] Implement the content schemas and single-language cross-field refinements required by T051 in `src/features/communications/contracts.ts`; require the sole audience locale to equal the sole variant locale and verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T053 [US3] Add fictional Arabic/English category, tip, FAQ, onboarding, and help-center seeds with valid hierarchy, ordering, platform variants, active-use references, and invalid edge-case builders in `src/mocks/fixtures/communications.ts`; verify fixture parsing with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T054 [US3] Add failing state tests for unique collection keys, acyclic category parents, unique sibling order, publish eligibility, missing translations, invalid tokens/placeholders, stale revision, in-use retirement replacement, and reset in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T055 [US3] Implement content create/update/publish/retire transitions and hierarchy/order validation in `src/mocks/phase6-communications-state.ts`; use the injected clock and verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T056 [US3] Add failing repository/MSW tests for content list/create/detail/action operations across categories, tips, FAQs, onboarding, and help center, including locale/category/status/order filters, validation errors, permission projections, conflicts, and persistence in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T057 [US3] Implement content repository methods and collection-aware query keys in `src/features/communications/repository.ts`; verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T058 [US3] Implement content list/create/detail/action MSW operations in `src/mocks/handlers/communications.ts`; validate collection-specific rules before mutation and verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T059 [US3] Add failing hook tests for collection queries, item detail, create/update/publish/retire actions, conflict retention, locks, and focused invalidation in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T060 [US3] Implement content hooks in `src/features/communications/hooks.ts`; verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T061 [US3] Add failing component tests for hierarchy editing, bilingual structured fields, single-language exception, platform/audience scope, ordered lists, safe preview direction, eligibility errors, retirement impact/replacement, conflicts, focus, and 390px layout in `src/features/communications/content/ContentViews.test.tsx`; verify failure with `npm run test -- src/features/communications/content/ContentViews.test.tsx`
- [x] T062 [US3] Implement reusable collection list/editor/preview/lifecycle views for categories, tips, FAQs, onboarding, and help center in `src/features/communications/content/ContentViews.tsx`; preserve approved Admin styling and verify with `npm run test -- src/features/communications/content/ContentViews.test.tsx`
- [x] T063 [P] [US3] Add the thin category list route in `src/app/admin/content/categories/page.tsx`; verify with `npm run typecheck`
- [x] T064 [P] [US3] Add the thin category detail route in `src/app/admin/content/categories/[categoryId]/page.tsx`; validate the route ID through the contract schema and verify with `npm run typecheck`
- [x] T065 [P] [US3] Add the thin tips route in `src/app/admin/content/tips/page.tsx`; verify with `npm run typecheck`
- [x] T066 [P] [US3] Add the thin FAQs route in `src/app/admin/content/faqs/page.tsx`; verify with `npm run typecheck`
- [x] T067 [P] [US3] Add the thin onboarding route in `src/app/admin/content/onboarding/page.tsx`; verify with `npm run typecheck`
- [x] T068 [P] [US3] Add the thin help-center route in `src/app/admin/content/help-center/page.tsx`; verify with `npm run typecheck`
- [x] T069 [US3] Extend `tests/e2e/support-content-notifications.spec.ts` with the US3 valid publish, invalid publish, cyclic category, in-use retirement, safe bilingual preview, keyboard, RTL/LTR, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "US3"`

**Checkpoint**: US3 content collections are independently usable and publication cannot bypass bilingual, hierarchy, scope, or safety validation.

---

## Phase 6: User Story 4 — Manage Announcements and Message Templates (P1)

**Goal**: A Content Manager can safely edit, preview, activate, and retire announcements plus email/push templates with compatible audience, language, platform, schedule, trigger, and placeholder rules.

**Independent test**: Activate one compatible bilingual template, reject an unknown placeholder and expired announcement, and show a confirmed retirement result with scope and audit reference.

### Test-first implementation

Each failing test task is followed by the smallest implementation task that makes that layer pass.

- [x] T070 [US4] Add failing contract tests for announcement-specific content fields, `NotificationTemplate`, `TemplatePage`, template queries, trigger placeholder allowlists, single-language refinement, and update/activate/retire payloads in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T071 [US4] Implement announcement and template schemas required by T070 in `src/features/communications/contracts.ts`; reject arbitrary payloads, unknown placeholders, unsafe URLs, and incompatible variants, then verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T072 [US4] Add fictional announcement, email-template, and push-template seeds with both locales, platform scopes, triggers, placeholder allowlists, schedules, active references, and invalid edge-case builders in `src/mocks/fixtures/communications.ts`; verify fixture parsing with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T073 [US4] Add failing state tests for announcement schedule validation, template create/update/activate/retire, placeholder completeness, platform compatibility, stale revision, active-reference replacement, duplicate pending action, and reset in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T074 [US4] Implement announcement and template transitions required by T073 in `src/mocks/phase6-communications-state.ts`; verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T075 [US4] Add failing repository/MSW tests for announcement content operations plus template list/create/action operations, filters, scenarios, strict validation, projections, safe errors, and persistence in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T076 [US4] Implement template repository methods/query keys and reuse the content methods for announcements in `src/features/communications/repository.ts`; verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T077 [US4] Implement template list/create/action MSW operations and announcement collection handling in `src/mocks/handlers/communications.ts`; verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T078 [US4] Add failing hook tests for announcement and template queries/actions, pending locks, conflict retention, and targeted invalidation in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T079 [US4] Implement announcement and template hooks in `src/features/communications/hooks.ts`; verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T080 [US4] Extend `src/features/communications/content/ContentViews.test.tsx` with announcement timing/audience/priority and email/push trigger/placeholder/preview/activation/retirement cases; verify failure before implementation with `npm run test -- src/features/communications/content/ContentViews.test.tsx`
- [x] T081 [US4] Extend `src/features/communications/content/ContentViews.tsx` with announcement and email/push template views, structured safe previews, consequence dialogs, pending locks, results, and audit references; verify with `npm run test -- src/features/communications/content/ContentViews.test.tsx`
- [x] T082 [P] [US4] Add the thin announcements route in `src/app/admin/content/announcements/page.tsx`; verify with `npm run typecheck`
- [x] T083 [P] [US4] Add the thin email-template route in `src/app/admin/content/email-templates/page.tsx`; verify with `npm run typecheck`
- [x] T084 [P] [US4] Add the thin push-template route in `src/app/admin/content/push-templates/page.tsx`; verify with `npm run typecheck`
- [x] T085 [US4] Extend `tests/e2e/support-content-notifications.spec.ts` with the US4 activation, invalid placeholder, expired schedule, retirement confirmation, keyboard, RTL/LTR, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "US4"`

**Checkpoint**: US4 works independently and unsafe or incompatible communication content cannot activate.

---

## Phase 7: User Story 5 — Simulate Notification Campaigns and Monitor Delivery (P1)

**Goal**: A Content Manager can review delivery health, complete a five-step mock campaign, perform safe lifecycle actions, and inspect privacy-safe delivery diagnostics without provider calls.

**Independent test**: Preview an aggregate audience, schedule a valid campaign once, reject a stale duplicate submission, and inspect a failed delivery without exposing tokens, addresses, payloads, or message bodies.

### Test-first implementation

Each failing test task is followed by the smallest implementation task that makes that layer pass.

- [x] T086 [US5] Add failing contract tests for `NotificationOverview`, `AudiencePreviewRequest`, `AudienceSummary`, `Campaign`, campaign draft/action conditionals, delivery-log filters/records, authoritative denominators, and privacy-forbidden fields in `src/features/communications/contracts.test.ts`; verify failure with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T087 [US5] Implement notification, audience, campaign, and delivery schemas required by T086 in `src/features/communications/contracts.ts`; enforce one channel, future-only scheduled timestamps, preview/template revisions, aggregate-only audience data, and masked delivery references, then verify with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T088 [US5] Add fictional notification metrics, audience previews, campaigns, transactional templates, and delivery logs covering all platforms, opt-outs, invalid tokens, unsupported rates, partial/unavailable regions, and safe failure classes in `src/mocks/fixtures/communications.ts`; verify fixture parsing with `npm run test -- src/features/communications/contracts.test.ts`
- [x] T089 [US5] Add failing state tests for audience preview versioning, draft creation, schedule/send/pause/resume/cancel transitions, future clock checks, zero eligibility, opt-outs, stale audience/template/campaign revisions, inactive/missing template variants, duplicate pending actions, and reset in `src/mocks/phase6-communications-state.test.ts`; verify failure with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T090 [US5] Implement notification audience and campaign transitions required by T089 in `src/mocks/phase6-communications-state.ts`; never derive recipient rows or call a provider and verify with `npm run test -- src/mocks/phase6-communications-state.test.ts`
- [x] T091 [US5] Add failing repository/MSW tests for all eight notification operations, overview/campaign/delivery filters, audience preview, scenarios, strict errors, projections, aggregate privacy, action conflicts, and mutation persistence in `src/features/communications/repository.test.ts`; verify failure with `npm run test -- src/features/communications/repository.test.ts`
- [x] T092 [US5] Implement notification overview, audience preview, campaign, transactional-template, and delivery-log repository methods/query keys in `src/features/communications/repository.ts`; verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T093 [US5] Implement all eight notification MSW operations in `src/mocks/handlers/communications.ts`; return authoritative counts/rates, omit unsupported rates explicitly, validate before mutation, and verify with `npm run test -- src/features/communications/repository.test.ts`
- [x] T094 [US5] Add failing hook tests for overview, audience preview, campaign list/detail/create/actions, transactional templates, delivery logs, wizard draft memory, pending locks, and targeted invalidation in `src/features/communications/hooks.test.ts`; verify failure with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T095 [US5] Implement notification query/action hooks and runtime-only wizard draft state in `src/features/communications/hooks.ts`; do not use localStorage, sessionStorage, IndexedDB, cookies, or URL payloads and verify with `npm run test -- src/features/communications/hooks.test.ts`
- [x] T096 [US5] Add failing view tests for notification metrics/denominators, five-step wizard validation, aggregate audience review, one-channel selection, Send Now/future schedule, stale conflicts, campaign actions, transactional templates, masked delivery logs, live feedback, keyboard flow, RTL/LTR, and 390px layout in `src/features/communications/notifications/NotificationViews.test.tsx`; verify failure with `npm run test -- src/features/communications/notifications/NotificationViews.test.tsx`
- [x] T097 [US5] Implement notification overview, campaign list/detail/wizard, transactional-template, and delivery-log views in `src/features/communications/notifications/NotificationViews.tsx`; show mock-only notices and never render recipient/token/provider payload fields, then verify with `npm run test -- src/features/communications/notifications/NotificationViews.test.tsx`
- [x] T098 [P] [US5] Add the thin notification overview route in `src/app/admin/notifications/page.tsx`; verify with `npm run typecheck`
- [x] T099 [P] [US5] Add the thin campaign-list route in `src/app/admin/notifications/campaigns/page.tsx`; verify with `npm run typecheck`
- [x] T100 [P] [US5] Add the thin campaign-creation route in `src/app/admin/notifications/campaigns/new/page.tsx`; verify with `npm run typecheck`
- [x] T101 [P] [US5] Add the thin campaign-detail route in `src/app/admin/notifications/campaigns/[campaignId]/page.tsx`; validate the route ID through the contract schema and verify with `npm run typecheck`
- [x] T102 [P] [US5] Add the thin transactional-template route in `src/app/admin/notifications/transactional/page.tsx`; verify with `npm run typecheck`
- [x] T103 [P] [US5] Add the thin delivery-log route in `src/app/admin/notifications/delivery-logs/page.tsx`; verify with `npm run typecheck`
- [x] T104 [US5] Extend `tests/e2e/support-content-notifications.spec.ts` with the US5 overview, complete wizard, stale/duplicate rejection, campaign transition, delivery privacy, keyboard, RTL/LTR, and five-viewport checks; verify with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "US5"`

**Checkpoint**: US5 passes independently with deterministic mock-only behavior and no recipient or provider integration.

---

## Phase 8: Cross-Cutting Hardening and Final Verification

- [x] T105 Register `communicationsHandlers` in `src/mocks/handlers/index.ts` with specific handlers ordered before generic handlers; verify every one of the 27 OpenAPI operations is exercised by `npm run test -- src/features/communications/repository.test.ts`
- [x] T106 Reset Phase 6 runtime state after every test through `src/tests/setup.ts`, `src/mocks/server.ts`, and `src/mocks/browser.ts`; verify two consecutive runs of `npm run test -- src/mocks/phase6-communications-state.test.ts` produce identical results
- [x] T107 Extend permission Playwright coverage for all 22 Phase 6 direct routes, allowed roles, denied roles, linked-only projections, and forbidden direct mutations in `tests/e2e/permissions.spec.ts`; verify with `npm run test:e2e -- tests/e2e/permissions.spec.ts`
- [x] T108 Extend accessibility coverage for keyboard navigation, visible focus, semantic landmarks/headings/tables/forms, accessible names/descriptions, live status, dialog focus trapping/restoration, contrast, and reduced motion in `tests/e2e/accessibility.spec.ts`; verify with `npm run test:e2e -- tests/e2e/accessibility.spec.ts`
- [x] T109 Extend responsive and direction coverage for Arabic RTL and English LTR at 1440, 1280, 1024, 768, and 390 pixels across all 22 routes in `tests/e2e/support-content-notifications.spec.ts`; verify no horizontal page overflow with `npm run test:e2e -- tests/e2e/support-content-notifications.spec.ts --grep "responsive|direction"`
- [x] T110 Add Phase 6 p95 overview/detail and filter/sort/pagination thresholds, excluding labelled slow scenarios, in `tests/e2e/performance.spec.ts`; verify with `npm run test:e2e -- tests/e2e/performance.spec.ts`
- [x] T111 Add approved-shell visual preservation checks for representative support, feedback, content, and notification routes in `tests/e2e/visual-preservation.spec.ts`; verify with `npm run test:e2e -- tests/e2e/visual-preservation.spec.ts`
- [x] T112 Audit Phase 6 production files for `any`, direct fixture imports, unsafe rendering, debug code, secrets, browser storage, `Date.now()`, `Math.random()`, raw colors, token/address/payload fields, and unbounded URLs; fix confirmed in-scope findings in the owning `src/features/communications/` or `src/mocks/` file and record the exact `rg` commands/results in `specs/007-admin-support-content-and-notifications/verification-report.md`
- [x] T113 Run `npm run typecheck` and record the exact exit code, duration, and failures or success in `specs/007-admin-support-content-and-notifications/verification-report.md`; do not check this task if the command fails
- [x] T114 Run `npm run lint` and record the exact exit code, duration, and failures or success in `specs/007-admin-support-content-and-notifications/verification-report.md`; do not check this task if the command fails
- [x] T115 Run `npm run test` and record the exact test/file/pass/fail counts in `specs/007-admin-support-content-and-notifications/verification-report.md`; do not check this task if the command fails
- [x] T116 Run `npm run test:e2e` and record the exact project/test/pass/fail/skip counts in `specs/007-admin-support-content-and-notifications/verification-report.md`; do not check this task if the command fails
- [x] T117 Run `npm run build` and record the exact exit code, duration, warnings, and route output in `specs/007-admin-support-content-and-notifications/verification-report.md`; do not check this task if the command fails
- [x] T118 Compare every acceptance scenario, functional/security requirement, OpenAPI operation, and quickstart check against passing evidence; record remaining gaps and the final completion recommendation in `specs/007-admin-support-content-and-notifications/verification-report.md`

## Dependencies

- Phase 1 precedes all implementation.
- Phase 2 blocks every user story.
- US1, US2, US3, US4, and US5 are all P1; execute in ID order because they append to shared contract, state, repository, hook, fixture, handler, and end-to-end files.
- US4 reuses the content collection behavior completed by US3.
- US5 reuses the template behavior completed by US4.
- Phase 8 starts only after all selected user stories pass their checkpoints.

### User-story dependency graph

```text
Phase 1 review
  -> Phase 2 foundations
      -> US1 support
      -> US2 feedback/abuse
      -> US3 bilingual content
          -> US4 announcements/templates
              -> US5 campaigns/delivery
  -> Phase 8 hardening and full verification
```

## Parallel Execution Examples

- After T009, T010, T012, T014, and T016 may be authored in parallel because they modify different test files.
- After T029, T030–T033 may run in parallel because each creates a different support route.
- After T046, T047–T049 may run in parallel because each creates a different feedback route.
- After T062, T063–T068 may run in parallel because each creates a different content route.
- After T081, T082–T084 may run in parallel because each creates a different announcement/template route.
- After T097, T098–T103 may run in parallel because each creates a different notification route.
- T107, T108, T110, and T111 may run in parallel after T106 because they modify different Playwright specifications.
- T113 and T114 may run in parallel; run T115, T116, and T117 separately to keep resource use and failure evidence clear.

## Implementation Strategy

1. Complete Phase 1 and Phase 2 once.
2. Deliver the MVP as US1 only, then run its checkpoint.
3. Add US2 and run its checkpoint without relying on US3–US5.
4. Add US3, then US4, then US5 because templates and campaigns build on content behavior.
5. Run Phase 8 only after all selected stories pass.

## MVP Scope

US1 is the suggested MVP: support overview, ticket list/detail, categories, ticket actions, privacy-safe projections, and focused tests.

## Completion Rule

Do not mark a task complete unless its stated verification has run successfully. Do not mark the feature complete unless T113–T118 are complete with passing evidence.
