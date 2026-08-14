# Data Model: Automatic Transaction Capture and Platform-Specific Tracking

All timestamps are epoch milliseconds. Financial amounts use integer minor units and ISO currency
codes. Existing `Account`, `Category`, `Transaction`, `PermissionState`, `TrackingPreference`, and
`KeywordRule` remain authoritative and are referenced rather than copied.

## 1. Tracking Status Snapshot

Represents the current user-facing tracking condition assembled from existing preferences,
permission, platform capabilities, and persisted tracking activity.

| Field | Meaning |
|---|---|
| `platform` | `android`, `ios`, or conservative fallback |
| `mode` | Existing `automatic_clear`, `review_all`, or `paused` preference |
| `permissionStatus` | Existing SMS permission status; Android only |
| `serviceState` | `healthy`, `interrupted`, `battery_restricted`, `offline`, or `unavailable` |
| `lastDetectedAt` | Latest eligible or ignored detection time, if any |
| `lastSuccessfulTransactionId` | Latest automatically posted transaction, if any |
| `detectedThisMonth` | Count for the user's local calendar month |
| `reviewCount` | Pending review count |
| `activeKeywordCount` | Enabled keyword count |
| `activeSenderCount` | Enabled sender count |
| `lastUpdatedAt` | Last successful status refresh |

Validation: iOS and conservative snapshots cannot carry an SMS permission or Android service
claim. A paused mode cannot report active automatic processing.

## 2. Detected Financial Event

Represents one mock financial-message candidate and its complete decision history.

| Field | Meaning |
|---|---|
| `id` | Stable local identifier |
| `sourceFingerprint` | Stable idempotency key; unique across retained tracking history |
| `sourceKind` | `sms_mock` or supported `platform_assisted_mock` |
| `eventType` | Purchase, withdrawal, deposit, salary, incoming/outgoing transfer, refund, reversal, fee, subscription, installment, failed, or pending/held |
| `decisionStatus` | `received`, `analyzing`, `auto_added`, `review_required`, `ignored`, `rejected`, `resolved`, or `failed` |
| `confidenceBasisPoints` | Integer 0 through 10,000 |
| `amountMinor` | Extracted amount when available |
| `currencyCode` | Extracted valid currency when available |
| `merchant` | Extracted merchant or provider, if any |
| `categoryId` | Suggested or confirmed existing category |
| `accountHint` | Non-authoritative account clue, if any |
| `accountId` | Confirmed existing account, if any |
| `paymentMethod` | Extracted payment method, if any |
| `occurredAt` | Extracted event time, if known |
| `sourceText` | Optional full local source text subject to masking and expiry |
| `sourceTextExpiresAt` | Required when source text is retained; no later than detection plus 30 days |
| `reasonCodes` | Stable non-sensitive reasons for decision or review |
| `priorEventId` | Original pending event for completion, reversal, refund, or failure follow-up |
| `transactionId` | Existing finance transaction created or linked after resolution |
| `obligationMatchId` | Suggested or confirmed obligation match, if any |
| `createdAt`, `updatedAt` | Audit timestamps |

Validation: the fingerprint is unique; confidence is bounded; source text requires an expiry;
`auto_added` requires a transaction; `review_required` requires an active review item; ignored or
rejected events cannot have created financial effects.

## 3. Review Item

Represents an unresolved decision and the exact values presented for confirmation.

| Field | Meaning |
|---|---|
| `id` | Stable local identifier |
| `detectedEventId` | One-to-one source event |
| `status` | `pending`, `resolving`, `resolved`, `ignored`, or `failed` |
| `reasonCodes` | Amount, status, merchant, category, reversal, duplicate, obligation, account, or rule ambiguity |
| `missingFields` | Required decisions still missing |
| `proposedValues` | Editable candidate financial fields |
| `selectedDuplicateResolution` | Optional duplicate choice |
| `selectedObligationId` | Optional confirmed obligation link |
| `resolutionErrorCode` | Safe recoverable error, if any |
| `createdAt`, `resolvedAt`, `updatedAt` | Lifecycle timestamps |

Validation: dismissal leaves the item pending; resolution validates all required financial fields;
only a resolved confirmation may create or alter a transaction.

## 4. Duplicate Candidate

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `detectedEventId` | New candidate |
| `existingTransactionId` | Existing canonical transaction |
| `probabilityBasisPoints` | Bounded duplicate likelihood |
| `reasonCodes` | Amount, time, merchant, account, source, or reference match reasons |
| `resolution` | `keep_existing`, `keep_new`, `keep_both`, `merge_details`, or null |
| `status` | `pending`, `resolved`, or `failed` |
| `resolvedAt` | Completion time, if resolved |

