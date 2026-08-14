# Data Model: Notifications, Smart Financial Assistant, Subscriptions, and Support

## Ownership and Shared Rules

- Core Finance remains the owner of accounts, transactions, categories, corrections, review,
  sync state, and balances.
- Financial Planning remains the owner of salary, budgets, obligations, payments, savings goals,
  and movements.
- Reports remains the owner of report calculations, periods, breakdowns, and immutable report
  output snapshots.
- App Shell remains the owner of authentication, PIN, biometrics, auto-lock, and the current
  protected-route gate.
- Protected preferences remain the owner of locale, direction, theme, hidden balances, currency,
  timezone, reduced motion, and device-local application defaults.
- SPEC-009 owns notification history/preferences, assistant consent/conversations/snapshots/action
  previews, subscription presentation state, profile/privacy request presentation, security-event
  presentation, and support drafts/tickets.
- TanStack Query owns service-shaped entities. Component state owns only current filters and form
  input. No SPEC-009 entity is duplicated in Zustand.
- Money references reuse safe integer minor units and ISO currency codes. Stored dates are either
  timestamps or explicit `YYYY-MM-DD` local dates plus an IANA timezone.
- Every mutable persisted entity has a version or stable operation ID where concurrent or repeated
  action matters. Raw provider errors and secrets are never entity fields.
- User-visible labels and structured content resolve from equivalent Arabic RTL and English LTR
  catalogs; persisted entities store keys and safe values rather than rendered language. Models
  must remain understandable with screen readers and at 200% text without changing their meaning.

## Shared Value Objects

### Page<T>

| Field | Rules |
|---|---|
| `items` | Stable ordered page; no duplicate IDs |
| `nextCursor` | Opaque cursor or null |
| `total` | Total eligible items for current filter |

### DataState

`complete | empty | partial | stale | offline | sync_pending | sync_failed`

This is separate from request loading/error state and from each entity's lifecycle.

### OperationResult<T>

| Field | Rules |
|---|---|
| `value` | Trusted result after successful representative operation |
| `affectedScopes` | Query scopes requiring invalidation |
| `operationId` | Stable unique ID; replay returns the original result |

### SafeFailureCategory

`validation | permission | unavailable | offline | conflict | expired | limit_reached |
cancelled | representative_failure`

No stack trace, provider response, credential, financial content, or user-authored text appears in
a failure category.

## Entity: NotificationEvent

A durable in-app record that may also have one local phone presentation.

| Field | Rules |
|---|---|
| `id` | Stable local ID |
| `eventKey` | Stable unique source-event key used for deduplication |
| `category` | `transaction`, `income`, `obligation`, `budget`, `salary`, `savings`, `report`, `assistant`, `security`, or `system` |
| `eventType` | Approved event subtype within the category |
| `titleKey` / `bodyKey` | Localization keys, never persisted rendered prose |
| `messageValues` | Safe scalar interpolation values; protected values separately marked |
| `sensitivity` | `public`, `protected`, or `security_sensitive` |
| `target` | One typed NotificationTarget or null |
| `availableActions` | `view`, `edit`, and/or `undo` with expiry and source version where applicable |
| `occurredAt` | Source-event time |
| `readAt` | Null until read |
| `deletedAt` | Tombstone time while deletion sync is pending; deletion never mutates target data |
| `phoneStatus` | `not_requested`, `deferred`, `summarized`, `presented_local`, `suppressed_preference`, `suppressed_private`, `permission_denied`, `failed_mock` |
| `syncStatus` | `synced`, `pending`, or `failed` |
| `safeFailure` | SafeFailureCategory or null |

### NotificationTarget

A discriminated union with only safe IDs:

- `transaction`: transaction ID.
- `review`: review ID.
- `obligation`: obligation ID.
- `budget`: budget ID.
- `salary`: salary-cycle key.
- `goal`: savings-goal ID.
- `report`: period kind and anchor date, not report content.
- `assistant`: conversation/response ID.
- `security`: security-event ID.
- `settings`: approved settings destination key.

No arbitrary URL, query string, amount, account ID, note, source text, or assistant prose is part
of the native notification payload. The payload contains only `NotificationEvent.id`.

### Lifecycle

