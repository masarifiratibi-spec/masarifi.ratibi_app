# Quickstart: Validate Financial Planning

## Purpose

Run the smallest automated and native checks that prove SPEC-007 salary, budget, obligation,
payment, savings, privacy, offline, localization, and accessibility contracts. This guide assumes
implementation tasks are complete and uses synthetic fixtures only.

## Prerequisites

- Node.js and npm versions supported by the existing mobile workspace.
- Dependencies installed from the committed lockfile; SPEC-007 adds no runtime dependency.
- Android development build or emulator for lifecycle, offline, TalkBack, and layout checks.
- macOS/Xcode and an iOS development build for final VoiceOver and iOS checks.
- No real account, salary, provider, debt, transaction, rate, or savings data in fixtures.

## Static and Automated Validation

From `apps/mobile`:

```powershell
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
npm run check:voice-capture
npm run check:financial-planning
npm test -- --runInBand
```

`check:financial-planning` is added during implementation with the planning boundary script.

Expected outcome:

- Every command exits successfully.
- Boundary checks report no route-to-database access, raw feature colors, hard-coded planning
  strings, provider/secret imports, sensitive logging, planning records in Zustand, goal-driven
  account mutations, or iOS SMS claims.
- Tests prove date and money rules, salary cycles, budget eligibility and rollover, payment
  allocation and undo, goal movements, migration, atomicity, idempotency, conflicts, query
  invalidation, masking, localization, and accessibility.

## Development Build

Start the existing development client:

```powershell
npm run start -- --localhost
npm run android
```

On macOS/Xcode:

```bash
npm run ios
```

## Scenario 1: Salary Setup and Cycle

1. Open Salary with no profile; verify setup is optional and other planning routes remain usable.
2. Create a salary on day 31, then inspect February and a 30-day month.
3. Link a normal primary salary receipt and verify cycle start, next projection, income, expenses,
   reserved obligations, remaining amount, daily amount, and prior-cycle comparison.
4. Link an early receipt and verify it consumes the expected occurrence without changing the
   configured salary day or amount.
5. Exercise late, missing, duplicate, conflicting, different-amount, and different-currency
   receipts.
6. Correct and undo a linked salary receipt.

Expected outcome: only confirmed primary receipts start cycles; projections never fabricate
income; overdue/incomplete states suppress unreliable daily guidance; correction and undo restore
all linked summaries exactly once.

## Scenario 2: Monthly and Category Budgets

1. Create a calendar-month budget in SAR with expense, income, and savings targets.
2. Add several category limits, leave an unallocated remainder, attempt a duplicate category,
   and attempt to exceed the monthly effective limit.
3. Move an amount between two categories, including a move below already-recorded spend.
4. Copy the prior month and edit every value before confirmation.
5. Enable rollover with positive prior remaining, then test prior overspending and a later prior-
   month correction.
6. Load expenses, obligation payments, transfers, refunds, reversals, reclassifications, deleted
   records, and unresolved conflicts.
7. Add foreign-currency activity with available, stale, and unavailable mock estimates.
8. Exercise zero limit, over 100%, threshold, insufficient forecast history, paused, empty,
   partial, offline, and pending-sync states.

Expected outcome: ledger effects count once; transfers do not spend budget; linked refunds and
reversals correct the original month/category; rollover is positive-only and frozen; category
allocations preserve the monthly limit; missing rates make calculations incomplete rather than
understated.

## Scenario 3: Obligation Information Architecture and Lifecycle

1. Load fixed-term payables, receivables, variable installments, balloon schedules, debts,
   recurring bills, subscriptions, upcoming payments, and history.
2. Verify payable and receivable totals remain separate.
3. Verify open-ended items contribute only confirmed due/overdue occurrences and show no invented
   lifetime total or progress.
4. Create each supported obligation type and verify irrelevant fields disappear and cannot be
   retained in saved input.
5. Pause, resume, complete, close, and archive obligations.
6. Make one item overdue without changing its lifecycle status.

Expected outcome: overview totals, due/paid/overdue values, next payment, progress, schedule, and
allowed actions match canonical records; completion and closure remain distinct.

## Scenario 4: Payment, Matching, Settlement, and Undo

1. Record a full payment by creating a transaction and verify one transaction plus one payment.
2. Record several partial payments; verify the installment completes only when cumulative
   allocation reaches its scheduled amount.
3. Enter an amount above current due and separately choose later installments, principal
   reduction, and correction.
4. Attempt an amount above the entire remaining balance without resolving the excess.
5. Record an early payment and verify date alone does not advance an installment.
6. Preview and confirm an early settlement with explicit quote/adjustment and preserved history.
7. Link an existing transaction, then undo; verify only the obligation relationship is removed.
8. Undo a payment-owned transaction; verify transaction and planning effects are voided together.
9. Repeat the same operation and undo IDs.
10. Exercise zero, one, multiple, conflicting, and duplicate detected matches from automatic and
    voice fixtures.

