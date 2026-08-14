# Data Model: Daily Money Control

## Modeling Rules

- All identifiers are opaque strings generated locally until a future adapter supplies remote identifiers.
- Monetary values use integer minor units and an ISO 4217 currency code. Values MUST remain within JavaScript's safe-integer range.
- Timestamps are UTC epoch milliseconds; display uses locale-aware formatters and the user's timezone.
- User-visible labels are localization keys or bilingual user content, never hard-coded feature strings.
- Raw SMS text and voice audio/transcripts are sensitive evidence, not ordinary transaction metadata.
- Database writes that affect more than one financial entity are atomic.

## MoneyValue

Represents an exact amount in its original currency.

| Field | Type | Rules |
|---|---|---|
| `minorUnits` | integer | Safe integer; sign is interpreted with transaction type, not alone |
| `currencyCode` | string | Three uppercase ISO characters |
| `scale` | integer | Currency minor-unit scale, normally 0–3 |

### EstimatedMoneyValue

Adds `reportingMinorUnits`, `reportingCurrencyCode`, `conversionAsOf`, and `isEstimated=true` while preserving the original `MoneyValue`. Estimated values MUST never replace originals.

## Account

Represents a financial source or destination.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `name` | string | Required; trimmed; duplicates allowed with identifiers visible |
| `type` | enum | `bank`, `debit_card`, `credit_card`, `digital_wallet`, `cash`, `savings`, `other` |
| `currencyCode` | string | Required ISO code |
| `openingBalance` | MoneyValue | Same currency as account |
| `currentBalance` | MoneyValue | Derived or adjusted through a financial change |
| `availableCredit` | MoneyValue or null | Credit accounts only |
| `creditLimit` | MoneyValue or null | Credit accounts only |
| `institutionName` | string or null | Optional user-visible name |
| `lastFour` | string or null | Exactly four English digits when present |
| `isDefault` | boolean | At most one active default per applicable scope |
| `status` | enum | `active`, `archived` |
| `iconKey` / `colorKey` | string or null | Semantic named values; never sole identity |
| `notes` | string or null | User content; length-limited |
| `createdAt` / `updatedAt` | timestamp | Required |

### Account transitions

```text
active -> archived
archived -> active
```

An archived account cannot be selected for a new transaction but remains readable for history and existing relationships.

## Category

Represents a system or custom transaction classification.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `kind` | enum | `system`, `custom` |
| `parentId` | string or null | Cannot reference self or create a cycle |
| `labelAr` / `labelEn` | string | Both required for custom categories |
| `financialUse` | enum set | Supported transaction meanings |
| `iconKey` / `colorKey` | string | Named accessible choices |
| `isFavorite` | boolean | Optional shortcut state |
| `status` | enum | `active`, `archived`, `merged` |
| `mergedIntoId` | string or null | Required only when merged |
| `createdAt` / `updatedAt` | timestamp | Required |

### Category transitions

```text
active <-> archived
active|archived -> merged
merged -> terminal
```

Merge reassigns current references atomically while retaining the old category identity for historical explanation.

## Transaction

Represents one ledger event. Sign, type, status, and relationships jointly define its meaning.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `type` | enum | `expense`, `income`, `transfer`, `refund`, `reversal`, `adjustment`, `fee`, `obligation_payment`, `recurring_payment` |
| `amount` | MoneyValue | Positive magnitude; zero rejected except explicit zero-value adjustment fixtures |
| `accountId` | string | Required active or historical account reference |
| `destinationAccountId` | string or null | Required for transfer; different from source |
| `categoryId` | string or null | Required except transfer; active at creation |
| `merchant` / `title` | string or null | At least one display title resolved through content rules |
| `paymentMethod` | enum or null | `cash`, `card`, `transfer`, `wallet`, `apple_pay`, `google_pay`, `other` |
| `occurredAt` | timestamp | Required; future values require explicit supported context |
| `source` | enum | `manual`, `automatic_sms`, `voice`, `ios_shortcut`, `adjustment` |
| `status` | enum | `active`, `pending`, `failed`, `reversed`, `refunded`, `deleted` |
| `reviewStatus` | enum | `none`, `required`, `resolved` |
| `syncStatus` | enum | `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `sourceReference` | string or null | Opaque idempotency reference; no raw SMS/audio content |
| `originalTransactionId` | string or null | Required for linked refund/reversal |
| `obligationId` | string or null | Companion-spec relationship |
| `transferGroupId` | string or null | Links both balance effects of one transfer |
| `notes` | string or null | User content; length-limited |
| `version` | positive integer | Incremented on correction for conflict detection |
| `createdAt` / `updatedAt` | timestamp | Required |

### Transaction lifecycle

```text
pending -> active | failed | deleted
active -> refunded | reversed | deleted
failed -> active | deleted
refunded -> terminal except correction
reversed -> terminal except correction
deleted -> terminal in normal UI
```

Sync state follows the existing offline transition model:

```text
pending -> syncing -> synced
                  -> failed -> pending
                  -> conflict -> pending after resolution
