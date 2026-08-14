---

description: "Implementation tasks for SPEC-009 notifications, assistant, subscriptions, settings, and support"
---

# Tasks: Notifications, Smart Financial Assistant, Subscriptions, and Support

**Input**: Design documents from `specs/009-assistant-notifications/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/assistant-notifications-contract.md`, `quickstart.md`

**Tests**: Tests are mandatory because the constitution requires proof for financial logic, privacy, permissions, state transitions, localization, accessibility, and critical journeys. In every story, create the named failing test before its implementation task.

**Organization**: Tasks are grouped by user story and kept small enough for a lower-cost implementation model. Every task names its files and a direct verification command or observable pass condition.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because it uses different files and has no unfinished dependency.
- **[Story]**: Maps the task to one user story for traceability.
- Run all commands from `apps/mobile` unless a task says otherwise.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add only the native notification dependency and the feature boundary gate required by the approved plan.

- [X] T001 Install the Expo SDK 51-compatible `expo-notifications` package with `npx expo install expo-notifications`, commit only the resulting `package.json` and `package-lock.json` changes, and run `npm ls expo-notifications`; expect version `0.28.x` with no dependency error.
- [X] T002 Register only the `expo-notifications` config plugin in `app.json`, without push-token, credential, or background-task configuration; run `npx expo config --type public` and confirm the resolved plugin list contains `expo-notifications`.
- [X] T003 Write failing boundary cases in `scripts/check-assistant-notifications-boundaries.test.mjs` for direct SQLite screen access, AI/payment/support/remote-push provider imports, production-success copy, raw colors, SPEC-009 Zustand entities, unguarded protected notification actions, sensitive analytics keys, and unsupported iOS/SMS claims; run `node scripts/check-assistant-notifications-boundaries.test.mjs` and confirm failure because the checker is absent.
- [X] T004 Implement `scripts/check-assistant-notifications-boundaries.mjs` and add `check:assistant-notifications` to `package.json`; run `node scripts/check-assistant-notifications-boundaries.test.mjs` and `npm run check:assistant-notifications`, expecting both to exit zero.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared domain shapes, storage, contracts, fixtures, analytics safety, and protected route normalization used by every story.

**Critical**: No user-story implementation starts until this phase passes.

- [X] T005 [P] Write failing notification entity and typed-target invariant tests in `src/domain/notifications.test.ts` covering event-key deduplication, safe target variants, delete-only semantics, action expiry/version fields, preference defaults, and safe failure categories; run `npm test -- --runInBand src/domain/notifications.test.ts` and confirm the named cases fail.
- [X] T006 [P] Write failing assistant entity tests in `src/domain/assistant.test.ts` covering consent states, immutable snapshots, fact/estimate/suggestion labels, conversation deletion isolation, preview transitions, expiry, source versions, and operation IDs; run `npm test -- --runInBand src/domain/assistant.test.ts` and confirm failure.
- [X] T007 [P] Write failing subscription entity tests in `src/domain/subscriptions.test.ts` covering one catalog version, trial terms, lifecycle states, success-only entitlement changes, operation replay, and read-only paid content; run `npm test -- --runInBand src/domain/subscriptions.test.ts` and confirm failure.
- [X] T008 [P] Write failing profile, application preference, session, security-event, and privacy-request validation tests in `src/domain/settings.test.ts`; run `npm test -- --runInBand src/domain/settings.test.ts` and confirm failure.
- [X] T009 [P] Write failing support entity tests in `src/domain/support.test.ts` covering discriminated draft modes, bounded category/subject/description, the exact context allowlist, no attachments, ticket transitions, rating eligibility, and operation replay; run `npm test -- --runInBand src/domain/support.test.ts` and confirm failure.
- [X] T010 [P] Implement `NotificationEvent`, `NotificationTarget`, `NotificationPreferences`, paging/filter inputs, permission/action resolutions, policy inputs/results, and validators in `src/domain/notifications.ts`; run `npm test -- --runInBand src/domain/notifications.test.ts` and expect all tests to pass.
- [X] T011 [P] Implement assistant consent, conversation, immutable response snapshot, structured answer block, feedback, action preview, input, and transition types/validators in `src/domain/assistant.ts`; run `npm test -- --runInBand src/domain/assistant.test.ts` and expect all tests to pass.
- [X] T012 [P] Implement offer catalog, subscription state, operation, entitlement-access, and lifecycle transition types/validators in `src/domain/subscriptions.ts`; run `npm test -- --runInBand src/domain/subscriptions.test.ts` and expect all tests to pass.
- [X] T013 [P] Implement `UserProfile`, `ApplicationPreferences`, `RepresentativeSession`, `SecurityEvent`, `PrivacyRequest`, and input validators in `src/domain/settings.ts`; run `npm test -- --runInBand src/domain/settings.test.ts` and expect all tests to pass.
- [X] T014 [P] Implement help article, draft, allowlisted context, ticket, message, rating, and idempotent operation types/validators in `src/domain/support.ts`; run `npm test -- --runInBand src/domain/support.test.ts` and expect all tests to pass.
- [X] T015 Define the exact `NotificationService`, `PhoneNotificationService`, `AssistantService`, `SubscriptionService`, `SettingsService`, and `SupportService` signatures from the contract in `src/services/contracts/assistant-notifications-service.ts`, reusing the existing `MutationResult<T>` type; run `npm run typecheck` and expect zero errors.
- [X] T016 Write failing schema-v7 migration tests in `src/storage/database.test.ts` for all 11 SPEC-009 tables, singleton rows, unique event/operation IDs, lifecycle indexes, idempotent reopen, and retained v1-v6 data; run `npm test -- --runInBand src/storage/database.test.ts` and confirm the v7 cases fail.
- [X] T017 Advance `src/storage/database.ts` from schema v6 to v7 with the exact tables/indexes in `data-model.md`, using the existing idempotent migration transaction and no destructive column rewrites; run `npm test -- --runInBand src/storage/database.test.ts` and expect all migration tests to pass.
- [X] T018 [P] Write failing notification and assistant persistence tests in `src/storage/assistant-notifications-repository.test.ts` for paging, stable ordering, unique event keys, filtered mark-all, tombstones, immutable snapshots, cascade-only conversation deletion, preview versions, and operation replay; run `npm test -- --runInBand src/storage/assistant-notifications-repository.test.ts` and confirm failure.
- [X] T019 Implement notification and assistant persistence in `src/storage/assistant-notifications-repository.ts` using the existing database transaction/error patterns and no UI imports; run `npm test -- --runInBand src/storage/assistant-notifications-repository.test.ts` and expect all tests to pass.
- [X] T020 [P] Write failing subscription persistence tests in `src/storage/subscriptions-repository.test.ts` for the singleton state, unique operation IDs, prior-version conflicts, success-only state changes, and replayed results; run `npm test -- --runInBand src/storage/subscriptions-repository.test.ts` and confirm failure.
- [X] T021 Implement `src/storage/subscriptions-repository.ts` with version-checked singleton writes and idempotent operation lookup/update; run `npm test -- --runInBand src/storage/subscriptions-repository.test.ts` and expect all tests to pass.
- [X] T022 [P] Write failing support persistence tests in `src/storage/support-repository.test.ts` for independent draft recovery, ticket paging, message ordering, rating constraints, submitted-only visible changes, and operation replay; run `npm test -- --runInBand src/storage/support-repository.test.ts` and confirm failure.
- [X] T023 Implement `src/storage/support-repository.ts` with transactional draft/ticket/operation writes and no attachment column; run `npm test -- --runInBand src/storage/support-repository.test.ts` and expect all tests to pass.
- [X] T024 Write failing protected-settings tests in `src/storage/settings-storage.test.ts` for profile timezone/currency, application defaults, preserved security controls, and one global `hideBalances` owner; run `npm test -- --runInBand src/storage/settings-storage.test.ts` and confirm failure.
- [X] T025 Implement `src/storage/settings-storage.ts` by composing `src/storage/secure-preferences.ts` and `src/state/preferences.ts`, and remove `hideBalances` from the privacy-lock preference shape in `src/features/security/privacy-lock.ts`; run `npm test -- --runInBand src/storage/settings-storage.test.ts src/features/security/privacy-lock.test.ts` and expect all tests to pass.
- [X] T026 [P] Write failing analytics allowlist/rejection tests in `src/analytics/assistant-notifications-events.test.ts` for fixed event names and scalar outcomes, rejecting amounts, currency-linked values, titles/bodies, questions/answers, source IDs, contact data, ticket text, credentials, nested objects, and user-authored strings; run the file and confirm failure.
- [X] T027 [P] Implement the fixed event and property unions plus reject-on-sensitive-input guard in `src/analytics/assistant-notifications-events.ts`; run `npm test -- --runInBand src/analytics/assistant-notifications-events.test.ts` and expect all tests to pass.
- [X] T028 [P] Add deterministic catalogs and builders for offers, help/What's New, sessions, security events, notification events, assistant contexts, and 1,000-item histories in `src/test-utils/assistant-notifications-fixtures.ts`; run `npm run typecheck` and expect zero errors.
- [X] T029 Write failing destination normalization tests in `src/features/shell/navigation-context.test.ts` and `src/features/shell/resolve-entry-route.test.ts` for every new static route, typed dynamic route, rejected raw URL/query, safe fallback, and unlock destination; run both files and confirm the new cases fail.
- [X] T030 Extend `src/features/shell/navigation-context.ts` and `src/features/shell/resolve-entry-route.ts` with approved SPEC-009 destinations only; run `npm test -- --runInBand src/features/shell/navigation-context.test.ts src/features/shell/resolve-entry-route.test.ts` and expect all tests to pass.