Expected outcome: every non-trivial allocation is previewed; linked records commit atomically;
ambiguous cases affect nothing; operation retries are idempotent; recomputation restores totals,
schedule, lifecycle, budget, salary, and Home previews exactly.

## Scenario 5: Savings Goals

1. Create regular and emergency-fund goals with and without linked accounts.
2. Add a contribution and withdrawal; verify only tracked goal progress changes.
3. Link an existing transfer and foreign-currency transaction with a visible estimate; verify no
   ledger event is created or counted twice.
4. Attempt zero/negative movements and a withdrawal above current progress.
5. Reach the target and choose continue active, complete, and archive separately.
6. Withdraw from a completed goal below target and verify reopening is previewed.
7. Pass the target date incomplete and exercise revise, pause, and continue.
8. Reverse a movement and verify the existing linked transaction remains unchanged.

Expected outcome: goal progress, remaining amount, required monthly saving, history, target-
reached state, and lifecycle are correct; no goal action silently changes account balances.

## Scenario 6: Drafts, Offline, Failure, and Conflict

1. Enter meaningful data in each planning form, trigger validation, navigate away, restart, and
   resume the draft.
2. Save eligible salary, budget, obligation, payment, and goal changes offline.
3. Exercise pending, syncing, failed, retry, restored, and conflict states.
4. Introduce a later conflicting version and verify both snapshots survive.
5. Test keep local and keep later; dismiss without selecting.
6. Make a preview stale before confirmation and verify input is preserved for a new preview.

Expected outcome: local effects apply once, review-only records apply none, conflicts never count
both versions, no last-write-wins overwrite occurs, and recovery exposes no raw error.

## Scenario 7: Privacy, Language, Theme, and Access

Repeat Scenarios 1-6 across this minimum matrix:

| Dimension | Required values |
|---|---|
| Language | Arabic RTL, English LTR |
| Theme | Light, dark |
| Device | 320x568 logical phone, large phone, adaptive tablet |
| Text | Default, 200% |
| Screen reader | TalkBack; VoiceOver on macOS/iOS |
| Motion | Standard, reduced |
| Visual meaning | Full color and grayscale |
| Sensitive values | Visible and globally hidden |

Inspect salary, budget, obligation, payment review, timeline, goal, Home preview, More links,
dialogs, keyboard-open forms, external notifications, and app-switcher previews.

Expected outcome: no amount, date, status, allocation, warning, validation, or primary action is
hidden; mixed-direction values read naturally; focus is logical; touch targets pass; masked
values are not announced; color, motion, icons, charts, and haptics are never required for meaning.

## Performance Fixture

Use 24 months, 500 ledger transactions, 24 budgets, 100 category budgets, 50 obligations with
schedule/payment history, and 50 goals with movements.

Expected outcome:

- First useful local planning overview appears within 1 second after hydration.
- A month, filter, or detail change produces a local result within 300 ms.
- A 100-row obligation/payment or goal history scroll remains responsive without rendering the
  entire list at once.
- No calculation runs separately inside every rendered row.

## Financial Invariants

- Actual salary cycles start only from active confirmed primary receipt links.
- Suggested daily amount is unavailable for overdue, incomplete, zero-day, or deficit cases.
- Effective monthly limit equals configured limit plus frozen positive rollover credit.
- Active category limits never exceed the effective monthly limit.
- Eligible spend includes each ledger effect once and names every missing-rate exclusion.
- Open-ended obligations never acquire a fabricated lifetime total.
- Completed installment count equals fully allocated schedule items, not paid amount divided by a
  nominal installment.
- One payment links one transaction; undo/correction recomputes from surviving canonical records.
- Payables and receivables are never netted.
- Goal movements change tracked progress only and never mutate an account balance.
- Failed, review-only, deleted, reversed, undone, and double-submitted effects do not change
  active totals.

## Evidence to Retain

- Automated output for all static, boundary, and test commands.
- Schema v4-to-v5 migration, atomicity, idempotency, and invariant results.
- Android device/emulator matrix with versions and TalkBack notes.
- iOS/VoiceOver evidence from macOS/Xcode; record as blocked rather than passed when unavailable.
- Arabic/English light/dark screenshots or UI trees for every critical route and failure state.
- Offline, conflict, missing-rate, payment undo, settlement, and goal no-balance-effect evidence.

## Stop Conditions

Do not mark SPEC-007 complete if any check shows:

- fabricated salary income, open-ended debt, forecast, conversion, or schedule behavior;
- a partial, duplicated, non-atomic, or unrecoverable linked financial effect;
- a budget, payment, or goal amount counted twice;
- a conflict overwriting or counting both snapshots without explicit resolution;
- a goal movement changing an account balance without a separately confirmed ledger action;
- sensitive content in analytics, logs, errors, notifications, app previews, or hidden-value
  accessibility output;
- unsupported iOS SMS behavior;
- Arabic/English, 200% text, screen-reader, contrast, keyboard, reduced-motion, or small-phone
  failure.
