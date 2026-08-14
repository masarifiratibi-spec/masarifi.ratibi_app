# Data Model: Home, Accounts, Transactions, and Categories

## Shared Value Objects

### MoneyValue

| Field | Type | Rules |
|---|---|---|
| `minorUnits` | safe integer | Absolute stored magnitude; sign comes from transaction semantics |
| `currencyCode` | string | Supported uppercase ISO currency code |
| `scale` | integer | Currency fraction digits used for parsing and formatting |

User input is parsed once at validation. Arithmetic uses minor units only.

### EstimatedMoneyValue

| Field | Type | Rules |
|---|---|---|
| `profileValue` | MoneyValue | Value in the user's profile currency |
| `components` | component list | Original amount, currency, rate, and rate timestamp per included balance |
| `excludedAccountIds` | string list | Accounts omitted because no usable rate exists |
| `isEstimated` | boolean | Always true when conversion occurred or an account was excluded |

## Account

Represents a financial source or destination. Current balance is a derived read value, never an
editable stored field.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique and immutable |
| `name` | string | Required; duplicate names allowed |
| `type` | enum | `bank`, `debit_card`, `credit_card`, `wallet`, `cash`, `savings`, `other` |
| `currencyCode` | string | Required ISO code; immutable after posted activity exists |
| `openingBalanceMinor` | safe integer | Required; corrections use adjustment transactions |
| `institution` | string or null | Optional |
| `lastFour` | four digits or null | Optional; never stores a full identifier |
| `creditLimitMinor` | safe integer or null | Non-negative; only relevant to credit accounts |
| `isDefault` | boolean | At most one active default account |
| `iconKey` / `colorKey` | string or null | Named semantic choices only |
| `notes` | string or null | Length-limited user text |
| `status` | enum | `active`, `archived` |
| `createdAt` / `updatedAt` | timestamp | Required |

### Account derived values

- `currentBalance = openingBalance + sum(posted transaction effects)`.
- Available credit derives from credit limit and the account's current balance.
- Deleted, failed, draft, and unresolved-conflict transactions have no active balance effect.

### Account transitions

```text
active <-> archived
```

Archiving requires impact confirmation, preserves historical references, and removes the account
from unsupported new transaction selection.

## Category

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique and immutable |
| `kind` | enum | `system`, `custom` |
| `parentId` | string or null | Cannot reference self or create a cycle |
| `labelAr` / `labelEn` | string | Both required for custom categories |
| `iconKey` / `colorKey` | string or null | Optional; never the sole identity |
| `isFavorite` | boolean | Controls shortcut ranking |
| `status` | enum | `active`, `archived`, `merged` |
| `mergedIntoId` | string or null | Required only when merged; target must be active and different |
| `createdAt` / `updatedAt` | timestamp | Required |

### Category transitions

```text
active <-> archived
active|archived -> merged
merged -> terminal
```

A merge atomically reassigns all transaction references to the target, stores `mergedIntoId`,
and removes the source from future selectors.

## Transaction

Represents one ledger event. Type, status, source, and relationships define its financial meaning.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique and immutable |
| `type` | enum | `expense`, `income`, `transfer`, `refund`, `reversal`, `adjustment`, `obligation_payment`, `recurring_payment` |
| `amountMinor` | safe integer | Positive; zero rejected except an explicit zero-value test adjustment |
| `currencyCode` | string | Must match source account except supported transfer estimate flow |
| `accountId` | string | Required source or destination account |
| `destinationAccountId` | string or null | Required for transfer; must differ from `accountId` |
| `feeMinor` | safe integer | Non-negative; transfer only |
| `categoryId` | string or null | Required except transfer; active at creation |
| `merchant` / `title` | string or null | At least one display title resolves |
| `paymentMethod` | enum or null | `cash`, `card`, `transfer`, `wallet`, `apple_pay`, `google_pay`, `other` |
| `occurredAt` | timestamp | Required |
| `source` | enum | `manual`, `automatic`, `voice`, `platform_assisted`, `adjustment` |
| `status` | enum | `pending`, `posted`, `failed`, `refunded`, `reversed`, `deleted` |
| `reviewStatus` | enum | `none`, `required`, `resolved` |
| `syncStatus` | enum | `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `originalTransactionId` | string or null | Required for linked refund or reversal |
| `obligationId` | string or null | Read-only companion-spec relationship |
| `notes` | string or null | Length-limited user content |
| `version` | positive integer | Incremented by each accepted correction |
| `deletedAt` | timestamp or null | Set when status becomes deleted |
| `undoExpiresAt` | timestamp or null | Exactly 30 seconds after eligible deletion |
| `createdAt` / `updatedAt` | timestamp | Required |

### Transaction balance effects

- Expense and obligation payment reduce the source account.
- Income increases the receiving account.
- Adjustment applies its explicit signed correction to one account.
- Transfer reduces the source by amount plus fee and increases the destination by amount; it
  changes neither income nor expense summaries except for the separate fee meaning.
- Refund increases the receiving account but remains distinct from income and salary.
- Reversal offsets its linked transaction according to the original type.
- Deleted, failed, draft, and unresolved-conflict records contribute nothing to active totals.

### Transaction transitions

```text
pending -> posted | failed | deleted
posted -> refunded | reversed | deleted
failed -> pending | deleted
deleted -> prior state during the 30-second undo window
refunded|reversed -> correction only
```

After the undo deadline, `deleted` remains a terminal marker in ordinary UI.

### Sync transitions

```text
pending -> syncing -> synced
                  -> failed -> pending
                  -> conflict -> pending after explicit resolution
