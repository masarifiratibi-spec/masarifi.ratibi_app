# Data Model: Reports and Automatic Email Delivery

## Ownership and Derived Data

- Core Finance remains the canonical owner of accounts, categories, transactions, corrections,
  review state, sync state, and currency estimates.
- Financial Planning remains the canonical owner of salary receipts, budgets, obligations,
  payments, schedules, savings goals, and movements.
- Reports owns only the selected report interpretation, one delivery schedule, durable schedule
  drafts, and output attempts with immutable sanitized snapshots.
- Live summaries and breakdowns are derived. They are not financial records and are not persisted
  as a second ledger or aggregate cache.
- TanStack Query owns report-shaped service data. Zustand may hold only selected period, anchor
  date, and drill-down return context.

All money reuses Core Finance safe integer minor units and ISO currency codes. Calendar values
use `YYYY-MM-DD`; actual events retain timestamps. Stored schedule and snapshot records capture an
IANA timezone.

## Shared Value Objects

### ReportValue<T>

Represents a real value without confusing zero, estimate, incomplete, and unavailable states.

| Field | Rules |
|---|---|
| `status` | `available`, `estimated`, `incomplete`, or `unavailable` |
| `value` | Present for available/estimated; may hold a known subtotal for incomplete; absent for unavailable |
| `asOf` | Required for estimated converted values |
| `originalValues` | Original MoneyValue components for an estimate |
| `reasons` | Missing rate, review required, unresolved conflict, insufficient history, zero denominator, or no prior data |

### ReportDataState

`complete | empty | insufficient_data | partial | estimated | stale | offline`

This is independent from query loading/error state and from schedule/output lifecycle.

### ReportMetricKind

`income | expense | net_cash_flow | savings_rate | obligation_payment | category_spend |
budget_performance | debt_progress | savings_progress | account_activity | merchant_spend`

Metric kind controls contextual comparison language; it does not change canonical values.

## Entity: ReportPeriod

An exact calendar period and its fair comparison range.

| Field | Rules |
|---|---|
| `kind` | `monthly`, `three_months`, `half_year`, or `annual` |
| `anchorDate` | Local date selecting the ending month or annual year |
| `startDate` / `endDate` | Inclusive local dates in `timeZone` |
| `startInstant` / `endExclusiveInstant` | Internal half-open timestamp query boundary resolved in `timeZone` |
| `timeZone` | Valid captured IANA timezone |
| `inProgress` | True when the requested period includes the current local date and has not ended |
| `comparisonStartDate` / `comparisonEndDate` | Immediately preceding equal-length calendar period, clipped to the corresponding elapsed portion when current is incomplete |
| `comparisonStartInstant` / `comparisonEndExclusiveInstant` | Half-open comparison query boundary |

### Validation

- Start is not after end.
- Monthly is one calendar month; three-month and half-year cover three and six consecutive
  months; annual is one calendar year.
- Completed periods compare with a complete equal-length predecessor.
- In-progress periods compare with only the matching elapsed portion; a full prior-period total
  is separate secondary context.

## Entity: FinancialReport

A generated interpretation of canonical records at one time.

| Field | Rules |
|---|---|
| `key` | Stable key from period, anchor, currency, and timezone for query ownership; not a financial-record ID |
| `period` | One ReportPeriod |
| `currencyCode` | Selected report currency |
| `language` | `ar` or `en` when used for preview/output; live report labels use current locale |
| `generatedAt` / `dataAsOf` | Generation time and newest included canonical-record time |
| `fxRateMap` | One captured source-to-report-currency rate set used by every result in this generation |
| `dataState` | ReportDataState |
| `completenessReasons` | IDs/counts or safe reason categories for exclusions; no sensitive source text |
| `summary` | One ReportSummary |
| `breakdowns` | Category, account, merchant, month, budget, obligation, savings, and salary results as applicable |
| `assistantContext` | IDs and displayed metric references only; no generated prose or mutation |

The live report recalculates after contributing source invalidation. It is not itself persisted.

Eligibility includes each posted/user-confirmed record once even when local synchronization is
pending or failed. Failed financial events, deleted records, review-required detections, and
unresolved candidate snapshots are excluded. A last trustworthy pre-conflict version may remain
counted once while the report is labeled incomplete. Transfer principal is neutral, explicit
transfer fee is expense, and balance adjustments remain account activity rather than income or
expense.

## Entity: ReportSummary

| Field | Type |
|---|---|
| `income` | ReportValue<MoneyValue> |
| `expense` | ReportValue<MoneyValue> |
| `netCashFlow` | ReportValue<MoneyValue> |
| `savingsRateBasisPoints` | ReportValue<number> |
| `obligationPayments` | ReportValue<MoneyValue> |
| `largestCategory` | ReportValue<ReportBreakdownItem> |
| `largestTransaction` | ReportValue<ReportTransactionReference> |
| `comparisons` | ReportComparison[] |

### Calculations

```text
income = confirmed eligible income effects
expense = confirmed eligible expense effects after linked refunds/reversals
netCashFlow = income - expense
savingsRateBasisPoints = round(netCashFlow * 10,000 / income)
```

