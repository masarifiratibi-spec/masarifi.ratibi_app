# Research: Notifications, Smart Financial Assistant, Subscriptions, and Support

## Decision 1: Add only the Expo-compatible notifications package

**Decision**: Add `expo-notifications` at the Expo SDK 51 bundled version (`~0.28.19`) using
`npx expo install expo-notifications`, and register its config plugin. Use it only for local
notification permission, presentation, categories, response handling, and native quick-action
proof. Do not request a push token or add remote delivery, background tasks, or provider setup.

**Rationale**: The installed stack covers every other feature need, but it cannot represent the
actual Android/iOS notification permission or native interaction lifecycle. Expo documents local
presentation, response listeners, and interactive categories in the supported package, while the
repository's bundled-module map supplies the exact SDK-compatible version. See the official
[Expo Notifications reference](https://docs.expo.dev/versions/latest/sdk/notifications/) and
[notification behavior guide](https://docs.expo.dev/push-notifications/what-you-need-to-know/).

**Alternatives considered**: An in-app-only fake cannot validate operating-system permission or
actions. `PermissionsAndroid` excludes iOS. Remote push, task-manager, and provider SDKs exceed
the approved frontend scope.

## Decision 2: Keep five narrow feature domains behind one contract module

**Decision**: Define focused domain modules for notifications, assistant, subscriptions,
settings, and support. Export narrow `NotificationService`, `AssistantService`,
`SubscriptionService`, `SettingsService`, and `SupportService` interfaces from one SPEC-009
contract module. Implement deterministic adapters per durable area rather than one giant service.

**Rationale**: The master specification deliberately ships these experiences together, but they
have independent lifecycles. Focused domain files prevent another 900-line model while one
contract module makes cross-feature ownership and operation conventions discoverable.

**Alternatives considered**: Five unrelated contract packages add ceremony; one all-purpose
service or generic settings framework hides boundaries and makes tests reject unrelated changes.

## Decision 3: Compose canonical financial owners; never copy their data

**Decision**: Assistant questions read confirmed accounts and transactions through Core Finance,
planning data through Financial Planning, and report questions through Reports. Responses persist
only a sanitized immutable context snapshot with source references and versions. Confirmed
assistant actions call the owning service through the existing mutation-result contract.

**Rationale**: This preserves one source of truth and reuses already-tested money, eligibility,
report, obligation, and savings rules. A response remains explainable after the live ledger
changes without becoming a second financial ledger.

**Alternatives considered**: Direct repository reads, duplicated assistant aggregates, direct AI
provider calls, and UI-owned financial mutations were rejected.

## Decision 4: Advance SQLite once from schema v6 to v7

**Decision**: Add JSON-payload tables with separately indexed lifecycle columns:

- `notifications` and singleton `notification_preferences`.
- Singleton `assistant_consent`, `assistant_conversations`, `assistant_responses`, and
  `assistant_action_previews`.
- Singleton `subscription_state` and idempotent `subscription_operations`.
- `support_tickets`, `support_drafts`, and idempotent `support_operations`.

Keep profile identity and protected device preferences in SecureStore-backed storage. Keep offers,
FAQ, What's New, and representative session catalogs as deterministic fixtures. Add no report,
finance, help-content, or assistant aggregate cache.

**Rationale**: The 1,000-item notification and conversation histories need indexed paging and
durable deletion/read state. Operation tables prove exact-once subscription and support outcomes.
Small protected settings do not justify more tables.

**Alternatives considered**: AsyncStorage arrays rewrite entire histories; a generic key-value
table loses operational indexes; many message/offer/help tables persist fixture data with no user
value.

## Decision 5: Use stable event keys and typed notification targets

**Decision**: Deduplicate each notification by a stable source-event key. Persist a discriminated
target such as transaction, review, obligation, budget, goal, report, assistant insight, security
event, or settings recovery. Store only the notification ID in the native payload and resolve the
trusted local target after interaction. Do not add foreign keys from notifications to source
tables.

**Rationale**: Source records may be removed, merged, archived, or inaccessible while notification
history must still explain the event and offer a safe fallback. Typed targets prevent arbitrary
or sensitive URLs.

**Alternatives considered**: Raw hrefs, full financial payloads in the operating-system alert,
and source-table foreign keys were rejected.

## Decision 6: Centralize delivery policy without an event bus

**Decision**: Replace the tracking and voice outcome-only notification helpers with one
notification service called at their existing seams. Seed deterministic events for other
categories until their owning features expose events. Policy resolves device permission,
category preference, global masking, quiet hours, summaries, deduplication, and critical-access
bypass before local presentation.

**Rationale**: Two current helpers already demonstrate the integration points. One service fixes
policy once without touching every finance module or introducing a speculative application-wide
event bus.

**Alternatives considered**: Per-feature policy copies and a generic event broker were rejected.

## Decision 7: Treat quiet hours as profile-timezone calendar rules

**Decision**: Use `Intl.DateTimeFormat` and the stored IANA profile timezone for quiet-hour and
summary boundaries, including ranges that cross midnight. Only a new session, session revocation,
or account-access protection change may bypass quiet hours. Routine security, update,
maintenance, and recovery reminders wait.

**Rationale**: Fixed offsets and device-local assumptions drift during travel and daylight-saving
changes. No date dependency is needed for daily wall-clock comparisons.

**Alternatives considered**: UTC-only quiet hours, fixed offsets, and allowing every security
message to bypass the user's attention choice were rejected.

## Decision 8: Unlock, sanitize, then revalidate notification actions

**Decision**: Register notification response handling at the root, process both the last response
on startup and live response events, sanitize the typed destination, pass protected actions
through the existing app privacy gate, then reload and revalidate the source/action. View, Edit,
and Undo never execute from a locked notification surface.

**Rationale**: A listener alone misses cold-start responses, and an action can expire or be used
while the app is closed. Reusing the normal unlock flow satisfies the approved clarification with
one security boundary.

**Alternatives considered**: Direct deep links, applying Undo before unlock, and trusting stale
native payload data were rejected.

## Decision 9: Persist one immutable snapshot per assistant response

**Decision**: A completed assistant response stores its question, structured answer blocks,
data-as-of time, selected period, safe source references and versions, completeness reasons, and
fact/estimate/suggestion labels. Later record changes do not rewrite it. A new question reads the
latest confirmed context unless the user names an earlier period or snapshot.

**Rationale**: This implements the clarification and makes answers traceable without preserving
full source records, raw SMS, or unrestricted report content.

**Alternatives considered**: Live-recomputing old answers, storing only prose, and storing full
financial objects were rejected.

## Decision 10: Make assistant actions current, explicit, and idempotent

**Decision**: Persist a time-bounded preview with source versions, exact affected values,
destination, editable input, and stable operation ID. On confirmation, re-read source versions;
stale previews return to review. Only then call the canonical owner. Repeated operation IDs return
the original result.

**Rationale**: Preview plus version revalidation prevents hidden, duplicated, or stale financial
changes and reuses the established `MutationResult<T>` convention.

**Alternatives considered**: Executing conversational text, automatic retry of mutations, and
assistant-owned finance writes were rejected.

## Decision 11: Keep commercial catalogs deterministic and lifecycle state durable

**Decision**: Free, Basic, Premium, prices, periods, limits, and trial eligibility come from one
approved fixture catalog. Persist only current subscription state and operations. Purchase,
restore, change, cancel, renewal, and expiry use stable operation IDs; entitlement changes only on
success. Paid-only content remains visible read-only after downgrade or expiry.

**Rationale**: Commercial terms must be consistent across plan, checkout, and limit screens, but
the frontend must not claim a production store or payment result.

**Alternatives considered**: Hard-coded screen-specific offers, a payment SDK, and deleting or
hiding prior content on downgrade were rejected.

## Decision 12: Keep one owner for global masking and profile timezone

**Decision**: Extend the existing protected preference model with profile timezone and approved
device-local application preferences. `usePreferenceStore.hideBalances` remains the sole masking
owner; remove the duplicate value from `PrivacyLockPreference`. Reports and notification policy
consume the profile timezone instead of a hard-coded Riyadh value. Profile identity, sessions,
security events, and privacy/export/deletion request state remain Query-owned through
`SettingsService`.

**Rationale**: The current duplicate hide-balance values can drift, and Reports currently fixes
the timezone to `Asia/Riyadh`. One protected preference owner fixes both at their shared source.

**Alternatives considered**: A second settings Zustand store, duplicated timezone fields, and a
parallel profile/security store were rejected.

## Decision 13: Make local-data deletion allowlisted and transactional

**Decision**: One storage coordinator deletes user-generated SQLite data, notification and
assistant history, report output/schedules, support drafts/history, and transient query/view data
inside the existing exclusive transaction boundary. It preserves the authenticated session,
PIN/biometric/auto-lock controls, locale/theme, and representative remote-shaped profile and
entitlement. Account deletion and export remain explicit request states, not claimed completed
backend operations.

**Rationale**: A central allowlist prevents partial deletion and accidental lockout while clearly
separating local-data deletion from account deletion.

**Alternatives considered**: Clearing all storage blindly, per-screen deletion, and claiming a
remote account deletion from the frontend were rejected.

## Decision 14: Preserve support drafts and allowlist contextual reports

**Decision**: One support form handles ticket, feedback, incorrect-transaction report, and
assistant-response report through a typed mode. Drafts persist independently from submitted
tickets. Submission and reply operations are idempotent. Context defaults off and is limited to
the referenced item ID, safe type/status/category, app version, and user-approved diagnostic
category; unrelated amounts, account identifiers, raw SMS, conversation history, secrets, and
free text never enter analytics.

**Rationale**: One form avoids duplicate validation and recovery while structural allowlisting is
safer than redacting an unrestricted object.

**Alternatives considered**: Attachments, full-object serialization, a support SDK, and separate
forms for each report type were rejected.

## Decision 15: Keep Query ownership and repair cross-feature invalidation

**Decision**: TanStack Query owns notification pages/preferences, conversations/responses,
subscription state/operations, profile/sessions/security events, and support state. Component
state owns only current filters and draft input; no new Zustand store is added. Finance/planning
mutations add `reports.live` and `assistant.context` affected scopes, and the existing invalidators
refresh those cross-feature keys. Profile-timezone changes invalidate live reports, assistant
context, and notification schedule projections but never immutable snapshots or completed
operations.

**Rationale**: Queries have infinite stale time in the current provider, so explicit invalidation
is required. This also closes the existing gap where report scopes are defined but not emitted by
finance/planning writes.

**Alternatives considered**: Global cache clearing, duplicated entities in Zustand, and rewriting
historical snapshots were rejected.

## Decision 16: Reuse the design system and prove dense native behavior selectively

**Decision**: Reuse `FlatList`, `StateView`, `StatusBadge`, `NotificationBadge`, `SensitiveValue`,
`ConfirmationDialog`, `ActionButton`, `MenuLink`, forms, semantic tokens, formatters, and privacy
helpers. Use structured answer blocks; add no Markdown renderer. Automated proof covers policy,
snapshots, stale previews, lifecycle transitions, drafts, idempotency, privacy, routes, and
invalidation. One deterministic fixture covers 1,000 notifications plus 1,000 assistant items.
Native development-build checks cover permission, cold/live response, quick actions, unlock,
layout, and TalkBack/VoiceOver.

**Rationale**: Pure and component tests prove deterministic rules quickly; device checks are
reserved for behavior the operating system owns.

**Alternatives considered**: A new UI kit, custom virtualized list, Markdown package,
snapshot-only tests, and device-only validation were rejected.

## Resolved Unknowns

- No planning unknown remains unresolved.
- Android and iOS use the same domain and service behavior; only the native notification adapter
  varies by platform capability and permission.
- Remote push, production AI, production payments, production support, background delivery,
  actual export, and backend account deletion remain outside the frontend phase.
- iOS/VoiceOver native evidence is recorded as blocked on Windows unless macOS/Xcode evidence is
  supplied; it is never marked passed from a simulator-free environment.
