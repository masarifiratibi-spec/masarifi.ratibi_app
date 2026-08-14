# Implementation Plan: Notifications, Smart Financial Assistant, Subscriptions, and Support

**Branch**: `009-assistant-notifications` | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-assistant-notifications/spec.md`

## Summary

Replace the Assistant and Profile placeholders and add notification, subscription, privacy, and
support routes around the existing five-tab shell. Centralize notification history and local
phone presentation; compose confirmed Core Finance, Financial Planning, and Reports data into
deterministic assistant responses with immutable snapshots and explicitly confirmed actions; and
provide representative subscription, session, privacy-request, and support lifecycles without
claiming production services. Advance SQLite once to schema v7 for durable history/operations,
extend the existing protected preferences instead of adding another store, repair cross-feature
query invalidation, and add only the Expo-SDK-compatible `expo-notifications` package for real
local permission, presentation, response, and quick-action behavior. Remote push, AI providers,
payments, support backends, background delivery, data-export files, and backend account deletion
remain outside scope.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo SQLite 14, Expo SecureStore 13,
Expo Local Authentication 14, Expo Notifications 0.28.19, TanStack Query 5, Zustand 4, Zod 3,
i18next 23, React Hook Form 7, and the existing Masarifi design system; native `Intl` for
timezone/date/financial presentation; no AI, payment, support, Markdown, date, or new state
dependency

**Storage**: Existing SQLite schema advances from version 6 to 7 with notification preference/
history, assistant consent/conversations/responses/action previews, subscription state/
operations, and support ticket/draft/operation tables. Response snapshots remain embedded in
assistant responses. Protected profile/application preferences remain in SecureStore-backed
storage. Offer/help/session fixtures and live financial context are not persisted as new catalogs
or caches.

**Testing**: Jest and React Native Testing Library for notification policy/deduplication/
deletion, quiet hours/timezones/summaries/masking, response routing/unlock/revalidation,
assistant consent/context/snapshots/stale previews/action idempotency, subscription lifecycle and
read-only downgrade, settings ownership, session/privacy/local-deletion behavior, support drafts/
allowlists/idempotency, schema v7 persistence, cross-feature invalidation, analytics privacy,
localization/accessibility, routes/recovery, and a 1,000-notification plus 1,000-response
performance fixture; Android development build for actual permission, local presentation,
cold/live response, quick actions, layout, lifecycle, offline behavior, and TalkBack; iOS native
checks require macOS/Xcode

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels and adaptive tablets; web remains a
non-authoritative preview for native notification behavior

**Project Type**: Shared Expo and React Native mobile application with typed local adapters

**Performance Goals**: First useful content within two seconds for 1,000 notifications and 1,000
assistant-history items; correct paging/filtering/grouping across the full fixture; fewer than 100
mounted rows per virtualized list; no financial calculation or source lookup per rendered row

**Constraints**: Frontend-only deterministic services except real local notification permission/
presentation; confirmed financial records remain canonical and count once; immutable assistant
response snapshots; current/versioned assistant action previews; stable operation IDs; typed safe
notification destinations; normal unlock before protected actions; critical-access-only quiet
hour bypass; global masking default; one owner for timezone and hidden balances; subscription
content read-only after lost entitlement; allowlisted transactional local deletion; no production
secret, remote push token, provider, background task, AI, payment, support, export-file, or backend
account-deletion claim; Arabic RTL and English LTR parity; English numerals; 200% text; 44 by 44
targets; reduced motion; no camera, receipts, investments, or iOS SMS claim

**Scale/Scope**: Eight user journeys; five feature domains; notification center/preferences;
assistant home/conversation/action routes; subscription comparison/checkout/management; profile,
application, privacy, session, and security-event routes; help/ticket routes; 11 new SQLite v7
tables; one approved offer/help/session fixture set; complete, empty, dense, partial, stale,
offline, permission, disabled, limit, pending, success, failure, expired, stale-action, deleted-
target, and rollback scenarios

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Notifications reference canonical events, deduplicate by stable key,
  carry typed safe targets, and never mutate a source on deletion. Assistant answers use confirmed
  owner services and immutable evidence snapshots; actions require current preview, explicit
  confirmation, version revalidation, and an idempotent owner mutation. Entitlements, tickets,
  sessions, privacy requests, and deletion outcomes change only after trusted representative
  success. Global masking and structural context allowlists protect every external surface.
- **Platform honesty - PASS**: Android and iOS share domain, notification-center, assistant,
  subscription, settings, and support behavior. A platform adapter represents actual local
  permission/presentation/action capability; unsupported actions degrade to View or an in-app
  fallback. The plan requests no remote push token and claims no background delivery, production
  AI/payment/support/export/account-deletion result, or Android SMS behavior on iOS. In-app
  history and manual finance remain usable after permission denial or offline state.
- **Language and access - PASS**: Arabic/English catalogs, logical direction, English numerals,
  locale-aware money/date/time, mixed-direction content, screen-reader labels, 200% text, reduced
  motion, grayscale/non-color meaning, ordered focus, virtualized lists, and 44 by 44 targets
  cover every route and state. Native TalkBack/VoiceOver evidence is required where available.
- **Design system - PASS**: Existing ActionButton, MenuLink, forms, StateView, StatusBanner,
  StatusBadge, NotificationBadge, SensitiveValue, ConfirmationDialog, semantic tokens, privacy
  helpers, and list patterns are reused. No parallel UI kit, Markdown renderer, raw brand values,
  or custom virtualized list is introduced.
- **Architecture and proof - PASS**: Core Finance, Financial Planning, Reports, App Shell, and
  protected preferences remain canonical owners. Query owns service data; Zustand keeps current
  shell/preferences only. Screens never access SQLite or providers. Schema v7 uses feature
  repositories and safe operation IDs. Focused automated, boundary, performance, and native
  checks cover financial, privacy, platform, lifecycle, and access risks.

## Project Structure

### Documentation (this feature)

```text
specs/009-assistant-notifications/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- assistant-notifications-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- _layout.tsx
|-- (tabs)/
|   `-- more.tsx
|-- notifications/
|   |-- _layout.tsx
|   |-- index.tsx
|   `-- preferences.tsx
|-- assistant/
|   |-- _layout.tsx
|   |-- index.tsx
|   `-- [conversationId]/
|       |-- index.tsx
|       `-- actions/[previewId].tsx
|-- subscriptions/
|   |-- _layout.tsx
|   |-- index.tsx
|   |-- checkout.tsx
|   `-- manage.tsx
|-- profile/
|   |-- _layout.tsx
|   |-- index.tsx
|   |-- application.tsx
|   `-- privacy.tsx
|-- security/
|   |-- settings.tsx
|   |-- sessions.tsx
|   `-- events.tsx
`-- support/
    |-- _layout.tsx
    |-- index.tsx
    |-- new.tsx
    `-- tickets/
        |-- index.tsx
        `-- [id].tsx