Savings rate is unavailable when income is not positive or required values are incomplete.
Internal account transfers affect neither income nor expense. Obligation payments contribute to
expense once through their transaction and separately identify the obligation section. Savings
goal links do not add a second ledger effect.

## Entity: ReportComparison

| Field | Rules |
|---|---|
| `metricKind` | ReportMetricKind |
| `current` / `previous` | Values over the two explicit ranges |
| `absoluteChange` | Current minus previous in the metric's unit |
| `percentageBasisPoints` | Available only with a meaningful, complete non-zero previous value |
| `currentRange` / `previousRange` | Exact displayed dates |
| `direction` | `higher`, `lower`, or `unchanged` |
| `interpretation` | `favorable`, `unfavorable`, `neutral`, or `not_applicable` based on metric kind |
| `unavailableReason` | Zero denominator, no prior data, newly observed, or incomplete |

No percentage is coerced for a zero denominator or a newly observed value.

## Derived Longer-Period Insights

Build profile-timezone calendar-month buckets once. A partial current bucket may contribute to
the summary but is excluded from insights that claim comparable completed months.

```text
averageMonthlySpend = completedMonthExpense / completedMonthCount
spendingVolatility = populationStandardDeviation(completedMonthExpense) / meanExpense
savingsConsistency = completed months with positive net goal movement / eligible completed months
budgetConsistency = complete budget months at or below limit / complete months with budgets
subscriptionImpact = confirmed subscription expense / total eligible expense
debtReduction = payable fixed-term outstanding at period start - outstanding at period end
savingsProgression = confirmed contributions - withdrawals during period
```

Volatility, consistency, movement, and high/low comparisons require at least two complete buckets
and a meaningful denominator; otherwise the insight is unavailable with a reason.

## Entity: ReportBreakdown

| Field | Rules |
|---|---|
| `dimension` | `category`, `account`, `merchant`, `month`, `budget`, `obligation`, `savings`, or `salary` |
| `questionKey` / `summaryKey` | Localized content keys and safe interpolation values |
| `items` | Ordered ReportBreakdownItem values |
| `dataState` | Complete/partial/estimated/insufficient status for this breakdown |
| `drillDown` | One ReportDrillDown descriptor |

### ReportBreakdownItem

- Stable dimension ID and localized label reference.
- ReportValue for amount/rate/progress.
- Contributing transaction, payment, goal, budget, or obligation IDs.
- Metric kind and contextual comparison when applicable.
- Optional `memberIds` for an Other item.

Category charts show at most four named categories plus localized Other. Other retains every
grouped category ID and contributing transaction ID; it never discards drill-down membership.

### ReportDrillDown

A discriminated union:

- `transactions`: an existing `TransactionFilterSet` with period and category/account/merchant/
  month membership plus report return context.
- `obligation`: an existing obligation ID and report return context.
- `other_categories`: member category IDs plus the combined transaction filter.

Reports do not copy transaction or obligation detail models.

## Entity: PlanningReportingSnapshot

A read-only transfer object produced by the Financial Planning owner for one ReportPeriod.

Contains only the canonical salary receipts, monthly budgets, obligation schedules/payments,
savings goals/movements, lifecycle/version evidence, and completeness markers needed by report
calculation. It does not contain calculated report totals and cannot mutate planning records.

## Entity: RecipientVerification

| Field | Rules |
|---|---|
| `normalizedEmail` | Zod-validated normalized address; never analytics/log data |
| `status` | `unverified`, `verifying`, `verified`, or `failed` |
| `verifiedAt` | Present only for verified status |
| `failureCategory` | Safe category only; no raw provider response |

Verification is bound to the exact normalized address. Changing the recipient invalidates the
prior verification.

## Entity: ReportSchedule

One versioned schedule exists in Core V1.

| Field | Rules |
|---|---|
| `id` | Stable singleton record ID |
| `version` | Incremented for each saved change; required by updates |
| `status` | `verification_required`, `active`, `paused`, or `disabled` |
| `recipient` | RecipientVerification; must be verified before active |
| `frequency` | `monthly`, `three_months`, `half_year`, or `annual` |
| `language` | `ar` or `en` |
| `currencyCode` | Valid report currency |
| `deliveryDay` | Integer 1 through 28; default 1 |
| `timeZone` | Captured IANA timezone |
| `includeAssistantSummary` | Boolean; content remains deterministic mock data |
| `detailLevel` | `summary` or `detailed`; default summary |
| `lastSuccessfulAttemptId` | Nullable immutable attempt reference |
| `nextDeliveryAt` | Projected next eligible timestamp; not a promise of background execution |
| `createdAt` / `updatedAt` | Timestamps |

### Lifecycle

```text
verification_required -> active
verification_required -> disabled
active -> paused | disabled | verification_required
paused -> active | disabled | verification_required
disabled -> active | verification_required
```

- A recipient change moves the schedule to verification-required.
- Occurrences use a fixed deterministic 09:00 local mock time; the UI does not offer an
  unrequested delivery-time setting.