**Checkpoint**: Schema v7, shared contracts, safe domains, persistence, fixtures, analytics, and route normalization are ready.

---

## Phase 3: User Story 1 - Receive and Act on Financial Notifications (Priority: P1) MVP

**Goal**: Provide durable, filterable financial notifications with exact destinations, valid actions, and source-safe deletion.

**Independent Test**: Seed every category and outcome, then verify grouping, filtering, unread state, deduplication, links/actions, deleted-target fallback, and that deleting a notification leaves its source record unchanged.

### Tests for User Story 1

- [X] T031 [P] [US1] Write failing `NotificationService` behavior tests in `src/services/mocks/assistant-notifications-service.test.ts` for create/list/get, event-key deduplication, correction/reversal distinction, filtered mark-all, delete-only semantics, target resolution, action expiry/version checks, and idempotent execution; run the file and confirm failure.
- [X] T032 [P] [US1] Write a failing query-key and invalidation test in `src/features/notifications/notification-queries.test.ts` for list/filter/page, detail, unread count, mark-read, filtered mark-all, and delete mutations; run the file and confirm failure.
- [X] T033 [P] [US1] Write a failing notification-center journey in `src/features/notifications/NotificationCenterScreen.test.tsx` covering all eight views, date groups, unread badge, dense/offline/sync/deleted-target/action-expired states, safe navigation, and source-safe deletion; run the file and confirm failure.
- [X] T034 [P] [US1] Write failing route ownership tests in `src/features/notifications/NotificationsRoutes.test.tsx` for `/notifications` and thin route modules without SQLite access; run the file and confirm failure.

### Implementation for User Story 1