Merge validation: keep the existing transaction identity; add only confirmed missing metadata;
amount, currency, date, and account require a separate edit confirmation.

## 5. Keyword Rule Extension

The existing keyword rule remains authoritative. Tracking reads derive these extra values:

| Field | Meaning |
|---|---|
| `recentUseCount` | Number of recent detections that referenced the rule |
| `lastUsedAt` | Most recent matching event, if any |

Validation: normalized `(language, value)` is unique; custom empty values are rejected; disabling
the last enabled rule in a group requires deliberate confirmation; restoring defaults preserves
unrelated custom rules.

## 6. Sender Rule

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `normalizedSender` | Unique normalized sender identity |
| `displayLabel` | User-visible label |
| `institutionKey` | Optional bank/provider association |
| `origin` | `recognized` or `custom` |
| `enabled` | Whether it contributes to matching |
| `trusted` | User-controlled confidence signal, never a safeguard bypass |
| `recentUseCount` | Derived recent match count |
| `lastUsedAt` | Latest related detection |
| `createdAt`, `updatedAt` | Audit timestamps |

Validation: a sender identity is unique after normalization; only custom senders may be removed;
trusted senders still pass failure, duplicate, ambiguity, and review safeguards.

## 7. Obligation Match Projection

Represents the SPEC-005 suggestion and confirmed mock effect until SPEC-007 supplies the full
obligation owner.

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `detectedEventId` | Source event |
| `candidateObligationIds` | Zero, one, or several mock obligation candidates |
| `signalCodes` | Provider, amount, due date, account, masked digits, reference, installment position |
| `status` | `none`, `suggested`, `ambiguous`, `confirmed`, or `rejected` |
| `confirmedObligationId` | One confirmed candidate, if any |
| `effectPreview` | Paid, remaining, installment count, and next due date before/after values |
| `appliedAt` | Time the confirmed mock effect was applied |

Validation: multiple candidates require review; only one confirmed match may apply; transaction
and obligation projection effects commit together or neither changes.

## 8. Tracking History Entry

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `detectedEventId` | Related event |
| `action` | Detected, auto-added, sent-to-review, ignored, rejected, merged, linked, undone, source-purged, or reported-wrong |
| `reasonCodes` | Non-sensitive explanation codes |
| `occurredAt` | Audit time |

History never stores a second transaction or full source-text copy. Clearing history removes
tracking-only history and source text but preserves posted finance transactions.

## 9. Automatic Action Feedback

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `detectedEventId` | Source event |
| `transactionId` | Resulting transaction |
| `kind` | Transaction added, obligation payment recorded, or automatic action undone |
| `undoExpiresAt` | Exactly 30 seconds after successful automatic addition |
| `notificationOutcome` | `delivered_mock`, `suppressed_private`, `disabled`, or `failed_mock` |
| `status` | `active`, `undone`, or `expired` |
| `createdAt`, `updatedAt` | Lifecycle timestamps |

Validation: only active feedback before its deadline may undo; expiry never removes edit or detail
access; app restart or backgrounding does not extend the deadline.

## Relationships

- One detected event has zero or one review item and zero or more duplicate candidates.
- One detected event creates or links at most one canonical finance transaction.
- A detected event may link to one prior event; one prior event may have several follow-ups.
- One event has zero or one obligation-match projection.
- Keyword and sender use counts derive from event relationships and are not independent totals.
- History and feedback reference events and transactions without duplicating financial values.

## State Transitions

```text
received -> analyzing
analyzing -> auto_added | review_required | ignored | rejected | failed
review_required -> resolving -> resolved | ignored | failed
failed -> resolving
auto_added -> resolved (edit/link) | resolved (undo)

duplicate pending -> resolved | failed
obligation suggested -> confirmed | ambiguous | rejected
feedback active -> undone | expired
service healthy <-> interrupted | battery_restricted | offline
mode automatic_clear | review_all <-> paused
```

Invalid transitions fail with a safe error and leave the last durable state unchanged.

## Storage and Retention

- Schema version 3 adds tracking tables and indexes without rewriting existing finance records.
- Source fingerprints are unique and make processing idempotent.
- Full source text is app-local, masked where required, purgeable immediately, and deleted no
  later than `sourceTextExpiresAt`.
- Extracted financial fields and non-sensitive reason codes may remain with the event and linked
  finance transaction after source-text purge.
- Posted transactions survive tracking-history clearing; ignored and review history may be
  cleared after explicit confirmation.
