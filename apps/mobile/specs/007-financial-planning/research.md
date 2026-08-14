# Research: Salary, Budgets, Obligations, Debts, Installments, and Savings

## Decision 1: Extend the existing financial architecture without a dependency

**Decision**: Add one financial-planning domain, typed service, deterministic mock adapter, and
SQLite repository. Reuse the installed Expo Router, Expo SQLite, TanStack Query, Zustand, Zod,
i18next, formatters, masking provider, design system, and Jest/React Native Testing Library stack.
Use native `Date` and `Intl` for calendar behavior; add no date, decimal, storage, form, or chart
package.

**Rationale**: The application already has every required capability and a stable feature/service/
storage pattern. A new dependency would create a second way to solve an existing problem.

**Alternatives considered**: A separate planning store, date library, decimal library, or form
framework migration adds scope without improving the approved frontend behavior.

## Decision 2: Reuse integer money and local calendar dates

**Decision**: Reuse `MoneyValue` and safe integer minor units for all persisted and calculated
money. Use `YYYY-MM-DD` local calendar dates for salary projections, budget periods, obligation
due dates, and goal dates; retain transaction timestamps for actual ledger events. Preserve
original currencies and explicit conversion estimates.

**Rationale**: Integer arithmetic avoids financial drift, while date-only values avoid timezone
movement of monthly and due-date concepts.

**Alternatives considered**: Floating-point money and midnight timestamps were rejected because
they can change totals or calendar dates unexpectedly.

## Decision 3: Derive salary cycles from confirmed primary receipts

**Decision**: Link a confirmed primary salary transaction to the salary profile. The latest
confirmed primary receipt starts the current cycle; the next confirmed primary receipt closes
it. Other income contributes to cycle income but does not start a cycle. Expected occurrences
remain projections and use the last calendar day when the configured salary day is unavailable.

```text
expectedDate(month) = min(configuredSalaryDay, daysInMonth)
cycleIncome = confirmed non-reversed income since cycle start
cycleExpenses = eligible non-reversed expenses since cycle start
reservedObligations = unpaid payable occurrences due before projected next salary
remaining = cycleIncome - cycleExpenses - reservedObligations
daysRemaining = max(0, calendarDays(today, projectedNextSalary))
```

Show suggested daily amount only when the data is complete, salary is not overdue,
`daysRemaining > 0`, and remaining money is non-negative. Otherwise show deficit or unavailable.

**Rationale**: Confirmed money, not a calendar projection, must define the actual cycle. This also
prevents bonuses or duplicate detections from splitting the cycle.

**Alternatives considered**: Calendar-month cycles, expected-income fabrication, and treating
every salary-like deposit as primary were rejected.

## Decision 4: Derive budget progress from the existing ledger

**Decision**: Each budget covers one calendar month in one currency. Category budgets inherit
that currency. Eligible spend uses the existing ledger semantics once:

```text
eligibleSpend = eligible expenses - linked refunds - linked reversals
remaining = effectiveExpenseLimit - eligibleSpend
progress = eligibleSpend / effectiveExpenseLimit
```

Transfers are excluded. Obligation payments count through their single linked expense only.
Foreign activity uses a labeled estimate in the budget currency. If any eligible item lacks a
rate, retain known values but mark total, progress, forecast, thresholds, and comparison
incomplete. A zero limit has no percentage; positive spending is exceeded.

Use a labeled run-rate forecast only when the month has at least one completed calendar day and
all eligible activity is complete:

```text
forecast = eligibleSpend / elapsedCalendarDays * daysInMonth
```

**Rationale**: Reusing ledger meaning prevents a second spending source of truth and preserves
refund, reversal, transfer, and obligation semantics.

**Alternatives considered**: A planning-owned expense ledger, silent currency exclusion, and
counting obligation payments twice were rejected.

## Decision 5: Freeze positive-only rollover at confirmation

**Decision**: Rollover is disabled by default. When enabled, the next confirmed monthly budget
receives only the prior month's positive unused effective limit:

```text
rolloverCredit = max(0, priorEffectiveLimit - priorEligibleSpend)
effectiveLimit = configuredLimit + rolloverCredit
```

Freeze that credit when the new month is confirmed. Later prior-month corrections require an
explicit reviewed rollover adjustment rather than silently cascading. Category limits are
partial allocations: one active limit per category, total active limits no greater than the
effective monthly limit, and any remainder may stay unallocated. Moving an amount changes only
the two category limits.

**Rationale**: A frozen credit is predictable, supports offline work, and prevents historical
edits from silently rewriting a current plan.

**Alternatives considered**: Deficit rollover, recursive live recalculation, and forcing full
category allocation were rejected.

## Decision 6: Separate obligation lifecycle from derived due state

**Decision**: Persist only `active`, `paused`, `completed`, `closed`, and `archived` lifecycle
states. Derive `upcoming`, `partial`, `paid`, and `overdue` from schedule items and active
payments. Completion means financially satisfied; closure means tracking ended without claiming
the balance was paid. Payables and receivables remain separate.

For fixed-term obligations, derive paid, remaining, completed installments, and next due date
from schedule allocations. Do not use `floor(paid / installmentAmount)` because schedules may
vary or contain a balloon payment.

**Rationale**: Lifecycle and due state answer different questions; separating them avoids a large,
contradictory status enum.

**Alternatives considered**: Persisting every lifecycle/due combination and netting receivables
against payables were rejected.

## Decision 7: Model open-ended obligations as confirmed occurrences

**Decision**: Open-ended bills and subscriptions have no contracted lifetime total, remaining
installment count, or lifetime progress. They own confirmed due occurrences. Outstanding totals
include fixed-term remaining balances plus only unpaid open-ended occurrences that are due or
overdue. Future estimated renewals remain previews and contribute nothing.