- [X] T035 [US1] Implement the notification methods of `src/services/mocks/assistant-notifications-service.ts` by composing `src/storage/assistant-notifications-repository.ts` and canonical owner services; run `npm test -- --runInBand src/services/mocks/assistant-notifications-service.test.ts` and expect all tests to pass.
- [X] T036 [US1] Implement notification keys, paged queries, derived unread count, and narrowly scoped mutations in `src/features/notifications/notification-queries.ts`; run `npm test -- --runInBand src/features/notifications/notification-queries.test.ts` and expect all tests to pass.
- [X] T037 [US1] Implement `src/features/notifications/NotificationCenterScreen.tsx` with `FlatList`, existing `StateView`, `StatusBadge`, `SensitiveValue`, and `ConfirmationDialog`; run the notification-center test and expect all cases to pass.
- [X] T038 [US1] Add `app/notifications/_layout.tsx` and `app/notifications/index.tsx` as thin render-only routes for the notification center; run `npm test -- --runInBand src/features/notifications/NotificationsRoutes.test.tsx` and expect all tests to pass.
- [X] T039 [US1] Write failing typed-target and protected-action controller tests in `src/features/notifications/notification-response-controller.test.ts` for exact/fallback/unavailable targets, startup/live replay, unlock-first behavior, revalidation, expiry, and at-most-once operation IDs; run the file and confirm failure.
- [X] T040 [US1] Implement the shared cold/live response pipeline in `src/features/notifications/notification-response-controller.ts` as event ID to trusted resolution to unlock to revalidation to route/action; run its test file and expect all tests to pass.
- [X] T041 [US1] Write failing automatic-tracking notification integration cases in `src/services/mocks/automatic-tracking-service.test.ts` for expense, income, review, duplicate, refund, correction, reversal, and undo outcomes emitted exactly once; run the file and confirm the new cases fail.
- [X] T042 [US1] Replace calls to `src/services/mocks/automatic-tracking-notification-service.ts` with the central notification contract in `src/services/mocks/automatic-tracking-service.ts`, then delete the obsolete helper after `rg "automatic-tracking-notification-service" src` returns no caller; run the automatic-tracking service test and expect all tests to pass.
- [X] T043 [US1] Write failing voice outcome integration cases in `src/features/voice/useVoiceCapture.test.tsx` for confirmed, review-required, duplicate, obligation-link, and failed outcomes emitted once without raw transcript content; run the file and confirm the new cases fail.
- [X] T044 [US1] Replace `src/services/mocks/voice-notification-service.ts` usage with the central notification contract in `src/features/voice/useVoiceCapture.ts`, then remove the obsolete helper/tests after `rg "voice-notification-service" src` returns no caller; run the voice capture test and expect all tests to pass.
- [X] T045 [US1] Write a failing More-menu and unread-badge navigation test in `src/features/shell/NavigationJourney.test.tsx` for notifications; run the file and confirm failure.
- [X] T046 [US1] Add the notification-center entry and unread badge to `app/(tabs)/more.tsx` using existing `MenuLink` and `NotificationBadge`; run `npm test -- --runInBand src/features/shell/NavigationJourney.test.tsx` and expect all tests to pass.

**Checkpoint**: US1 is independently usable and is the MVP delivery point.

---

## Phase 4: User Story 2 - Control Notification Attention and Privacy (Priority: P1)

**Goal**: Respect category choices, real device permission, timezone-aware quiet hours, summaries, and lock-screen masking without losing in-app history.

**Independent Test**: Exercise all permission states, same-day and cross-midnight quiet hours, the critical-access bypass allowlist, daily/weekly summaries, category disabling, and amount hiding in Arabic and English.

### Tests for User Story 2

- [X] T047 [P] [US2] Write failing pure policy tests in `src/features/notifications/notification-policy.test.ts` for category/phone disablement, real permission states, IANA-timezone quiet hours across midnight, the three critical-access bypass events only, summary deduplication, global masking precedence, and accessible native copy; run the file and confirm failure.
- [X] T048 [P] [US2] Write failing platform-adapter tests in `src/services/platform/phone-notification-service.test.ts` for permission mapping, education-before-request delegation, category registration, ID-only payloads, local presentation, last response, live unsubscribe, and system-settings recovery; run the file and confirm failure.
- [X] T049 [P] [US2] Write failing notification-preference query tests in `src/features/notifications/notification-preferences-queries.test.ts` for load/save versioning, permission refresh/request, conflict recovery, and policy projection invalidation; run the file and confirm failure.
- [X] T050 [P] [US2] Write a failing preferences-screen journey in `src/features/notifications/NotificationPreferencesScreen.test.tsx` covering every category, quiet-hour fields/days/timezone, daily/weekly summary controls, default hidden amounts, permission education/denial/settings recovery, save errors, and preserved input; run the file and confirm failure.

### Implementation for User Story 2

- [X] T051 [US2] Implement the pure decision and privacy rewrite functions in `src/features/notifications/notification-policy.ts` with `Intl.DateTimeFormat` and no date library; run its test file and expect all tests to pass.
- [X] T052 [US2] Implement `src/services/platform/phone-notification-service.ts` with `expo-notifications` for local-only permission, categories, presentation, and responses, never requesting a push token; run its test file and expect all tests to pass.
- [X] T053 [US2] Add deterministic granted/denied/permanently-denied/restored/unavailable/presented/expired/failed phone behavior to `src/services/mocks/assistant-notifications-service.ts`; run its service test and expect all permission/presentation cases to pass.
- [X] T054 [US2] Implement preference and permission queries/mutations in `src/features/notifications/notification-preferences-queries.ts`; run its test file and expect all tests to pass.
- [X] T055 [US2] Implement `src/features/notifications/NotificationPreferencesScreen.tsx` using existing form, feedback, and confirmation primitives; run its screen test and expect all tests to pass.
- [X] T056 [US2] Add `app/notifications/preferences.tsx` as a thin route and extend `src/features/notifications/NotificationsRoutes.test.tsx` to verify it; run the route test and expect all tests to pass.
- [X] T057 [US2] Write failing root-registration tests in `src/features/shell/ProtectedNavigation.test.tsx` for category registration once, last-response handling, live-response cleanup, unlock continuation, and permission denial not blocking app entry; run the file and confirm failure.
- [X] T058 [US2] Wire the phone adapter and one response controller instance into `app/_layout.tsx` and `src/features/shell/ProtectedRouteGate.tsx`; run the protected-navigation test and expect all tests to pass.
- [X] T059 [US2] Add daily/weekly covered-period and grouped-count assertions to `src/services/mocks/assistant-notifications-service.test.ts`, implement summary event creation without individual double-presentation in `src/services/mocks/assistant-notifications-service.ts`, and run that test file to green.

