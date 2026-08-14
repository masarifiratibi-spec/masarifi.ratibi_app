# Data Model: Salary, Budgets, Obligations, Debts, Installments, and Savings

## Ownership and Persistence

| Data | Owner | Persistence |
|---|---|---|
| Accounts, categories, transactions, exchange estimates | Core Finance | Existing SQLite tables |
| Salary profiles and confirmed receipt links | Financial Planning | SQLite schema v5 |
| Budgets and category allocations | Financial Planning | SQLite schema v5 |
| Obligations, schedule items, payments, and allocations | Financial Planning | SQLite schema v5 |
| Savings goals and goal movements | Financial Planning | SQLite schema v5 |
| Meaningful unfinished planning forms | Financial Planning | SQLite schema v5 draft table |
| Planning conflicts and operation IDs | Financial Planning | SQLite schema v5 |
| Cycles, progress, totals, forecasts, due state, and Home previews | Financial Planning | Derived; never a second durable owner |
| Temporary filters, selected sections, and preview presentation | Feature state | Memory only |

All persisted money uses safe integer minor units plus an uppercase ISO currency code. Calendar
periods and due dates use local `YYYY-MM-DD` values. Actual transactions retain their existing
timestamps.

## Shared Value Objects

### LocalDate

| Field | Type | Rules |
|---|---|---|
| `value` | `YYYY-MM-DD` string | Valid local calendar date; no timezone conversion |

### Calculation

| Field | Type | Rules |
|---|---|---|
| `status` | enum | `available`, `unavailable` |
| `value` | typed value or null | Present only when available |
| `estimated` | boolean | True when any conversion estimate contributes |
| `asOf` | timestamp or null | Latest estimate timestamp when relevant |
| `reason` | enum or null | `missing_data`, `missing_rate`, `insufficient_history`, `salary_overdue` |

Zero is a valid available result and is never represented as unavailable.