src/
|-- domain/
|   |-- notifications.ts
|   |-- assistant.ts
|   |-- subscriptions.ts
|   |-- settings.ts
|   `-- support.ts
|-- features/
|   |-- notifications/
|   |   |-- NotificationCenterScreen.tsx
|   |   |-- NotificationPreferencesScreen.tsx
|   |   |-- notification-policy.ts
|   |   |-- notification-response-controller.ts
|   |   `-- notification-queries.ts
|   |-- assistant/
|   |   |-- AssistantHomeScreen.tsx
|   |   |-- AssistantConversationScreen.tsx
|   |   |-- AssistantActionPreviewScreen.tsx
|   |   `-- assistant-queries.ts
|   |-- subscriptions/
|   |   |-- SubscriptionScreen.tsx
|   |   |-- SubscriptionCheckoutScreen.tsx
|   |   |-- SubscriptionManageScreen.tsx
|   |   `-- subscription-queries.ts
|   |-- settings/
|   |   |-- ProfileScreen.tsx
|   |   |-- ApplicationSettingsScreen.tsx
|   |   |-- PrivacySettingsScreen.tsx
|   |   |-- SessionListScreen.tsx
|   |   |-- SecurityEventScreen.tsx
|   |   `-- settings-queries.ts
|   `-- support/
|       |-- SupportHomeScreen.tsx
|       |-- SupportFormScreen.tsx
|       |-- TicketListScreen.tsx
|       |-- TicketDetailScreen.tsx
|       |-- support-queries.ts
|       `-- useSupportDraft.ts
|-- services/
|   |-- contracts/
|   |   `-- assistant-notifications-service.ts
|   |-- platform/
|   |   `-- phone-notification-service.ts
|   `-- mocks/
|       |-- assistant-notifications-service.ts
|       |-- subscription-settings-service.ts
|       `-- support-service.ts
|-- storage/
|   |-- database.ts
|   |-- assistant-notifications-repository.ts
|   |-- subscriptions-repository.ts
|   |-- support-repository.ts
|   |-- settings-storage.ts
|   `-- local-data-reset.ts
|-- state/
|   |-- app-shell.ts
|   `-- preferences.ts
|-- features/shell/
|   |-- navigation-context.ts
|   |-- deep-link-controller.ts
|   |-- resolve-entry-route.ts
|   `-- ProtectedRouteGate.tsx
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- analytics/
|   `-- assistant-notifications-events.ts
`-- test-utils/
    `-- assistant-notifications-fixtures.ts

scripts/
|-- check-assistant-notifications-boundaries.mjs
`-- check-assistant-notifications-boundaries.test.mjs