```

## TransactionDraft

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `transactionType` | transaction type or null | Controls applicable fields |
| `amountText` | string | Preserved display input; parsed during validation |
| `accountId` / `destinationAccountId` / `categoryId` | string or null | Optional until validation |
| `merchant` / `notes` | string or null | Preserved input |
| `occurredAt` | timestamp or null | Optional until validation |
| `validationIssues` | issue list | Localization key and field id |
| `status` | enum | `editing`, `valid`, `saving`, `saved`, `discarded` |
| `updatedAt` | timestamp | Required |

```text
editing -> valid -> saving -> saved
editing|valid|saving -> editing on validation or recoverable failure
editing|valid -> discarded after explicit confirmation
```

## TransactionFilterSet

| Field | Type | Rules |
|---|---|---|
| `search` | string | Trimmed and normalized for Arabic/English matching |
| `periodStart` / `periodEnd` | timestamp or null | Start cannot exceed end |
| `accountIds` / `categoryIds` | string lists | Empty means all eligible values |
| `types` / `sources` / `statuses` | enum lists | Combinable |
| `syncStatuses` | enum list | Combinable |
| `reviewRequired` | boolean or null | Null means either |
| `minMinor` / `maxMinor` | safe integer or null | Minimum cannot exceed maximum |
| `sort` | enum | `newest`, `oldest`, `amount_high`, `amount_low` |
| `pageCursor` | opaque value or null | Stable paging boundary |

## CorrectionAction

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `transactionId` | string | Required |
| `kind` | enum | `edit`, `delete`, `undo_delete`, `refund`, `reversal`, `reclassify`, `report_wrong`, `adjustment` |
| `beforeSnapshot` / `afterSnapshot` | transaction snapshot or null | Contains only required financial fields |
| `status` | enum | `preview`, `applying`, `applied`, `undone`, `failed`, `expired` |
| `expiresAt` | timestamp or null | Required for timed undo |
| `createdAt` | timestamp | Required |

## SyncConflict

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `transactionId` | string | Required |
| `localSnapshot` | transaction snapshot | Preserved local version |
| `laterSnapshot` | transaction snapshot | Preserved later version |
| `resolution` | enum or null | `keep_local`, `keep_later`, `keep_both` |
| `status` | enum | `pending`, `resolving`, `resolved`, `failed` |
| `createdAt` / `resolvedAt` | timestamp | Resolution timestamp only after success |

```text
pending -> resolving -> resolved
                    -> failed -> pending
```

Resolution writes the chosen result atomically and returns it to pending synchronization.

## ExchangeRateEstimate

| Field | Type | Rules |
|---|---|---|
| `baseCurrencyCode` | string | User profile currency |
| `quoteCurrencyCode` | string | Account currency |
| `rate` | positive decimal fixture | Mock-only; never authoritative production data |
| `asOf` | timestamp | Displayed with estimate context |
| `status` | enum | `available`, `stale`, `unavailable` |

Only available or explicitly accepted stale mock rates contribute to estimates. Unavailable
currencies are excluded and named in the warning.

## HomeSummary

A derived read model, not an independent financial owner.

| Field | Type | Rules |
|---|---|---|
| `totalBalance` | MoneyValue or EstimatedMoneyValue | Derived from active accounts |
| `periodIncome` / `periodExpense` | MoneyValue | Derived from posted transaction semantics |
| `activeAccountCount` | integer | Derived |
| `recentTransactionIds` | bounded string list | Most recent eligible records |
| `reviewCount` / `pendingSyncCount` | integer | Derived |
| `salaryCyclePreview` | companion summary or null | Read-only later-spec data |
| `trackingState` | companion summary or null | Platform-aware earlier/later-spec data |
| `budgetPreview` / `obligationPreview` / `goalPreview` / `insightPreview` | companion summary or null | Read-only links |
| `dataState` | enum | `loading`, `ready`, `empty`, `partial`, `error`, `offline`, `stale` |

## Relationships

```text
Account 1 -------- * Transaction
Category 1 ------- * Transaction
Transaction 0..1 -- * Refund/Reversal transactions
Transaction 1 ---- * CorrectionAction
Transaction 1 ---- 0..1 SyncConflict
Category 0..1 ---- * merged source Categories
HomeSummary ------- derives from Accounts, Transactions, rates, review, sync,
                    and read-only companion summaries
```

## Storage and Privacy Constraints

- Foreign-key checks are enabled for persisted relationships.
- Frequently filtered transaction fields and normalized search text are indexed.
- Transfer, refund, adjustment, delete/undo, conflict resolution, and category merge are atomic.
- Full account identifiers, raw messages, transcripts, amounts, and merchant names never enter
  analytics or raw error payloads.
- Hidden values stay hidden in visual output, accessibility announcements, and app-switcher views.
- Fixtures use synthetic accounts, identifiers, merchants, and financial events only.