```text
created -> unread -> read
created/unread/read -> delete_pending -> deleted
phone: policy_evaluation -> deferred | summarized | presented_local | suppressed | failed
action: available -> unlock_required -> revalidating -> executed | expired | unavailable
```

- Repeated `eventKey` returns the existing event.
- Delete affects the notification only.
- Expired or missing targets retain the event and resolve to an actionable fallback.

## Entity: NotificationPreferences

One versioned preference record exists.

| Field | Rules |
|---|---|
| `version` | Increments on save |
| `phoneEnabled` | User preference, distinct from operating-system permission |
| `categoryEnabled` | Boolean per approved phone-delivery category |
| `quietHours` | Enabled flag, start/end local wall-clock time, active weekdays, IANA timezone |
| `dailySummary` / `weeklySummary` | Enabled plus chosen local delivery time/day |
| `hideAmountsOnLockScreen` | Defaults true |
| `permissionState` | Last observed `not_requested`, `granted`, `denied`, `permanently_denied`, or `unavailable` |
| `updatedAt` | Save time |

The global hidden-balance preference always overrides lock-screen display. Only critical access
events may bypass quiet hours. In-app creation never depends on phone-delivery preference.

## Entity: AssistantConsent

| Field | Rules |
|---|---|
| `status` | `not_requested`, `enabled`, or `disabled` |
| `disclosedDataCategories` | Exact approved categories shown at consent |
| `consentedAt` / `disabledAt` | Present for the applicable state |
| `version` | Increments on change |

Disabling personalization stops new personalized responses and action previews. It does not
delete conversations automatically or block non-assistant product areas.

## Entity: AssistantConversation

| Field | Rules |
|---|---|
| `id` | Stable ID |
| `title` | User-visible name with bounded length |
| `status` | `active` or `deleted` |
| `createdAt` / `updatedAt` | History ordering |
| `lastResponseId` | Latest completed response, if any |
| `version` | Required for rename/delete conflict checks |

Deleting a conversation removes its responses and unused previews after explicit confirmation; it
never deletes financial source records.

## Entity: AssistantResponse

One persisted question and its deterministic structured answer.

| Field | Rules |
|---|---|
| `id` / `conversationId` | Stable relationship |
| `question` | User-authored question; excluded from analytics/logging |
| `responseType` | `direct`, `comparison`, `explanation`, `saving_suggestion`, `plan`, `obligation_analysis`, `insufficient_data`, or `safe_redirect` |
| `blocks` | Structured localized response blocks; no Markdown/HTML |
| `labels` | Per block: `fact`, `estimate`, or `suggestion` |
| `period` / `dataAsOf` | Exact context time/range |
| `snapshot` | One AssistantContextSnapshot |
| `limitations` | Safe completeness reasons |
| `proposedActionIds` | Optional previews created from this response |
| `feedback` | `helpful`, `not_helpful`, `reported`, or null |
| `createdAt` | Immutable completion time |

### AssistantContextSnapshot

- Safe source references and source versions only.
- Displayed values required to reproduce the answer, with money in minor units and currency.
- Confirmed/review/conflict completeness counts and safe reasons.
- Report snapshot reference when a report-owned answer is used.
- No raw SMS, transaction notes, account identifiers, full source objects, or unrestricted report
  content.

The snapshot is immutable. New questions build a new snapshot from current confirmed data.

## Entity: AssistantActionPreview

| Field | Rules |
|---|---|
| `id` / `responseId` | Stable relationship |
| `kind` | `create_budget`, `adjust_budget`, `create_goal`, `add_reminder`, `open_transactions`, `show_subscriptions`, `link_transaction`, `review_obligation`, or `create_plan` |
| `input` | Exact editable proposed values |
| `affectedDestination` | Typed owning route/entity |
| `sourceVersions` | Versions required at confirmation |
| `status` | `draft`, `ready`, `confirming`, `succeeded`, `failed`, `cancelled`, `stale`, or `expired` |
| `operationId` | Stable unique ID after confirmation starts |
| `expiresAt` | Required for data-changing previews |
| `resultReference` | Owning entity/result ID only after success |
| `safeFailure` | SafeFailureCategory or null |

### Lifecycle