**Checkpoint**: US2 is independently testable against deterministic policy inputs and a native development build.

---

## Phase 5: User Story 3 - Ask for Contextual Financial Guidance (Priority: P1)

**Goal**: Deliver consented, deterministic financial guidance with inspectable evidence, limitations, and immutable context snapshots.

**Independent Test**: Ask every supported question type with complete, empty, partial, stale, review-required, conflicting, missing-report, and out-of-scope contexts, then change source data and prove the old response is unchanged while a new answer uses current data.

### Tests for User Story 3

- [X] T060 [P] [US3] Write failing canonical-context tests in `src/features/assistant/assistant-context.test.ts` for confirmed finance/planning/report inputs, exclusion of review/conflict records, labeled pending-local data, safe references/versions, as-of/period values, and absence of raw SMS/notes/account IDs; run the file and confirm failure.
- [X] T061 [P] [US3] Write failing assistant service tests in `src/services/mocks/assistant-service.test.ts` for consent gating, all response types, immutable snapshots, no invented values, safe redirects, paging, rename/delete isolation, feedback, disablement, offline/error/limit states, and operation replay; run the file and confirm failure.
- [X] T062 [P] [US3] Write failing assistant query tests in `src/features/assistant/assistant-queries.test.ts` for consent, conversation pages, immutable response keys, current-context invalidation, rename/delete, ask, and feedback; run the file and confirm failure.
- [X] T063 [P] [US3] Write failing assistant home and conversation journeys in `src/features/assistant/AssistantJourney.test.tsx` for consent disclosure, suggestions, history, structured labels/evidence/limitations, rename/delete confirmation, feedback/report, and all required data states; run the file and confirm failure.
- [X] T064 [P] [US3] Write failing assistant route tests in `src/features/assistant/AssistantRoutes.test.tsx` for `/assistant` and `/assistant/[conversationId]` thin routes; run the file and confirm failure.

### Implementation for User Story 3

- [X] T065 [US3] Implement current confirmed context assembly and immutable safe snapshots in `src/features/assistant/assistant-context.ts` by calling existing finance, planning, and report services only; run its test file and expect all tests to pass.
- [X] T066 [US3] Implement the `AssistantService` contract in `src/services/mocks/assistant-service.ts` with deterministic structured answers, explicit limitations, educational redirects, immutable persistence, and idempotent mutations; run its service test and expect all tests to pass.
- [X] T067 [US3] Implement assistant query keys, paged history, consent, ask, rename/delete, and feedback mutations in `src/features/assistant/assistant-queries.ts`; run its test file and expect all tests to pass.
- [X] T068 [US3] Implement `src/features/assistant/AssistantHomeScreen.tsx` for consent, privacy explanation, suggestions, new conversation, history, disabled, limit, empty, offline, and error states; run the assistant journey test filtered to home cases and expect a pass.
- [X] T069 [US3] Implement `src/features/assistant/AssistantConversationScreen.tsx` with virtualized responses, structured blocks, labels, evidence links, limitations, question input, rename/delete, and feedback; run the full assistant journey test and expect all cases to pass.
- [X] T070 [US3] Add `app/assistant/[conversationId]/index.tsx`, replace the placeholder in `app/assistant/index.tsx`, and keep `app/assistant/_layout.tsx` thin; run `npm test -- --runInBand src/features/assistant/AssistantRoutes.test.tsx` and expect all tests to pass.
- [X] T071 [US3] Write failing cross-feature invalidation cases in `src/features/reports/report-invalidation.test.ts` proving finance/planning mutations emit both `reports.live` and `assistant.context` while immutable response/snapshot keys remain untouched; run the file and confirm failure.
- [X] T072 [US3] Add `reports.live` and `assistant.context` to affected scopes in `src/services/mocks/core-finance-service.ts` and `src/services/mocks/financial-planning-service.ts`, and teach existing invalidators in `src/features/core-finance/core-finance-queries.ts` and `src/features/financial-planning/financial-planning-queries.ts` to refresh them; run the invalidation test and expect all tests to pass.
- [X] T073 [US3] Add the assistant entry and disabled/limit state label to `app/(tabs)/more.tsx`, extend `src/features/shell/NavigationJourney.test.tsx`, and run that file to green.

**Checkpoint**: US3 answers are independently verifiable and historical responses never refresh from live data.

---

## Phase 6: User Story 4 - Review and Confirm Assistant Actions (Priority: P1)

**Goal**: Require an editable current preview, explicit confirmation, owner-service mutation, and idempotent result for every proposed change.

**Independent Test**: Exercise every supported proposal through preview, edit, cancel, navigation interruption, confirm, pending, success, failure, offline, stale, expired, entitlement change, and repeated operation ID.

### Tests for User Story 4

- [X] T074 [P] [US4] Write failing preview transition tests in `src/domain/assistant-actions.test.ts` for every proposal kind, editable inputs, exact destination/value disclosure, current-to-stale comparison, expiry, cancel, failure review, and prohibited direct-message execution; run the file and confirm failure.
- [X] T075 [P] [US4] Write failing assistant action service tests in `src/services/mocks/assistant-actions.test.ts` proving preview creation causes no owner change, confirmation rereads source versions/permission/entitlement, invokes the canonical owner once, and preserves input on cancel/failure/offline/replay; run the file and confirm failure.
- [X] T076 [P] [US4] Write a failing action-preview screen journey in `src/features/assistant/AssistantActionPreviewScreen.test.tsx` for disclosure, edit, back/cancel, confirmation, pending, stale, expired, success destination, safe failure, offline, and repeated taps; run the file and confirm failure.
- [X] T077 [P] [US4] Write failing dynamic action-route tests in `src/features/assistant/AssistantRoutes.test.tsx` for `/assistant/[conversationId]/actions/[previewId]` and rejected raw destinations; run the file and confirm failure.

### Implementation for User Story 4