**Rationale**: Multiplying a recurring amount by an arbitrary horizon invents debt.

**Alternatives considered**: Annualized subscription totals, infinite schedules, and treating
the absence of a confirmed occurrence as a zero lifetime balance were rejected.

## Decision 8: Preview and allocate every non-trivial payment explicitly

**Decision**: A confirmed payment links exactly one ledger transaction and one obligation-payment
record. Partial payments accumulate against the current schedule item. Full payments complete
only fully covered items. Amounts over the current due require an explicit later-installment,
principal-reduction, or correction choice. Principal reduction changes remaining principal but
does not invent a revised amortization schedule. Early settlement uses a supplied mock quote,
records explicit discount or fee information, preserves history, and completes only after
confirmation.

Payments larger than the entire remaining obligation are blocked until the excess is resolved.
Provider-specific schedule recalculation stays unavailable unless a reviewed adapter result
supplies it.

**Rationale**: Loans and installment products do not share one safe excess-payment heuristic.

**Alternatives considered**: Automatically treating excess as principal, future installments,
or stored credit and implementing a generic loan amortizer were rejected.

## Decision 9: Coordinate ledger and planning writes atomically

**Decision**: Keep Core Finance as the only ledger writer and add a narrow transaction-aware write
seam that the planning repository can use inside the existing exclusive SQLite transaction. A
manual payment creates or links one transaction, writes one payment and its allocations, and
recomputes derived planning state as one commit. Detected salary/payment links use the same
coordinator. Every multi-record command has a stable operation ID and expected entity version.

**Rationale**: Sequential service calls can leave a transaction without its obligation effect or
vice versa. A shared database transaction preserves existing ownership and exact-once behavior.

**Alternatives considered**: A second ledger, screen-level writes, sequential calls with
compensation, and a general event-sourcing layer were rejected.

## Decision 10: Undo by recomputing canonical records

**Decision**: Reversal, unlink, correction, and undo mark the affected link/allocation inactive,
then recompute totals, schedule state, next due date, lifecycle, budgets, and salary summaries
from surviving records. If the operation created its transaction, undo voids both atomically. If
it linked an existing transaction, undo removes only the planning relationship. Repeating an
operation ID has no additional effect.

**Rationale**: Recalculation restores variable schedules and early settlements safely; inverse
arithmetic against cached totals does not.

**Alternatives considered**: Hard deletion and subtracting the last displayed values were
rejected because they lose history and can drift.

## Decision 11: Keep savings movements tracking-only by default

**Decision**: A savings movement changes designated goal progress only. It may explicitly link
an existing transaction or transfer, but never creates or changes an account balance. Derive:

```text
current = openingTrackedAmount + contributions - withdrawals
remaining = max(0, target - current)
```

Reject zero/negative movements and withdrawals above current progress. A target reached state
does not auto-complete the goal. Required monthly saving divides remaining minor units across
remaining calendar contribution opportunities and rounds upward; it is unavailable after an
incomplete target passes. Undoing a movement does not undo its independently linked transaction.

**Rationale**: Goal tracking must not pretend to transfer real money or double-count ledger
effects.

**Alternatives considered**: Automatic transfers, duplicate transactions, auto-completion, and
30-day month approximations were rejected.

## Decision 12: Persist records and drafts; derive summaries

**Decision**: Advance the existing SQLite schema from version 4 to 5 with planning-owned salary,
receipt-link, budget, category-budget, obligation, payment, goal, movement, draft, and conflict
tables. Persist canonical inputs, relationships, versions, sync states, operation IDs, and
snapshots; derive cycles, totals, forecasts, progress, due state, and Home previews. TanStack
Query owns service-shaped reads and invalidates explicit planning and Core Finance scopes.
Zustand owns only transient filters or unfinished presentation state.

**Rationale**: Canonical persistence plus derived summaries minimizes duplicated financial state
while meeting offline draft and conflict requirements.

**Alternatives considered**: Persisting every summary, mirroring records in Zustand, or keeping
financial planning in memory were rejected.

## Decision 13: Reuse and harden existing routes and components

**Decision**: Keep the five primary tabs unchanged. Add secondary Salary, Budgets, Obligations,
and Savings route groups reachable from Home, More, profile completion, transaction links, and
tracking/voice review. Reuse existing financial cards and progress/timeline primitives after
removing hard-coded labels, guarding zero denominators, accepting integer money, and supporting
masking, incomplete data, over-limit state, RTL, and 200% text.

**Rationale**: The route and component foundations already exist; replacing them would duplicate
navigation, visual language, and accessibility behavior.

**Alternatives considered**: A new Planning tab, a second UI kit, and separate platform screens
were rejected.

## Decision 14: Prove calculations first, then journeys and native behavior

**Decision**: Add focused pure-domain checks for date, money, rollover, budget eligibility,
payment allocation, undo, and goal calculations; repository/service checks for migration,
atomicity, idempotency, conflicts, and affected scopes; component/route checks for journeys,
localization, masking, and access; and Android/iOS development-build checks only for native
lifecycle, layout, screen readers, and platform integration. Add one planning boundary script;
do not add an end-to-end framework.

**Rationale**: Fast deterministic tests prove financial behavior; device checks prove only what
the operating system controls.

**Alternatives considered**: Device-only validation, snapshots as primary proof, and a new test
framework were rejected.

## Resolved Unknowns

- No planning ambiguity remains unresolved.
- Forecast sufficiency uses complete current-month data and at least one completed day; otherwise
  forecast is unavailable.
- Provider-specific principal rescheduling remains an explicit unavailable/mock-adapter state.
- Conflicts preserve local and later snapshots and allow `keep_local` or `keep_later`; financial
  `keep_both` is excluded because it can duplicate unique budgets, payments, or goal movements.