```text
draft -> ready -> confirming -> succeeded
ready -> cancelled
ready/confirming -> stale | expired | failed
failed/stale -> ready only after explicit review and new source versions
```

No ordinary assistant message can skip `ready` and confirmation. Repeated operation IDs cannot
apply the owning mutation twice.

## Entity: SubscriptionOffer

Deterministic fixture data; not persisted.

| Field | Rules |
|---|---|
| `offerId` | Stable catalog ID |
| `plan` | `free`, `basic`, or `premium` |
| `billingPeriod` | `none`, `monthly`, or `annual` |
| `price` | Display money or zero for Free |
| `features` / `limits` | Approved catalog entries only |
| `trial` | Eligibility, duration, trial price, post-trial price, renewal/cancellation terms |
| `effectiveAt` | Catalog version time |

Screens consume one catalog version so comparison and checkout cannot disagree.

## Entity: SubscriptionState

One versioned singleton.

| Field | Rules |
|---|---|
| `plan` | `free`, `basic`, or `premium` |
| `status` | `free`, `trialing`, `active`, `cancellation_scheduled`, `expired`, or `representative_payment_failed` |
| `offerId` / `catalogVersion` | Offer used by current state |
| `startedAt` / `trialEndsAt` / `renewsAt` / `accessEndsAt` | Present as applicable |
| `limits` | Current approved usage limits and counters |
| `version` | Required for change/cancel/restore |
| `paidContentAccess` | `editable` or `read_only` |

Downgrade/expiry changes paid-only content to read-only and never deletes it. Core financial data
keeps the lifecycle of its owning feature.

## Entity: SubscriptionOperation

| Field | Rules |
|---|---|
| `id` / `operationId` | Stable; operationId unique |
| `kind` | `start_trial`, `purchase`, `restore`, `change_plan`, `cancel`, or `renew_mock` |
| `offerId` | Reviewed offer/catalog version |
| `priorStateVersion` | Conflict guard |
| `status` | `review`, `pending`, `succeeded`, `failed`, or `cancelled` |
| `requestedAt` / `completedAt` | Lifecycle evidence |
| `safeFailure` | SafeFailureCategory or null |
| `resultStateVersion` | Present only on success |

Only `succeeded` changes SubscriptionState. Replay returns the existing operation.

## Entity: UserProfile

Protected settings-service data, not a SQLite table.

| Field | Rules |
|---|---|
| `name` | Optional bounded display name |
| `avatar` | Placeholder selection only in Core V1 |
| `phone` / `googleAccount` | Read from representative authentication identity; edits redirect to owning auth flow |
| `email` | Validated profile/report contact value |
| `country` / `currency` / `timeZone` | Approved country, ISO currency, valid IANA timezone |
| `completion` | Derived completion steps |
| `version` | Conflict guard for save |

## Entity: ApplicationPreferences

Extends the existing protected preference record.

- Locale/direction, theme, hidden balances, reduced motion, and base currency.
- IANA profile timezone and first day of week.
- Default account ID and safe transaction defaults.
- Dashboard section visibility/order from an approved list.
- Voice preference and links to tracking/report/notification owners.

`hideBalances` has one owner here. It is removed from PrivacyLockPreference and cannot drift.

## Entity: RepresentativeSession and SecurityEvent

Sessions and events are deterministic SettingsService results in this phase.

### RepresentativeSession

- Session ID, safe device label, platform, created/last-active times, current-device flag, and
  `active | revoking | revoked` status.
- No token, IP address, credential, or precise location.

### SecurityEvent

- Stable ID, type, safe device/platform context, occurred time, status, and recovery destination.
- Critical-access types are new session, session revocation, and access-protection change.

Revocation uses an operation ID. The current session clears only after successful representative
revocation/sign-out.

## Entity: PrivacyRequest

| Field | Rules |
|---|---|
| `id` / `operationId` | Stable request identity |
| `kind` | `data_export` or `account_deletion` |
| `status` | `review`, `pending`, `accepted`, `failed`, or `cancelled` |
| `requestedAt` / `updatedAt` | Request evidence |
| `safeFailure` | SafeFailureCategory or null |

`accepted` means the representative request was accepted, not that a file exists or the account
was deleted.

## Entity: SupportArticle