- [X] T078 [US4] Implement pure preview creation/update/revalidation/transition functions in `src/domain/assistant.ts`; run `npm test -- --runInBand src/domain/assistant.test.ts src/domain/assistant-actions.test.ts` and expect all tests to pass.
- [X] T079 [US4] Implement `getActionPreview`, `updateActionPreview`, `confirmAction`, and `cancelAction` in `src/services/mocks/assistant-service.ts`, delegating data changes to existing planning/finance services with stable operation IDs; run the assistant action service test and expect all tests to pass.
- [X] T080 [US4] Add action query/mutation keys and narrow invalidation in `src/features/assistant/assistant-queries.ts`; run `npm test -- --runInBand src/features/assistant/assistant-queries.test.ts` and expect all tests to pass.
- [X] T081 [US4] Implement `src/features/assistant/AssistantActionPreviewScreen.tsx` using existing `ConfirmationDialog`, `ActionButton`, form controls, pending guard, and typed result destination; run its screen test and expect all tests to pass.
- [X] T082 [US4] Add `app/assistant/[conversationId]/actions/[previewId].tsx` as a thin route; run `npm test -- --runInBand src/features/assistant/AssistantRoutes.test.tsx` and expect all tests to pass.
- [X] T083 [US4] Add owner-version and operation-ID assertions to `src/services/mocks/financial-planning-service.test.ts` and `src/services/mocks/core-finance-service.test.ts` for assistant-triggered mutations; run both files and confirm the new cases pass without duplicate writes.
- [X] T084 [US4] Extend `src/features/assistant/AssistantJourney.test.tsx` with an end-to-end suggestion-to-owner-result case and run it to prove ordinary chat, cancel, stale, and replay paths produce no unintended change.

**Checkpoint**: US4 cannot mutate financial data without current review and explicit confirmation.

---

## Phase 7: User Story 5 - Understand and Manage a Subscription (Priority: P1)

**Goal**: Present one honest deterministic plan catalog and a complete idempotent representative lifecycle without deleting prior data.

**Independent Test**: Move fixtures through Free/Basic/Premium, monthly/annual, trial, checkout, restore, change, cancel-at-period-end, renewal, expiry, failure, cancellation, limit, and paid-content read-only states.

### Tests for User Story 5

- [X] T085 [P] [US5] Write failing subscription service tests in `src/services/mocks/subscription-settings-service.test.ts` for one catalog version, eligible trial disclosure, version conflict, start/complete outcomes, success-only entitlement, restore, change, cancel, renewal, expiry, operation replay, and representative wording; run the file and confirm failure.
- [X] T086 [P] [US5] Write failing subscription query tests in `src/features/subscriptions/subscription-queries.test.ts` for catalog/state/operation ownership and success-only invalidation; run the file and confirm failure.
- [X] T087 [P] [US5] Write a failing comparison-screen journey in `src/features/subscriptions/SubscriptionScreen.test.tsx` for current plan, monthly/annual offers, price/currency/period, features/limits, trial terms, renewal/cancellation, restore, limit, expiry, and representative disclosure; run the file and confirm failure.
- [X] T088 [P] [US5] Write a failing checkout journey in `src/features/subscriptions/SubscriptionCheckoutScreen.test.tsx` for one reviewed offer/version, pending guard, success, failure, cancel, changed catalog/state, retry, and no false payment claim; run the file and confirm failure.
- [X] T089 [P] [US5] Write a failing management journey in `src/features/subscriptions/SubscriptionManageScreen.test.tsx` for restore, plan change, cancel-at-period-end, renewal, expiry, prior entitlement retention, and repeated operations; run the file and confirm failure.
- [X] T090 [P] [US5] Write failing subscription route tests in `src/features/subscriptions/SubscriptionRoutes.test.tsx` for `/subscriptions`, `/subscriptions/checkout`, and `/subscriptions/manage`; run the file and confirm failure.

### Implementation for User Story 5

- [X] T091 [US5] Implement deterministic offer fixtures and the `SubscriptionService` lifecycle in `src/services/mocks/subscription-settings-service.ts`, using `src/storage/subscriptions-repository.ts` and changing entitlement only on successful completion; run its service test and expect all tests to pass.
- [X] T092 [US5] Implement catalog, state, and operation queries/mutations in `src/features/subscriptions/subscription-queries.ts`; run its query test and expect all tests to pass.
- [X] T093 [US5] Implement `src/features/subscriptions/SubscriptionScreen.tsx` with one catalog source, exact terms, plan/limit states, restore/manage entries, and representative disclosure; run its screen test and expect all tests to pass.
- [X] T094 [US5] Implement `src/features/subscriptions/SubscriptionCheckoutScreen.tsx` with reviewed-version guards and existing pending/confirmation primitives; run its screen test and expect all tests to pass.
- [X] T095 [US5] Implement `src/features/subscriptions/SubscriptionManageScreen.tsx` for restore/change/cancel/renewal/expiry outcomes; run its screen test and expect all tests to pass.
- [X] T096 [US5] Add thin routes in `app/subscriptions/_layout.tsx`, `app/subscriptions/index.tsx`, `app/subscriptions/checkout.tsx`, and `app/subscriptions/manage.tsx`; run the subscription route test and expect all tests to pass.
- [X] T097 [US5] Implement and test the paid-content access decision in `src/features/subscriptions/entitlement-policy.ts` and `src/features/subscriptions/entitlement-policy.test.ts`, proving downgrade/expiry returns `read_only` for existing paid content and never deletes finance, conversations, reports, or settings; run the test file to green.

**Checkpoint**: US5 is complete without any production payment claim or provider integration.

---

## Phase 8: User Story 6 - Manage Profile, Security, and Privacy (Priority: P1)

**Goal**: Provide durable profile/application choices, representative session/security views, consent controls, privacy requests, and safe local-data deletion.

**Independent Test**: Edit every approved setting, exercise security/session/privacy operations and failures, verify one masking owner and timezone propagation, and prove local deletion commits or rolls back as one allowlisted transaction.

### Tests for User Story 6