### RecordMetadata

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique and immutable |
| `version` | positive integer | Required for optimistic conflict checks |
| `syncStatus` | enum | Existing `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `createdAt` / `updatedAt` | timestamp | Required |

## SalaryProfile

One active primary salary profile is supported in Core V1.

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `expectedAmountMinor` | positive safe integer | Expected amount, not fabricated income |
| `currencyCode` | ISO currency | Required |
| `salaryDay` | integer 1-31 | Missing day in a month resolves to its last day |
| `sourceName` | string | Required, length-limited |
| `receivingAccountId` | account ID | Active account when saved; history survives archive |
| `nextExpectedDate` | LocalDate | Projection derived from confirmed occurrence and salary day |
| `automaticDetectionEnabled` | boolean | Optional tracking preference |
| `status` | enum | `active`, `paused`, `archived` |

### SalaryProfile transitions

```text
active <-> paused
active|paused -> archived
```

Archiving preserves receipt links and completed cycles.

## SalaryReceiptLink

Identifies which income transaction is a confirmed primary salary receipt.

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `salaryProfileId` | salary profile ID | Required |
| `transactionId` | transaction ID | Unique; must reference eligible confirmed income |
| `expectedOccurrenceDate` | LocalDate | Projection consumed by this receipt |
| `receivedDate` | LocalDate | Derived from transaction timestamp in local time |
| `status` | enum | `linked`, `corrected`, `undone` |
| `operationId` | string | Unique idempotency key |
| `replacesReceiptId` | receipt-link ID or null | Required for correction replacement |

## SalaryCycle

A derived read model, not a persisted balance.

| Field | Type | Rules |
|---|---|---|
| `profileId` / `startReceiptId` | IDs | Latest active primary receipt |
| `startDate` | LocalDate | Confirmed receipt date |
| `projectedNextSalaryDate` | LocalDate | Next expected occurrence |
| `daysRemaining` | non-negative integer | Calendar days to projection |
| `income` / `expenses` / `reservedObligations` | Calculation<MoneyValue> | Derived from canonical records |
| `remaining` / `suggestedDaily` | Calculation<MoneyValue> | Unavailable when required inputs are incomplete |
| `previousCycleComparison` | Calculation<comparison> | Unavailable without a complete prior cycle |
| `salaryState` | enum | `on_time`, `early`, `late`, `overdue`, `unconfigured` |
| `dataState` | enum | `ready`, `empty`, `partial`, `stale`, `offline` |

## Budget

At most one non-deleted monthly budget exists per calendar month.

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `periodKey` | `YYYY-MM` | Unique among active/draft monthly budgets |
| `currencyCode` | ISO currency | Inherited by category budgets |
| `configuredExpenseLimitMinor` | non-negative safe integer | Required |
| `incomeTargetMinor` | non-negative safe integer | Required |
| `savingsTargetMinor` | non-negative safe integer | Required |
| `rolloverEnabled` | boolean | Default false |
| `rolloverCreditMinor` | non-negative safe integer | Frozen when the budget is confirmed |
| `status` | enum | `draft`, `active`, `paused`, `deleted` |
| `copiedFromBudgetId` | budget ID or null | Traceable copy source |

`effectiveExpenseLimit = configuredExpenseLimit + rolloverCredit`.

### Budget transitions

```text
draft -> active -> paused -> active
draft|active|paused -> deleted
```

## CategoryBudget

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `budgetId` | budget ID | Required |
| `categoryId` | active category ID | Unique with `budgetId` while active |
| `limitMinor` | non-negative safe integer | Uses parent budget currency |
| `alertThresholds` | percentage list | Subset of 50, 80, 90, and 100; 50 optional |
| `status` | enum | `active`, `paused`, `deleted` |

The sum of active category limits cannot exceed the parent effective expense limit. Unallocated
remainder is permitted.

## BudgetProgress

A derived read model.

| Field | Type | Rules |
|---|---|---|
| `budgetId` | budget ID | Required |
| `eligibleSpendMinor` | Calculation<integer> | Expenses minus linked refunds/reversals |
| `remainingMinor` | Calculation<integer> | May be negative when exceeded |
| `percentage` | Calculation<number> | Unavailable for zero limit |
| `forecastMinor` | Calculation<integer> | Run-rate only with complete eligible data |
| `comparison` | Calculation<comparison> | Prior period when complete |
| `state` | enum | `healthy`, `threshold`, `near_limit`, `exceeded`, `paused`, `incomplete` |
| `excludedTransactionIds` | ID list | Eligible items missing conversion estimates |

## Obligation

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `direction` | enum | `payable`, `receivable` |
| `type` | enum | `car_installment`, `personal_loan`, `buy_now_pay_later`, `credit_card_installment`, `rent`, `utility`, `subscription`, `debt`, `custom` |
| `scheduleKind` | enum | `fixed_term`, `open_ended`, `irregular` |
| `title` | string | Required |
| `provider` | string or null | Optional |
| `currencyCode` | ISO currency | Required |
| `contractedTotalMinor` | positive integer or null | Required for fixed term; absent for open ended |
| `openingPaidMinor` | non-negative integer | Prior paid amount at setup; no transaction implied |
| `installmentAmountMinor` | positive integer or null | Optional schedule default |
| `installmentCount` | positive integer or null | Fixed schedule only |
| `dueDay` | integer 1-31 or null | Resolves to last valid day of month |
| `startDate` / `endDate` | LocalDate or null | End date omitted for open ended |
| `fundingAccountId` | account ID or null | Required when recording a new payable transaction |
| `automaticMatchingEnabled` | boolean | Default false until explicitly chosen |
| `providerKeywords` | normalized string list | No duplicates |
| `reminderTiming` | reminder choice or null | Delivery remains a mock boundary |
| `notes` | string or null | Length-limited |
| `status` | enum | `active`, `paused`, `completed`, `closed`, `archived` |

### Obligation transitions

```text
active <-> paused
active|paused -> completed
active|paused -> closed
active|paused|completed|closed -> archived
```

`overdue` is derived and may coexist with active or paused lifecycle state.

## ObligationScheduleItem

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `obligationId` | obligation ID | Required |
| `sequence` | positive integer | Unique within obligation |
| `dueDate` | LocalDate | Required |
| `scheduledMinor` | positive integer | Obligation currency |
| `kind` | enum | `installment`, `balloon`, `confirmed_occurrence` |
| `status` | enum | Derived `upcoming`, `partial`, `paid`, `overdue`, `cancelled` |

Open-ended obligations create only confirmed occurrence items; speculative renewals are not
stored as debt.

## ObligationPayment

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `obligationId` | obligation ID | Required |
| `transactionId` | transaction ID | Unique active link |
| `amountMinor` | positive safe integer | Must match linked transaction effect |
| `currencyCode` | ISO currency | Obligation currency or explicit estimate context |
| `paidDate` | LocalDate | Required |
| `case` | enum | `partial`, `full`, `over`, `early`, `settlement`, `correction` |
| `allocationIntent` | enum | `current`, `later_installments`, `principal`, `correction`, `settlement` |
| `allocations` | schedule-item/amount list | Explicit; sum plus principal portion equals payment |
| `principalReductionMinor` | non-negative integer | Does not silently complete schedule items |
| `settlementAdjustmentMinor` | signed integer | Explicit discount or fee from supplied quote |
| `source` | enum | `manual`, `automatic`, `voice`, `platform_assisted` |
| `transactionOwnership` | enum | `created`, `linked_existing` |
| `status` | enum | `pending`, `posted`, `reversed`, `undone`, `conflict` |
| `operationId` | string | Unique idempotency key |
| `replacesPaymentId` | payment ID or null | Correction relationship |

Payment case is derived during preview; the UI cannot declare it without validation.

## PaymentMatch

A review projection over an existing detected item and current obligations.

| Field | Type | Rules |
|---|---|---|
| `detectedItemId` / `transactionId` | IDs | Required when available |
| `signals` | provider, amount, date, account, last-four, reference, due item | Only available evidence |
| `candidateObligationIds` | ID list | Zero, one, or many |
| `duplicatePaymentIds` | ID list | Existing possible matches |
| `status` | enum | `clear`, `review_required`, `resolved`, `ignored` |
| `resolution` | selected obligation/action or null | Explicit for review |

A clear match may commit through automatic capture with view/edit/undo. Review state has no
financial effect.

## SavingsGoal

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `title` | string | Required |
| `targetMinor` | positive safe integer | Required |
| `openingTrackedMinor` | non-negative safe integer | Initial designated savings |
| `currencyCode` | ISO currency | Required |
| `targetDate` | LocalDate | Required |
| `linkedAccountId` | account ID or null | Informational; no automatic balance effect |
| `iconKey` | named icon or null | Label remains the identity |
| `emergencyFund` | boolean | Flag, not lifecycle |
| `status` | enum | `active`, `paused`, `completed`, `archived` |

### SavingsGoal transitions

```text
active <-> paused
active|paused -> completed
active|paused|completed -> archived
completed -> active after confirmed below-target withdrawal
```

Reaching the target produces a derived `target_reached` state and does not auto-complete.

## GoalMovement

| Field | Type | Rules |
|---|---|---|
| metadata | RecordMetadata | Required |
| `goalId` | goal ID | Required |
| `kind` | enum | `contribution`, `withdrawal`, `reversal`, `correction` |
| `amountMinor` | positive safe integer | Goal currency |
| `movementDate` | LocalDate | Required |
| `linkedTransactionId` | transaction ID or null | Existing record only; no implicit create |
| `conversionEstimate` | estimate or null | Required for a foreign linked record |
| `status` | enum | `pending`, `posted`, `reversed`, `conflict` |
| `operationId` | string | Unique idempotency key |
| `replacesMovementId` | movement ID or null | Correction/reversal relationship |

Current progress derives from opening tracked amount plus active contributions minus active
withdrawals. A movement never has an account-balance effect of its own.

## PlanningDraft

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `kind` | enum | `salary`, `budget`, `obligation`, `payment`, `goal`, `goal_movement` |
| `entityId` | string or null | Existing record when editing |
| `payload` | validated draft data | Contains no raw provider errors or source messages |
| `status` | enum | `editing`, `valid`, `saving`, `saved`, `discarded` |
| `updatedAt` | timestamp | Required |

## PlanningConflict

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique |
| `entityKind` / `entityId` | strings | Required |
| `localSnapshot` / `laterSnapshot` | planning record snapshots | Preserve both |
| `resolution` | enum or null | `keep_local`, `keep_later` only |
| `status` | enum | `pending`, `resolving`, `resolved`, `failed` |
| `createdAt` / `resolvedAt` | timestamps | Required as applicable |

Conflicted snapshots contribute at most the last trustworthy synced version. `keep_both` is not
available for unique budgets or financial effects.

## Relationships

```text
Account 1 -------- * SalaryProfile
SalaryProfile 1 -- * SalaryReceiptLink * -- 1 Transaction
SalaryCycle ------- derives from SalaryReceiptLink, Transactions, and Obligations