package.json
package-lock.json
app.json
```

Focused tests remain beside domain, repository, service, feature, route, analytics, storage,
localization, performance, and boundary behavior. Existing PIN/biometric screens, finance/
planning/report owners, transaction/obligation destinations, design-system components, and
tracking/voice source flows are modified only at their existing seams rather than copied under
SPEC-009.

**Structure Decision**: Keep one Spec Kit feature because the approved master groups these
experiences, but preserve five domain/UI units and narrow service interfaces so each can be built
and tested independently. Use three repositories for the three durable histories/lifecycles,
protected storage for small profile/preferences, and one platform adapter for native local
notifications. Do not add an event bus, assistant ledger/cache, profile/security Zustand store,
settings framework, provider abstraction beyond the typed feature contracts, or duplicate
finance/report routes.

## Implementation Strategy

### Slice 1: Domain, schema v7, and shared ownership repair

- Define notification/target/preferences, assistant consent/response snapshot/action preview,
  subscription offer/state/operation, profile/session/privacy, and support draft/ticket/operation
  models with Zod validation, versions, stable operation IDs, and safe failures.
- Advance SQLite from v6 to v7 with the 11 tables/indexes in data-model.md. Add repositories for
  notification/assistant, subscription, and support history; keep fixtures and live context out
  of storage.
- Extend protected preferences with timezone and approved application choices, make the existing
  preference hide-balances value the only owner, and remove the duplicate privacy-lock field.
- Replace Reports' hard-coded Riyadh timezone with the profile preference. Make finance/planning
  mutations emit and invalidate `reports.live` and `assistant.context` while historical snapshots
  and completed operations remain immutable.
- Add an allowlisted exclusive local-data reset whose successful commit is followed by targeted
  Query/view cleanup; preserve session, security controls, locale/theme/timezone, profile, and
  entitlement.

### Slice 2: Notification center, policy, and native local presentation

- Add the notification center, filters, unread/bulk actions, deletion, grouped virtualized list,
  preferences, permission education/recovery, quiet hours, daily/weekly summaries, and all
  required states.
- Replace tracking/voice outcome-only helpers at their current callers with one central creation/
  policy service; seed deterministic events for remaining categories without introducing an
  event bus.
- Add `expo-notifications` through the Expo installer and config plugin. Implement permission,
  category registration, local presentation, last-response, live-response, and settings-open
  methods without requesting a push token or background task.
- Store only local notification ID in native data. Resolve typed target, require normal unlock,
  revalidate source/action, and execute at most once. Deleted/changed/expired targets use safe
  fallbacks.
- Apply phone privacy before native presentation using the sole global masking owner and the
  lock-screen preference. Keep in-app history regardless of phone outcome.

### Slice 3: Assistant context, conversations, and confirmed actions

- Replace the Assistant placeholder with consent, suggested questions, conversation history,
  structured answers, evidence/limitation links, rename/delete, feedback, usage-limit, and
  recovery states using virtualized pages.
- Compose confirmed Core Finance, Financial Planning, and Reports service results. Create direct,
  comparison, explanation, saving suggestion, plan, obligation, insufficient-data, and safe-
  redirect fixtures; never call an AI provider or recalculate owner rules.
- Persist one immutable safe snapshot/as-of time per completed response. New questions use current
  confirmed context; historical responses never refresh.
- Add typed action previews with exact effects, editable input, expiry, source versions, and
  stable operation IDs. Revalidate after unlock/confirmation and call the canonical owner once;
  stale, offline, failed, cancelled, and repeated paths claim no duplicate change.

### Slice 4: Subscription comparison and lifecycle

- Add one versioned Free/Basic/Premium fixture catalog shared by comparison, limit, trial,
  checkout, and management screens; show price/currency, period, features/limits, eligibility,
  post-trial price, renewal, cancellation, and representative-payment disclosure before action.
- Persist one subscription state and operation history. Model purchase, trial, restore, change,
  cancel-at-period-end, renewal, expiry, payment failure, and cancellation with version checks and
  stable operation IDs.
- Change entitlement only on successful representative outcome. Preserve prior state on failure/
  cancel, prevent duplicate restoration, and retain paid-only existing content read-only after
  downgrade/expiry.

### Slice 5: Profile, application, security, privacy, and local deletion

- Replace the Profile placeholder and add application/privacy routes. Reuse existing identity,
  PIN, biometric, auto-lock, hidden-balance, tracking, report, and account owners through links or
  narrow service calls; do not duplicate their state.
- Persist protected profile/application preferences with validation and draft retention. Propagate
  timezone/currency changes to live report, assistant, and notification policy scopes.
- Add representative session and security-event screens. Route one/all revocation through the
  typed auth/settings boundary; clear current local session only after successful outcome.
- Add consent controls, privacy explanation, analytics preference, export/account-deletion
  request states, and explicit local-data deletion review/result. Never call request acceptance a
  delivered export or completed account deletion.

### Slice 6: Help, support drafts, contextual reports, and recovery

- Add deterministic localized FAQ/help/What's New search, ticket list/detail, reply/rating, and
  one typed support form for ticket, feedback, transaction report, and assistant report.
- Preserve drafts through validation, navigation, restart, offline state, and representative
  failure. Use stable operation IDs so only success creates/updates visible state.
- Reuse transaction and assistant detail entry points with context off by default and an explicit
  structural allowlist. Exclude attachments and unrelated financial/account/conversation data.
- Map loading, empty, dense, partial, stale, offline, disabled, limit, pending, success, failure,
  expired, deleted-target, and rollback states to localized recovery without raw errors.

### Slice 7: Privacy boundaries, access proof, and native evidence

- Add fixed analytics event/outcome unions that reject financial, notification, assistant,
  commercial identity, profile, credential, and support-text fields.
- Add one feature boundary script/test rejecting direct SQLite in UI, provider SDKs/calls,
  remote-push tokens, raw colors/strings, feature entities in Zustand, sensitive logs/analytics,
  unguarded actions, false provider success, and unsupported platform claims.
- Add focused domain/repository/service/query/route/screen/accessibility/localization/recovery tests
  plus the deterministic 1,000 + 1,000 performance fixture.
- Retain Android development-build evidence for permission, settings recovery, local foreground/
  background/cold-start presentation, each action, unlock/revalidation, Arabic/English, themes,
  200% text, small/large screens, offline behavior, hidden values, and TalkBack. Record iOS/
  VoiceOver as blocked unless macOS/Xcode evidence is available.

## Phase 0: Research Outcome

[research.md](research.md) resolves the native-notification dependency, modular service/domain
boundaries, canonical financial composition, schema v7 persistence, typed target and delivery
policy, timezone/quiet-hour behavior, protected action routing, immutable assistant snapshots,
preview/idempotency, subscription catalog/lifecycle, settings ownership, local deletion, support
allowlisting, Query invalidation, UI reuse, privacy, and validation strategy. No planning
clarification remains open.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines ownership, shared results/failures, notification events/
  preferences/targets, assistant consent/conversations/responses/snapshots/previews, subscription
  offers/state/operations, profile/preferences/sessions/security/privacy requests, support
  articles/drafts/tickets/operations, schema v7 mapping, deletion invariants, and scale.
- [contracts/assistant-notifications-contract.md](contracts/assistant-notifications-contract.md)
  defines routes, five typed service boundaries, the phone adapter, canonical source/action
  ownership, policy, protected navigation, query invalidation, privacy/analytics, localization/
  accessibility, performance, and simulation boundaries.
- [quickstart.md](quickstart.md) provides runnable static, automated, performance, Android native,
  recovery, localization, accessibility, privacy, lifecycle, and invariant validation for all
  eight user stories and five clarifications.

## Post-Design Constitution Re-check

The design keeps financial records/calculations, reports, authentication/security controls, and
protected preferences with their existing owners. SPEC-009 persists only its user-owned history,
preferences, snapshots, drafts, and idempotent lifecycle operations. Native local notification
handling carries only a local ID, respects permission/quiet hours/masking, requires unlock and
fresh validation, and never implies remote delivery. Assistant evidence is immutable and safe;
actions cannot bypass preview/version/confirmation. Subscription, session, privacy, support, and
deletion flows never claim provider success early. Arabic/English parity, semantic component
reuse, one hidden-value owner, explicit offline/recovery states, focused automated proof, dense-
list gates, and native evidence are specified. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation requires justification. The one new dependency is the Expo-SDK-
compatible native notification module required to validate actual permission and interactive
local notification behavior; an in-app-only fake cannot satisfy those approved requirements.
Remote push, task management, event bus, AI/payment/support SDKs, assistant/report caches,
Markdown, date libraries, duplicate stores, attachments, and generic frameworks are intentionally
omitted.