- [X] T098 [P] [US6] Write failing settings service tests in `src/services/mocks/subscription-settings-service.test.ts` for profile load/save validation/versioning, identity-owner redirects, deterministic sessions/events, revoke one/all, privacy requests, success-only auth clearing, and operation replay; run the file and confirm the new cases fail.
- [X] T099 [P] [US6] Write failing settings query tests in `src/features/settings/settings-queries.test.ts` for profile, sessions, security-event pages, privacy requests, local deletion, and precise success-only invalidation; run the file and confirm failure.
- [X] T100 [P] [US6] Write failing profile/application/privacy screen journeys in `src/features/settings/SettingsJourney.test.tsx` for all FR-046/047/050 fields, validation, unsaved input preservation, owner links, consent consequences, request review/pending/accepted/failure, and no false export/deletion completion; run the file and confirm failure.
- [X] T101 [P] [US6] Write failing session/security-event screen journeys in `src/features/settings/SecuritySessionsJourney.test.tsx` for current/other/expired/revoked sessions, single/all revocation, pending/failure, current-session clearing after success only, event recovery, and masked context; run the file and confirm failure.
- [X] T102 [P] [US6] Write failing local-data deletion transaction tests in `src/storage/local-data-reset.test.ts` for the exact deletion allowlist, preservation allowlist, successful cache-clear signal, forced rollback, retry/replay, and separation from account deletion; run the file and confirm failure.
- [X] T103 [P] [US6] Write failing timezone/masking integration tests in `src/features/settings/settings-integration.test.ts` proving reports and notification policy use profile timezone, timezone/currency changes invalidate live projections only, and Security/Application settings read/write the same `hideBalances`; run the file and confirm failure.
- [X] T104 [P] [US6] Write failing route tests in `src/features/settings/SettingsRoutes.test.tsx` for profile, application, privacy, security settings, sessions, and events routes; run the file and confirm failure.

### Implementation for User Story 6

- [X] T105 [US6] Implement the `SettingsService` methods in `src/services/mocks/subscription-settings-service.ts` by composing protected settings storage, deterministic session/event fixtures, existing auth ownership, privacy request states, and local reset; run its test file and expect all tests to pass.
- [X] T106 [US6] Implement settings query keys/mutations in `src/features/settings/settings-queries.ts`; run its query test and expect all tests to pass.
- [X] T107 [US6] Implement `src/features/settings/ProfileScreen.tsx` with validated editable profile fields, completion state, and auth-owner links; replace `app/profile/index.tsx` with a thin route and run the relevant settings journey/route tests to green.
- [X] T108 [US6] Implement `src/features/settings/ApplicationSettingsScreen.tsx` for language, theme, week start, default account, hidden balances, transaction defaults, dashboard, tracking, voice, report, and notification owner links; add `app/profile/application.tsx` and run the settings journey/route tests to green.
- [X] T109 [US6] Implement `src/features/settings/PrivacySettingsScreen.tsx` for tracking/assistant/analytics controls, legal/privacy explanations, export/account-deletion request review, and local-delete entry; add `app/profile/privacy.tsx` and run the settings journey/route tests to green.
- [X] T110 [US6] Implement `src/features/settings/SessionListScreen.tsx` and `src/features/settings/SecurityEventScreen.tsx`; add thin `app/security/sessions.tsx` and `app/security/events.tsx` routes and run the security-session/route tests to green.
- [X] T111 [US6] Preserve existing PIN, biometric, auto-lock, privacy-screen, and sole hide-balances controls while adding sessions/events/local-delete links in `app/security/settings.tsx`; run `npm test -- --runInBand src/features/security/SecurityJourney.test.tsx src/features/settings/SettingsRoutes.test.tsx` and expect all tests to pass.
- [X] T112 [US6] Implement transactional allowlisted deletion in `src/storage/local-data-reset.ts` using the existing exclusive database boundary, clearing affected Query/view state only after commit and preserving session/security/accessibility/profile/entitlement values; run its test file and expect all tests to pass.
- [X] T113 [US6] Replace the hard-coded report timezone in `src/features/reports/report-queries.ts` with the protected profile timezone and add timezone/currency invalidation to `src/features/settings/settings-queries.ts`; run `npm test -- --runInBand src/features/settings/settings-integration.test.ts src/features/reports/report-invalidation.test.ts` and expect all tests to pass.
- [X] T114 [US6] Remove any remaining duplicate hidden-balance field/caller from `src/features/security/privacy-lock.ts` and route both security/application controls through `src/state/preferences.ts`; run `rg "hideBalances" src/features/security src/features/settings src/state` and the settings integration test, expecting one storage owner and passing behavior.
- [X] T115 [US6] Add Profile, Security, Privacy, Subscription, and Support destinations to `app/(tabs)/more.tsx`, extend `src/features/shell/NavigationJourney.test.tsx`, and run that file to green.

**Checkpoint**: US6 changes only the intended settings/state and destructive actions never claim early success.

---

## Phase 9: User Story 7 - Find Help and Contact Support (Priority: P2)

**Goal**: Provide localized searchable help plus recoverable, idempotent ticket/feedback/report workflows with minimal optional context.

**Independent Test**: Search Arabic/English help, submit every form mode, interrupt/offline/retry drafts, review/remove context, and use ticket list/detail/reply/rating without attachments or false live-support claims.

### Tests for User Story 7