```

### Balance effects

- Expense, fee, and obligation payment reduce the source account.
- Income and refund increase the destination account but retain distinct reporting meaning.
- Transfer reduces the source and increases the destination without affecting income or expense totals; fee is separate.
- Reversal offsets the related transaction and does not become salary/income.
- Undo applies the inverse of the full atomic change and records `undone` in the associated financial change.

## TransactionDraft

Durable user input before final save.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `transactionType` | enum or null | Determines applicable fields |
| `amountText` | string | User-entered display value; parsed only on validation |
| `accountId`, `destinationAccountId`, `categoryId` | string or null | Optional until validation |
| `merchant`, `notes` | string or null | Preserved user input |
| `occurredAt` | timestamp or null | Optional until validation |
| `validationIssues` | issue list | Localization key plus field id |
| `status` | enum | `editing`, `valid`, `saving`, `saved`, `discarded` |
| `updatedAt` | timestamp | Required |

```text
editing -> valid -> saving -> saved
editing|valid|saving -> editing on validation or recoverable failure
editing|valid -> discarded after explicit confirmation
```

## DetectedItem

Sensitive capture candidate before ledger application.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `source` | enum | `sms`, `ios_shortcut`, `mock` |
| `sourceReference` | string | Unique idempotency key; hashed/opaque where appropriate |
| `evidencePreview` | string or null | Redacted and visible only in authorized review/detail |
| `proposedFields` | partial transaction | Never treated as a ledger transaction by itself |
| `confidence` | integer | 0–100 |
| `reasons` | localization-key list | Explains ambiguity or rejection |
| `duplicateTransactionIds` | string list | Candidate existing records |
| `status` | enum | `received`, `analyzing`, `clear`, `review_required`, `rejected`, `failed`, `applied`, `ignored` |
| `createdAt` / `updatedAt` | timestamp | Required |

```text
received -> analyzing
analyzing -> clear | review_required | rejected | failed
clear -> applied | review_required
review_required -> applied | ignored | rejected
failed -> analyzing | ignored
applied|ignored|rejected -> terminal except correction of linked transaction
```

Reprocessing the same `sourceReference` returns the existing result and MUST NOT create a second transaction.

## ReviewItem

Represents a pending user decision for a detection or duplicate.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `detectedItemId` | string | Required |
| `reasonCodes` | enum list | `multiple_amounts`, `unknown_merchant`, `low_category`, `reversal_possible`, `duplicate_possible`, `account_ambiguous`, `obligation_ambiguous`, `rule_conflict` |
| `candidateAccountIds` / `candidateCategoryIds` / `candidateObligationIds` | string lists | Optional choices |
| `candidateTransactionIds` | string list | Duplicate candidates |
| `resolution` | enum or null | `confirm`, `edit_confirm`, `keep_existing`, `keep_new`, `keep_both`, `merge`, `ignore`, `report_wrong` |
| `status` | enum | `pending`, `resolving`, `resolved`, `failed` |
| `resolvedAt` | timestamp or null | Set only when resolved |

```text
pending -> resolving -> resolved
                    -> failed -> pending