Deterministic localized fixture with ID, kind (`faq`, `help`, or `whats_new`), title/body keys,
search terms, category, version, and published date. User content is not persisted in this catalog.

## Entity: SupportDraft

| Field | Rules |
|---|---|
| `id` | Stable draft ID |
| `mode` | `ticket`, `reply`, `feedback`, `transaction_report`, or `assistant_report` |
| `category` / `subject` / `description` | Validated user input |
| `ticketId` | Required for reply |
| `context` | Optional SupportContext allowlist |
| `status` | `draft`, `validating`, or `failed` |
| `updatedAt` | Recovery ordering |

### SupportContext

Defaults absent. When approved by the user it may contain only referenced item ID, item kind,
safe category/status, app version, and diagnostic category. It excludes unrelated amounts,
account identifiers, raw SMS, notes, conversation history, credentials, and secrets.

## Entity: SupportTicket

| Field | Rules |
|---|---|
| `id` / `reference` | Stable representative ticket identity |
| `category` / `subject` / `description` | Submitted values |
| `context` | Reviewed SupportContext or null |
| `status` | `submitted`, `open`, `waiting_user`, `resolved`, or `closed` |
| `messages` | Ordered user/support messages with author role and time; no attachments |
| `createdAt` / `updatedAt` | History ordering |
| `rating` | Available only after resolved/closed |
| `version` | Reply/rating conflict guard |

## Entity: SupportOperation

| Field | Rules |
|---|---|
| `id` / `operationId` | Stable; operationId unique |
| `kind` | `submit_ticket`, `reply`, `feedback`, `report_transaction`, `report_assistant`, or `rate` |
| `draftId` / `ticketId` | Relevant relationship |
| `status` | `pending`, `submitted`, `failed`, or `cancelled` |
| `safeFailure` | SafeFailureCategory or null |
| `requestedAt` / `completedAt` | Lifecycle evidence |

Only `submitted` creates or changes visible ticket/report state. Replay cannot duplicate it.

## SQLite v7 Mapping

| Table | Indexed columns | Payload |
|---|---|---|
| `notifications` | unique `event_key`; `category`, `read_at`, `deleted_at`, `sync_status`, `occurred_at` | NotificationEvent |
| `notification_preferences` | singleton `id`; `updated_at` | NotificationPreferences |
| `assistant_consent` | singleton `id`; `status`, `updated_at` | AssistantConsent |
| `assistant_conversations` | `status`, `updated_at` | AssistantConversation |
| `assistant_responses` | `conversation_id`, `created_at` | AssistantResponse with snapshot |
| `assistant_action_previews` | unique nullable `operation_id`; `response_id`, `status`, `expires_at` | AssistantActionPreview |
| `subscription_state` | singleton `id`; `status`, `updated_at` | SubscriptionState |
| `subscription_operations` | unique `operation_id`; `kind`, `status`, `requested_at` | SubscriptionOperation |
| `support_tickets` | `status`, `updated_at` | SupportTicket |
| `support_drafts` | `mode`, `status`, `updated_at` | SupportDraft |
| `support_operations` | unique `operation_id`; `kind`, `status`, `requested_at` | SupportOperation |

The existing migration model executes idempotent table/index creation on open and records schema
version 7. No existing column is removed or altered in place.

## Local-Data Deletion Invariant

One confirmed operation clears all user-generated rows from offline finance, finance, tracking,
voice preferences, planning, reports, and SPEC-009 tables inside an exclusive transaction, then
clears affected Query caches and transient drafts/view state. It preserves:

- Current authenticated session and authentication method.
- PIN credential, biometric choice, auto-lock, and app privacy gate.
- Locale, theme, timezone, reduced motion, and hidden-balance preference.
- Representative profile and current subscription entitlement.

Failure rolls back the database transaction and reports no success. Account-deletion request is a
separate representative backend request and never calls this coordinator implicitly.

## Scale and Retention for Frontend Validation

- Validate paging and virtualization with 1,000 NotificationEvent rows and 1,000 responses across
  conversations.
- Keep deterministic fixture subscription/support/session histories bounded; production retention
  is not promised.
- First useful notification or conversation content appears within two seconds on supported
  devices, with fewer than 100 mounted list rows in the performance fixture.