- [X] T116 [P] [US7] Write failing support service tests in `src/services/mocks/support-service.test.ts` for localized exact/partial/no-result search, draft save/load/discard, validation, offline/failure recovery, submitted-only ticket/reply/report creation, rating eligibility, operation replay, and no attachments; run the file and confirm failure.
- [X] T117 [P] [US7] Write failing draft-hook tests in `src/features/support/useSupportDraft.test.tsx` for debounce/save, navigation interruption, restart restore, validation failure, offline failure, explicit discard, and no submitted-state overwrite; run the file and confirm failure.
- [X] T118 [P] [US7] Write failing support query tests in `src/features/support/support-queries.test.ts` for article search, ticket pages/detail, drafts, submit/reply/rate mutations, and submitted-only invalidation; run the file and confirm failure.
- [X] T119 [P] [US7] Write failing help and support-form journeys in `src/features/support/SupportJourney.test.tsx` for FAQ/help/What's New, app version, Arabic/English search, no-result ticket path, every draft mode, validation, context review/removal, offline/retry, and representative wording; run the file and confirm failure.
- [X] T120 [P] [US7] Write failing ticket list/detail journeys in `src/features/support/TicketJourney.test.tsx` for stable references, status/times/history, reply preservation, resolved/closed rating, pending/failure/replay, and no attachment UI; run the file and confirm failure.
- [X] T121 [P] [US7] Write failing transaction/assistant report entry tests in `src/features/support/support-context-integration.test.tsx` for exact referenced ID/kind/safe category/status/app-version/diagnostic allowlist and exclusion of amounts, account IDs, raw SMS, notes, conversation history, credentials, and secrets; run the file and confirm failure.
- [X] T122 [P] [US7] Write failing route tests in `src/features/support/SupportRoutes.test.tsx` for support home/new/tickets/ticket-detail routes and typed report-mode parameters; run the file and confirm failure.

### Implementation for User Story 7

- [X] T123 [US7] Implement `SupportService` in `src/services/mocks/support-service.ts` with deterministic localized catalogs, repository-backed drafts/tickets/operations, safe validation failures, and idempotent representative outcomes; run its service test and expect all tests to pass.
- [X] T124 [US7] Implement durable form recovery in `src/features/support/useSupportDraft.ts`; run its hook test and expect all tests to pass.
- [X] T125 [US7] Implement article/ticket/draft query keys and submitted-only mutations in `src/features/support/support-queries.ts`; run its query test and expect all tests to pass.
- [X] T126 [US7] Implement `src/features/support/SupportHomeScreen.tsx` with localized search, FAQ/help/What's New, version, no-result, ticket-history, and feedback entries; run the support journey home cases to green.
- [X] T127 [US7] Implement one typed `src/features/support/SupportFormScreen.tsx` for ticket, feedback, transaction report, and assistant report modes using `useSupportDraft`, reviewed optional context, no attachment field, and representative outcomes; run the full support journey test to green.
- [X] T128 [US7] Implement `src/features/support/TicketListScreen.tsx` and `src/features/support/TicketDetailScreen.tsx` with virtualized history, reply, resolved/closed rating, and safe states; run the ticket journey test to green.
- [X] T129 [US7] Add typed support-report entry actions to `src/features/transactions/TransactionDetailScreen.tsx` and `src/features/assistant/AssistantConversationScreen.tsx`, constructing only the approved structural context; run the support context integration test and expect all tests to pass.
- [X] T130 [US7] Add thin routes in `app/support/_layout.tsx`, `app/support/index.tsx`, `app/support/new.tsx`, `app/support/tickets/index.tsx`, and `app/support/tickets/[id].tsx`; run the support route test and expect all tests to pass.

**Checkpoint**: US7 preserves work through recoverable failures and includes only user-reviewed allowlisted context.

---

## Phase 10: User Story 8 - Recover Across Languages, Devices, and Data States (Priority: P1)

**Goal**: Make every SPEC-009 journey trustworthy in Arabic/English, assistive modes, hidden-value states, and unreliable data/connectivity conditions.

**Independent Test**: Run the complete screen/state matrix in Arabic RTL and English LTR, light/dark, small/large/tablet layouts, 200% text, reduced motion, screen readers, hidden/visible values, and offline/stale/pending/failure recovery.

### Tests for User Story 8

- [X] T131 [P] [US8] Write failing SPEC-009 localization parity tests in `src/localization/assistant-notifications-messages.test.ts` for equivalent Arabic/English keys, genuine Arabic values, English numerals, mixed-direction isolation, and every domain state/recovery label; run the file and confirm failure.
- [X] T132 [P] [US8] Write failing cross-feature accessibility tests in `src/features/assistant-notifications/AssistantNotificationsAccessibility.test.tsx` for 44-by-44 targets, logical focus/task order, 200% text, screen-reader names/state/position, non-color meaning, reduced motion, and hidden values absent from labels; run the file and confirm failure.
- [X] T133 [P] [US8] Write failing cross-feature state-matrix tests in `src/features/assistant-notifications/AssistantNotificationsStates.test.tsx` for loading, empty, complete, dense, partial, stale, error, offline, permission, disabled, limit, pending, success, failed, expired, action-expired, archived, and deleted-target recovery; run the file and confirm failure.
- [X] T134 [P] [US8] Write the 1,000-notification plus 1,000-response performance test in `src/features/notifications/assistant-notifications-performance.test.tsx`, asserting exact cross-page counts, first useful content under two seconds after warm-up, and fewer than 100 mounted rows; run the file and confirm failure before optimizations.
- [X] T135 [P] [US8] Write failing privacy-output tests in `src/features/assistant-notifications/assistant-notifications-privacy.test.tsx` proving protected values and user-authored content never enter native content, app-switcher content, accessibility labels, analytics, raw errors, or test logs; run the file and confirm failure.

### Implementation for User Story 8

- [X] T136 [US8] Add complete `assistantNotifications` message trees to `src/localization/messages/ar.ts` and `src/localization/messages/en.ts`, using existing financial/date formatters and direction helpers; run the localization parity test and expect all tests to pass.
- [X] T137 [US8] Fix only the failures found by the accessibility suite in SPEC-009 screens/components, reusing existing design-system primitives and adding no parallel UI kit; run `npm test -- --runInBand src/features/assistant-notifications/AssistantNotificationsAccessibility.test.tsx` and expect all tests to pass.
- [X] T138 [US8] Implement explicit safe recovery rendering for the failed matrix cases in `src/features/notifications/NotificationCenterScreen.tsx`, `src/features/assistant/AssistantHomeScreen.tsx`, `src/features/assistant/AssistantConversationScreen.tsx`, `src/features/subscriptions/SubscriptionScreen.tsx`, `src/features/settings/ProfileScreen.tsx`, and `src/features/support/SupportHomeScreen.tsx`; run the state-matrix test and expect all tests to pass with no raw error text.
- [X] T139 [US8] Ensure notification and conversation histories use paged `FlatList` rendering and stable keys in `src/features/notifications/NotificationCenterScreen.tsx` and `src/features/assistant/AssistantConversationScreen.tsx`; run the performance test and expect all thresholds/counts to pass.
- [X] T140 [US8] Apply the shared masking/safe-failure/analytics guards at the failing output seams only; run `npm test -- --runInBand src/features/assistant-notifications/assistant-notifications-privacy.test.tsx src/analytics/assistant-notifications-events.test.ts` and expect all tests to pass without sensitive console output.