- Later occurrences add cadence months to the prior scheduled occurrence and cover the immediately
  preceding complete cadence period; actual completion time never shifts the recurrence.
- Creating/resuming after the selected time has passed chooses the next recurrence; no silent
  catch-up occurs.
- A captured timezone change requires review before recomputing the accepted next delivery.
- Pausing/disabling affects future recurrence only and preserves attempt history.

## Entity: ReportScheduleDraft

Reuses the existing durable `PlanningDraft` record with `kind: report_schedule`.

It contains editable schedule input, base schedule version, validation status, and update time.
It never replaces the trusted schedule until a validated save succeeds. It survives validation,
navigation, restart, offline state, and recoverable failure and is removed only after save or
explicit discard.

## Entity: ReportSnapshot

A self-contained immutable output payload.

| Field | Rules |
|---|---|
| `period`, `generatedAt`, `dataAsOf` | Exact report provenance |
| `language`, `currencyCode`, `detailLevel` | Output choices at generation |
| `dataState`, `notices` | Estimate, incomplete, privacy, and mock-output labels |
| `summary`, `breakdowns` | Frozen report values and membership used by the attempt |
| `detailedRows` | Empty for summary; allowlisted DetailedReportRow values otherwise |

Snapshots do not change after creation. A corrected live report produces a new snapshot and may
differ from the prior one with both generation times visible.

### DetailedReportRow Allowlist

- Local date.
- Transaction type.
- Localized category label.
- Optional permitted merchant label.
- MoneyValue amount.
- Masked account label.

The DTO has no notes, tags, full account identifiers, source message text, confidence, attachment,
raw transaction object, or internal reference field.

## Entity: ReportOutputAttempt

| Field | Rules |
|---|---|
| `id` | Stable attempt ID |
| `operationId` | Unique idempotency key; replay returns the original outcome |
| `scheduleId` | Nullable for on-demand and simulated actions |
| `kind` | `send_test`, `send_now`, `scheduled`, `retry`, `download`, or `share` |
| `status` | `ready`, `scheduled`, `sending`, `sent`, `failed`, or `simulated` |
| `snapshot` | One immutable ReportSnapshot embedded in the attempt |
| `retryOfAttemptId` | Required only for retry; references a failed attempt |
| `failureCategory` | `temporary`, `recipient`, `configuration`, or `unknown`; raw errors excluded |
| `requestedAt` / `completedAt` | Timestamps |
| `scheduleStatusAtCompletion` | Preserves late-result context without changing the schedule |

### Lifecycle

```text
ready -> scheduled | sending | simulated
scheduled -> sending | failed
sending -> sent | failed
failed -> terminal; an explicit retry creates a linked new attempt
sent | simulated -> terminal
```

Repeating an operation ID has no new effect. A late success may update that attempt but cannot
change a paused/disabled schedule to active or silently move future recurrence.

## Relationships

```text
Canonical Core Finance records ----> FinancialReport (derived)
Canonical Financial Planning records -> FinancialReport (derived)
ReportPeriod 1 ---- 1 FinancialReport
FinancialReport 1 ---- * ReportBreakdown
ReportSchedule 0..1 ---- * ReportOutputAttempt
ReportOutputAttempt 1 ---- 1 embedded ReportSnapshot
ReportOutputAttempt 0..1 ---- 1 prior failed ReportOutputAttempt (retry)
PlanningDraft(kind=report_schedule) 0..1 ---- 0..1 ReportSchedule
```

## SQLite Schema v6 Shape

Follow the existing payload-plus-indexed-columns convention:

- `report_schedules`
  - `id` primary key, `payload`, `status`, `next_delivery_at`, `updated_at`.
  - Repository enforces the single Core V1 schedule and expected version.
- `report_output_attempts`
  - `id` primary key, `payload`, unique `operation_id`, nullable `schedule_id`, nullable
    `retry_of_attempt_id`, `kind`, `status`, `requested_at`, `completed_at`.
  - Index by status/requested time and schedule/requested time.
  - Payload embeds the immutable snapshot; completed attempts are append-only.
- Existing `planning_drafts`
  - Add `report_schedule` to the domain kind union; no schema change.

No table stores live report totals, breakdowns, comparisons, chart points, or a second copy of
financial entities. Add a report cache only after a measured failure of the 10,000-record/
two-second gate.

## Global Validation, Privacy, and Invalidation

- Validate inputs before writes and recheck expected versions inside the existing exclusive
  transaction.
- Normalize and verify the exact email before active schedule/save/send states.
- Stable operation IDs protect schedule, send, retry, download, and share simulations.
- Source record changes invalidate live report query keys; immutable attempt snapshots are never
  invalidated or recomputed.
- Missing rates/history and review/conflict exclusions are data states, not thrown errors.
- Recipient email, report rows, amounts, merchants, accounts, snapshots, and internal IDs never
  enter analytics, console output, raw errors, notifications, app previews, or hidden-value
  accessibility output.
- Output and fixture data is synthetic; no production provider or secret exists in the client.