```

## VoiceCaptureSession

Represents microphone and analysis lifecycle. Audio is ephemeral and not a ledger entity.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `permissionStatus` | permission enum | Uses shared permission vocabulary |
| `status` | enum | `idle`, `requesting_permission`, `ready`, `recording`, `processing`, `review`, `confirmed`, `cancelled`, `failed` |
| `durationMs` | integer | Non-negative and bounded by configured maximum |
| `audioCacheUri` | string or null | Never logged; deleted on terminal paths |
| `transcript` | string or null | Sensitive; required before review |
| `failureReasonKey` | string or null | Localized safe reason |
| `createdAt` / `updatedAt` | timestamp | Required |

```text
idle -> requesting_permission -> ready -> recording -> processing -> review -> confirmed
requesting_permission|ready|recording|processing|review -> cancelled
recording|processing -> failed -> ready
review -> recording (re-record)
```

## VoiceProposal

One structured transaction candidate produced by a `VoiceCaptureSession`.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `sessionId` | string | Required |
| `position` | integer | Stable order within transcript |
| `proposedFields` | partial transaction | Editable before confirmation |
| `confidenceByField` | field-to-score map | 0–100 |
| `missingRequiredFields` | field list | Blocks confirmation for that proposal |
| `selected` | boolean | Allows confirm-selected behavior |
| `status` | enum | `proposed`, `edited`, `removed`, `confirmed` |

Only selected proposals with no missing required fields may transition to `confirmed`, and the user must perform the confirmation action.

## TrackingStatus

Aggregates operational state without duplicating the platform permission owner.

| Field | Type | Rules |
|---|---|---|
| `platform` | enum | `android`, `ios` |
| `permissionStatus` | shared permission enum | Android only; `unavailable` on iOS |
| `serviceStatus` | enum | `disabled`, `enabled`, `paused`, `interrupted`, `battery_restricted`, `unavailable` |
| `lastDetectedAt` | timestamp or null | No raw message content |
| `lastAppliedTransactionId` | string or null | Optional |
| `reviewCount` | non-negative integer | Derived |
| `activeKeywordCount` / `activeSenderCount` | non-negative integer | Derived |
| `lastSyncStatus` | sync enum | Operational status |

## HomeSummary

A derived read model, never an independent financial owner.

| Field | Type | Rules |
|---|---|---|
| `totalBalance` | MoneyValue or EstimatedMoneyValue | Derived from active accounts |
| `periodIncome` / `periodExpense` | MoneyValue or estimate | Derived from transaction semantics |
| `salaryCyclePreview` | companion summary or null | Read-only link to companion spec |
| `reviewCount` | integer | Derived from pending review items |
| `recentTransactions` | transaction references | Bounded list |
| `trackingState` | TrackingStatus summary | Platform-aware |
| `budgetPreview`, `obligationPreview`, `goalPreview`, `insightPreview` | companion summaries or null | Contextual, not locally duplicated |
| `dataState` | enum | `loading`, `ready`, `empty`, `partial`, `error`, `offline`, `stale` |

## Relationships

```text
Account 1 ---- * Transaction
Category 1 --- * Transaction
Transaction 0..1 ---- * Refund/Reversal transactions
Transaction 0..1 ---- 1 Transfer group
DetectedItem 1 ---- 0..1 ReviewItem
DetectedItem 1 ---- 0..1 applied Transaction
VoiceCaptureSession 1 ---- * VoiceProposal
VoiceProposal 0..1 ---- 1 confirmed Transaction
FinancialChange 1 ---- 1..* affected Transactions/Accounts
HomeSummary ---- derives from Accounts, Transactions, ReviewItems, TrackingStatus,
                 and read-only companion planning summaries
```

## Database and Privacy Constraints

- Foreign-key checks are enabled for all persisted relations.
- Frequently filtered transaction fields and `sourceReference` are indexed.
- Multi-entity mutations use one SQLite transaction.
- Raw audio is cache-only and removed on every terminal capture path.
- Raw evidence is never part of notification, analytics, error, or app-switcher payloads.
- Fixtures use synthetic merchants, accounts, identifiers, messages, and transcripts.