**Checkpoint**: US8 proves the completed feature outside ideal language, device, privacy, and connectivity states.

---

## Phase 11: Polish and Cross-Cutting Verification

**Purpose**: Prove boundary compliance, regression safety, native-only behavior, performance, and measurable acceptance without adding new product scope.

- [X] T141 [P] Run `npm run typecheck`, `npm run lint`, and every `check:*` script from `quickstart.md`; fix only SPEC-009-caused failures in their owning files and record command/exit-code evidence in `specs/009-assistant-notifications/validation.md`.
- [X] T142 Run `node scripts/check-assistant-notifications-boundaries.test.mjs` and `npm test -- --runInBand`; fix only SPEC-009 regressions, then record passing counts and schema-v7/idempotency evidence in `specs/009-assistant-notifications/validation.md`.
- [X] T143 [P] Run the performance fixture after one warm-up, record device/test-hardware, elapsed first-content time, exact counts, and maximum mounted rows in `specs/009-assistant-notifications/validation.md`, and fail the task if any SPEC-009 secret/content appears in logs.
- [ ] T144 Execute Android development-build scenarios 1-9 from `specs/009-assistant-notifications/quickstart.md`, including permission education/system settings, foreground/background/cold response, View/Edit/Undo unlock, expired fallback, hidden values, Arabic/English, 200% text, TalkBack, small phone, dark mode, and offline recovery; store evidence paths and pass/fail results in `specs/009-assistant-notifications/validation.md`.
- [X] T145 On macOS/Xcode, execute the equivalent iOS and VoiceOver cases from `specs/009-assistant-notifications/quickstart.md`; otherwise record them as blocked—not passed—with the missing macOS/Xcode reason in `specs/009-assistant-notifications/validation.md`.
- [X] T146 Run an explicit requirements trace review from FR-001 through FR-065 and SC-001 through SC-014 against tests/evidence, recording each requirement's task/test/evidence reference and any unmet item in `specs/009-assistant-notifications/validation.md`; do not mark the feature complete while an acceptance requirement lacks proof.
- [ ] T147 Conduct or import usability measurements for SC-001, SC-004, SC-005, SC-008, SC-010, SC-011, and SC-013, recording sample, timing/accuracy/rating results, and pass/blocked status in `specs/009-assistant-notifications/validation.md`; never infer percentage success from automated tests.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 Setup** has no dependency.
- **Phase 2 Foundation** depends on Phase 1 and blocks every user story.
- **US1, US3, US5, US6, and US7** may start independently after the foundation.
- **US2** depends on US1's notification service/center but remains independently testable through policy and adapter fixtures.
- **US4** depends on US3 conversations/responses and the existing finance/planning owners.
- **US8** depends on every desired product-story phase because it verifies their cross-feature states.
- **Phase 11 Polish** depends on every story included in the release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 --\
                    -> US3 -> US4 ---+-> US8 -> Polish
                    -> US5 ----------+
                    -> US6 ----------+
                    -> US7 ----------/
```

### Within Each Story

1. Create the named tests and confirm they fail for the missing behavior.
2. Implement domain/service logic before queries.
3. Implement queries before screens and thin routes.
4. Complete owner integration after the isolated service/screen behavior passes.
5. Run the story's independent test before moving to its checkpoint.

## Parallel Opportunities

- Foundation tests T005-T009, repository tests T018/T020/T022, analytics T026-T027, fixtures T028, and route tests T029 can run concurrently where their explicit dependencies are complete.
- **US1**: T031-T034 can run together; T041 and T043 can run together after T035.
- **US2**: T047-T050 can run together; T051, T052, and T054 use separate files after their tests exist.
- **US3**: T060-T064 can run together; T068 and T069 can be split after T067.
- **US4**: T074-T077 can run together; T081 can proceed after T079-T080 while T083 verifies owner services.
- **US5**: T085-T090 can run together; T093-T095 use separate screen files after T092.
- **US6**: T098-T104 can run together; T107-T110 use separate screen/route files after T106.
- **US7**: T116-T122 can run together; T126-T129 use separate feature-owner files after T123-T125.
- **US8**: T131-T135 can run together; T136-T140 then fix only the independently identified failures.

## Implementation Strategy

### MVP First

1. Complete Setup T001-T004.
2. Complete Foundation T005-T030.
3. Complete US1 T031-T046.
4. Stop and run the US1 independent test; this is the smallest deployable SPEC-009 increment.

### Incremental Delivery

1. Add US2 for notification attention/privacy.
2. Add US3, then dependent US4, for guidance and confirmed actions.
3. Add US5 for subscription lifecycle.
4. Add US6 for profile/security/privacy.
5. Add US7 for support.
6. Add US8 and final verification only after the selected product stories pass independently.

## Notes

- `[P]` means separate files and no unfinished dependency; tasks editing the same file remain ordered.
- Routes render feature screens only. They do not access SQLite, calculate finance, execute provider work, or claim external success.
- Reuse existing Query, Zustand preference, form, design-system, formatter, privacy, and mutation-result patterns; add no event bus, Markdown renderer, remote provider SDK, or second feature-entity store.
- Stop any task that requests a push token, provider credential, direct AI/payment/support/export/account endpoint, or reports unavailable native evidence as passed.