Budget 1 --------- * CategoryBudget * -- 1 Category
BudgetProgress ---- derives from Budget, CategoryBudget, Transactions, and rates

Obligation 1 ------ * ObligationScheduleItem
Obligation 1 ------ * ObligationPayment * -- 1 Transaction
ObligationPayment -* explicit ScheduleItem allocations
PaymentMatch ------ references detected items, Transactions, and candidate Obligations

SavingsGoal 1 ---- * GoalMovement 0..1 -- 1 existing Transaction
PlanningConflict -- references one versioned planning record
```

## SQLite Schema v5 Shape

Use the existing payload-plus-indexed-columns convention and foreign keys:

- `planning_salary_profiles`
- `planning_salary_receipts` with unique `transaction_id` and `operation_id`
- `planning_budgets` with unique active `period_key`
- `planning_category_budgets` with unique active `(budget_id, category_id)`
- `planning_obligations` indexed by direction, lifecycle status, and next due date
- `planning_obligation_schedule_items` indexed by obligation and due date
- `planning_obligation_payments` with unique active `transaction_id` and `operation_id`
- `planning_savings_goals` indexed by lifecycle and target date
- `planning_goal_movements` with unique `operation_id` and optional transaction index
- `planning_drafts` indexed by kind and update time
- `planning_sync_conflicts` indexed by status and entity

No table stores salary-cycle totals, budget progress, outstanding totals, goal progress, or Home
planning previews.

## Global Validation and Privacy

- Validate all inputs before opening a write transaction.
- Revalidate preview versions inside the write transaction.
- Apply multi-record financial effects atomically and idempotently.
- Preserve original amounts, currency, and estimate timestamps.
- Archived accounts/categories remain historical references but are unavailable for unsupported
  new records.
- Sensitive amounts, provider/account hints, notes, and snapshots never enter analytics, console
  output, raw errors, external previews, or accessibility output while values are hidden.
- Fixtures use synthetic financial data only.
