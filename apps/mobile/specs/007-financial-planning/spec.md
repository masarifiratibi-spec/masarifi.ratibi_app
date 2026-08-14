# Feature Specification: Salary, Budgets, Obligations, Debts, Installments, and Savings

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create SPEC-007 - Salary, Budgets, Obligations, Debts, Installments, and Savings from the complete Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-09

- Q: What defines a salary cycle when salary arrives early or late? → A: A confirmed primary
  salary receipt starts the cycle; expected salary dates remain projections, and a missing or
  late salary is shown as overdue without fabricating income.
- Q: How should budgets handle multiple currencies? → A: Each monthly budget uses one selected
  currency inherited by its category budgets; foreign spending uses labeled conversion
  estimates, and missing conversion data makes progress explicitly incomplete.
- Q: How should category limits relate to the monthly expense limit? → A: Allow one active limit
  per category per month, permit an unallocated remainder, and prevent active category limits
  from exceeding the monthly expense limit in total.
- Q: How should open-ended recurring bills affect outstanding totals? → A: Include remaining
  contracted balances for fixed-term obligations; include only confirmed due or overdue payments
  for open-ended bills and subscriptions, never an invented lifetime total.
- Q: Should adding or withdrawing goal money change an account automatically? → A: No. Goal
  movements update tracked goal progress only by default; users may explicitly link an existing
  transaction or transfer, but no account balance changes silently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the Current Salary Cycle (Priority: P1)

As a user, I can set up my salary and immediately understand what I received, what I spent,
what is due, what remains, and a practical daily amount until the next salary.

**Why this priority**: Salary-cycle awareness is the clearest connection between income,
current spending, commitments, and day-to-day decisions.

**Independent Test**: Configure a salary profile, record normal and unusual salary income, and
verify the cycle summary, correction path, comparisons, and missing-data states.

**Acceptance Scenarios**:

1. **Given** a complete salary profile and current-cycle activity, **When** the salary overview
   opens, **Then** it shows cycle dates, next salary date, days remaining, received income,
   expenses, upcoming obligations, remaining amount, suggested daily amount, and previous-cycle
   comparison without requiring manual calculation.
2. **Given** no salary profile exists, **When** the overview opens, **Then** the user sees a calm
   setup explanation and can continue using all other planning features.
3. **Given** a detected salary differs from the expected amount or date, **When** it is reviewed,
   **Then** the actual income can be linked to the current cycle without silently changing the
   expected salary profile.
4. **Given** a salary record is corrected or undone, **When** the action completes, **Then** the
   linked income, cycle totals, remaining amount, and dependent summaries are restored
   consistently.

---

### User Story 2 - Set and Monitor Budgets (Priority: P1)

As a user, I can create a monthly plan and category limits, see current progress and forecasts,
and reach the transactions responsible for each result.

**Why this priority**: Budgets turn recorded activity into an actionable spending boundary
before the month is over.

**Independent Test**: Create, copy, edit, pause, exceed, and delete monthly and category budgets;
verify calculations, thresholds, forecast states, and transaction drill-down.

**Acceptance Scenarios**:

1. **Given** no budget exists for the month, **When** Budgets opens, **Then** the user can create
   one or copy the previous month, and copied values remain editable before confirmation.
2. **Given** an active monthly budget, **When** eligible spending changes, **Then** progress,
   remaining amount, forecast, savings target, and comparison update consistently.
3. **Given** a category reaches an enabled alert threshold or exceeds its limit, **When** the
   budget is shown, **Then** the exact amount, percentage, state, and related transactions are
   understandable without relying on color.
4. **Given** a refund, reversal, reclassification, or deleted transaction changes eligible
   spending, **When** budget progress refreshes, **Then** the result is recalculated once without
   double-counting.
5. **Given** the user moves an amount between category budgets, **When** the change is previewed,
   **Then** both affected limits and the unchanged overall monthly limit are clear before save.

---

### User Story 3 - Manage All Commitments in One Place (Priority: P1)

As a user, I can see and maintain installments, loans, debts, recurring bills, subscriptions,
and upcoming payments through one obligations section.

**Why this priority**: A single commitments view prevents fragmented totals and lets users
understand what is owed, due, overdue, or expected back.

**Independent Test**: Add each supported obligation type, inspect overview and detail states,
edit schedules, pause and close obligations, and verify totals and navigation.

**Acceptance Scenarios**:

1. **Given** several active obligations, **When** the overview opens, **Then** it shows amounts
   outstanding, due, paid, and overdue; the next payment; active count; progress; timeline; and
   linked payments requiring review.
2. **Given** both money the user owes and money owed to the user, **When** totals are shown,
   **Then** payable and receivable amounts are labeled separately and are not silently netted.
3. **Given** the user adds an obligation, **When** a type is selected, **Then** only financially
   relevant amount, schedule, account, matching, reminder, and note fields are requested.
4. **Given** an obligation is paused, closed, completed, or overdue, **When** its detail opens,
   **Then** its status, remaining amount, history, allowed actions, and effect on upcoming totals
   are explicit.

---

### User Story 4 - Record and Match Obligation Payments Safely (Priority: P1)

As a user, I can record a full, partial, over, or early obligation payment manually or review a
detected payment, understanding every effect before it changes my records.

**Why this priority**: Payment handling changes both the ledger and debt progress, so mistakes
must be prevented, reviewable, and reversible.

**Independent Test**: Record each payment case, exercise zero, one, multiple, and duplicate
matches, and verify transaction, obligation, schedule, summary, and undo effects.

**Acceptance Scenarios**:

1. **Given** an active obligation, **When** a valid full payment is confirmed, **Then** one linked
   expense and one obligation payment are recorded, paid and remaining amounts update, the
   completed installment count advances when applicable, and the next due date is shown.
2. **Given** a payment is less than the amount currently due, **When** it is confirmed as partial,
   **Then** the unpaid remainder remains visible and the completed installment count does not
   advance until that installment is fully covered.
3. **Given** a payment is greater than the amount currently due, **When** it is reviewed, **Then**
   the user must choose whether it covers later installments, reduces principal, or corrects a
   previous record before totals change.
4. **Given** a detected payment has one clear obligation match, **When** it is added, **Then** both
   the transaction and obligation update and an immediate view, edit, and undo path is available.
5. **Given** a detected payment has multiple or duplicate candidate matches, **When** analysis
   completes, **Then** it enters review and no transaction or obligation progress changes
   silently.
6. **Given** an early settlement is proposed, **When** the user reviews it, **Then** the estimated
   settlement amount, closure effect, and preserved payment history are clear before confirmation.

---

### User Story 5 - Build and Adjust Savings Goals (Priority: P2)

As a user, I can create a savings goal, track progress, add or withdraw money, and understand the
monthly contribution needed to reach the target.

**Why this priority**: Goals connect financial awareness to positive progress, after salary,
budgets, and required commitments are understandable.

**Independent Test**: Create regular and emergency-fund goals, add and withdraw money, pass the
target date, complete, pause, and archive goals, and verify every progress state.

**Acceptance Scenarios**:

1. **Given** a target amount and date, **When** a goal is created, **Then** progress, remaining
   amount, time remaining, and the required monthly contribution are understandable.
2. **Given** a goal is linked to an account, **When** money is added or withdrawn, **Then** the
   proposed effect on the goal and linked financial record is shown before confirmation.
3. **Given** a withdrawal exceeds the goal's recorded amount, **When** the user attempts it,
   **Then** saving is blocked with the available amount and a corrective action.
4. **Given** the target is reached, **When** completion is shown, **Then** the user receives a
   calm, optional-motion success state and may complete, continue, or archive the goal.
5. **Given** a target date has passed before completion, **When** the goal opens, **Then** the user
   can revise the date, revise the amount, pause, or continue without judgmental language.

---

### User Story 6 - Keep Planning Usable During Problems (Priority: P1)

As a user, I can review planning information and safely recover from missing, stale, offline,
conflicting, or failed states without losing entered financial data.

**Why this priority**: Planning is only trustworthy when incomplete data and interrupted changes
are visible rather than presented as final truth.

**Independent Test**: Exercise loading, empty, partial, stale, error, offline, pending, failed,
conflict, archived, and read-only states in Arabic and English with large text and hidden values.

**Acceptance Scenarios**:

1. **Given** planning data is incomplete or stale, **When** a summary appears, **Then** its data
   status and unavailable calculation are named and no unsupported amount is fabricated.
2. **Given** the device is offline, **When** the user saves an eligible planning change, **Then**
   entered data is preserved and the pending state is visible until synchronization succeeds or
   the user resolves a conflict.
3. **Given** a save fails, **When** recovery is shown, **Then** the user can retry or continue
   editing without duplicate financial effects or raw error details.
4. **Given** sensitive values are hidden, **When** planning screens are read visually or by a
   screen reader, **Then** amounts remain masked and no accessible label reveals them.

### Edge Cases

- Salary arrives early, late, more than once, not at all, or with an amount or currency different
  from the profile.
- A configured salary day does not exist in a shorter month, or the expected date crosses a
  year or timezone boundary.
- The salary cycle has no expenses, no upcoming obligations, a negative remainder, or too little
  history for a previous-cycle comparison.
- A budget limit or target is zero, spending exceeds 100%, a forecast has insufficient history,
  or rollover is changed after the next period begins.
- A category is archived or merged, a transaction moves categories, or a refund partially
  reverses eligible spending.
- A budget move would make a category limit lower than its already recorded spending.
- An obligation has no fixed schedule, no end date, changing installments, a balloon payment,
  another currency, or a linked account that becomes archived.
- Money owed by the user and money owed to the user coexist and must not be combined into one
  misleading debt total.
- A payment is zero, negative, duplicated, reversed, larger than the obligation remainder, or
  dated before the obligation starts or after it closes.
- A payment matches no obligation, one obligation, several obligations, or a payment already
  recorded manually.
- An automatic payment is undone after it advanced an installment or completed an obligation.
- A savings contribution is reversed, a withdrawal exceeds recorded savings, the target amount
  is reduced below current progress, the date passes, or the linked account is archived.
- Converted multi-currency totals lack a current estimate or contain a mix of payable and
  receivable values.
- Long Arabic labels, mixed-direction provider names, hidden values, or 200% text size could
  obscure amounts, status, progress, or primary actions.

## Requirements *(mandatory)*

### Scope Boundaries

This specification owns salary setup and cycles; monthly and category budgets; the obligations
overview and lifecycle for installments, loans, debts, recurring bills, subscriptions, and
upcoming payments; manual and detected obligation-payment effects; and savings-goal lifecycle
and progress.

It consumes accounts, transactions, categories, automatic review, manual entry, and voice
proposals from SPEC-004 through SPEC-006. Reports and email delivery belong to SPEC-008.
Notification-center preferences and delivery, assistant conversations and actions,
subscriptions, and support belong to SPEC-009. This specification may emit planning events and
provide summaries to those features but does not own their full experiences. Investments,
production financial integrations, and camera or receipt capture are outside scope.

### Functional Requirements

- **FR-001**: Salary setup MUST support expected amount, currency, salary day, source name,
  receiving account, next expected date, and an optional automatic-detection preference.
- **FR-002**: Salary setup MUST remain optional and MUST NOT block budgets, obligations, savings,
  transactions, or the rest of the application.
- **FR-003**: A confirmed primary salary receipt MUST start the current salary cycle, which
  continues until the next confirmed primary salary receipt. The cycle MUST show its start,
  projected next salary date, days remaining, income received, expenses since salary, upcoming
  obligations, remaining amount, suggested daily amount, and previous-cycle comparison when
  sufficient data exists.
- **FR-004**: Expected salary dates MUST remain projections rather than financial records. When
  salary is missing or late, the current cycle MUST show an overdue-salary state, MUST NOT
  fabricate income, and MUST NOT present a suggested daily amount as reliable.
- **FR-005**: When the configured salary day is absent from a month, the expected salary date MUST
  use that month's last calendar day and explain the adjustment when the date is edited.
- **FR-006**: A detected salary MUST create or link the income transaction, link it to the salary
  profile, update the active cycle, and provide visible source, correction, and undo actions.
- **FR-007**: A detected salary amount or date that differs from the profile MUST NOT silently
  replace the expected salary; the user MUST be able to keep the difference for this cycle or
  explicitly update future expectations.
- **FR-008**: Multiple possible salary records or conflicting salary matches MUST require review
  before the salary cycle changes.
- **FR-009**: Monthly budgets MUST support one selected currency, expense limit, income target,
  savings target, optional rollover, copy previous month, progress, remaining amount, forecast,
  and previous-period comparison. Category budgets MUST inherit the monthly budget currency.
- **FR-010**: Category budgets MUST support category, limit, enabled alert thresholds, current
  spend, remaining amount, percentage, forecast, related transactions, amount moves, edit,
  pause, and delete. Each category MAY have at most one active limit in a monthly budget.
- **FR-011**: Copying a previous budget MUST create an editable review and MUST NOT commit copied
  values until the user confirms them.
- **FR-012**: Rollover MUST be off by default. When enabled, only the prior month's positive
  unspent expense limit carries forward; overspending MUST NOT silently reduce the next month's
  limit.
- **FR-013**: Moving a budget amount between categories MUST preview both category limits and
  MUST NOT change the overall monthly expense limit. The sum of active category limits MUST NOT
  exceed that monthly limit, while any remainder MAY stay unallocated.
- **FR-014**: Budget calculations MUST count eligible expenses once, subtract linked refunds and
  reversals, exclude transfers between the user's accounts, and update when a transaction is
  edited, deleted, reclassified, undone, or synchronized. Eligible foreign-currency activity
  MUST use a labeled conversion estimate; when no estimate exists, progress MUST be marked
  incomplete rather than silently excluding the activity.
- **FR-015**: Obligation payments MUST be counted once in budget spending according to their
  linked category and MUST NOT be counted again merely because they also update obligation
  progress.
- **FR-016**: Budget states MUST distinguish no budget, healthy, threshold reached, near limit,
  exceeded, paused, loading, error, offline, and pending synchronization.
- **FR-017**: Budget progress, thresholds, forecasts, and comparisons MUST be communicated with
  text and financial values rather than color, shape, motion, or percentage alone.
- **FR-018**: The feature MUST make the 50-percent alert optional and support enabled alerts at
  80 percent, 90 percent, limit exceeded, unusual spending, and period ending, subject to the
  user's notification preferences.
- **FR-019**: The Obligations section MUST contain Overview, Installments and Loans, Debts,
  Recurring Bills, Subscriptions, Upcoming Payments, and Payment History.
- **FR-020**: The obligations overview MUST show total payable outstanding, receivable amounts
  separately, due this month, paid this month, overdue amount, next payment, active count,
  progress by obligation, timeline or calendar, and linked payments requiring review. Total
  outstanding MUST include remaining contracted balances for fixed-term obligations but MUST
  exclude hypothetical future amounts for open-ended bills and subscriptions; only their
  confirmed due or overdue payments contribute to due totals.
- **FR-021**: Users MUST be able to add the supported car installment, personal loan, buy-now-pay-
  later, credit-card installment, rent, utility, subscription, debt owed, money owed to the user,
  and custom obligation types.
- **FR-022**: Obligation creation and editing MUST support the applicable title, type, provider,
  total, paid, remaining, currency, installment amount and count, paid count, due day, start and
  end dates, funding account, automatic matching preference, provider keywords, reminder timing,
  and notes.
- **FR-023**: The experience MUST avoid asking for fields that do not apply to the selected
  obligation type and MUST explain any derived paid, remaining, count, or schedule value before
  save.
- **FR-024**: Obligation detail MUST show total, paid, remaining, progress, installment status,
  next due date, payment schedule, linked transactions, provider, funding account, matching
  status, and payment history.
- **FR-025**: Eligible obligation actions MUST include record payment, edit, pause, close, add or
  change reminder, link a detected transaction, view permitted source details, make an early
  payment, and mark completed.
- **FR-026**: Paused, closed, completed, archived, and overdue obligations MUST remain
  distinguishable and MUST contribute to current totals only according to their stated status.
- **FR-027**: A manual obligation payment MUST capture amount, date, account, payment method,
  notes, payment case, and an existing or newly created transaction link.
- **FR-028**: Confirming a payment MUST add or link exactly one expense transaction and one
  obligation-payment record, then update paid amount, remaining amount, applicable installment
  count, next due date, and dependent summaries as one consistent outcome.
- **FR-029**: A partial payment MUST leave the current installment's unpaid remainder visible and
  MUST NOT advance the completed installment count until payments allocated to that installment
  meet its scheduled amount.
- **FR-030**: An overpayment MUST require a choice between covering later installments, reducing
  principal, or correcting a prior record; no interpretation MAY be selected silently.
- **FR-031**: A payment greater than the entire remaining obligation MUST be blocked unless the
  excess is explicitly resolved as a correction or another valid destination before save.
- **FR-032**: Early settlement MUST show the available estimated settlement amount and closure
  effect, require confirmation, and preserve the complete payment history.
- **FR-033**: Automatic payment matching MUST present provider, amount, date, account hint, last
  four digits, reference, and closest due installment when those signals are available.
- **FR-034**: One clear detected match MAY update both the transaction and obligation, but it
  MUST expose source, view, edit, and undo; zero, multiple, conflicting, or duplicate matches
  MUST enter review without a financial change.
- **FR-035**: Editing, deleting, unlinking, reversing, or undoing an obligation payment MUST
  restore the transaction, paid and remaining totals, installment count, next due date, status,
  and summaries consistently.
- **FR-036**: Savings goals MUST support active, paused, completed, emergency-fund, and archived
  states.
- **FR-037**: Goal creation MUST support title, target amount, current amount, currency, target
  date, linked account, accessible named icon, monthly contribution suggestion, and emergency-
  fund status.
- **FR-038**: Goal detail MUST show progress, remaining amount, time remaining, required monthly
  saving, contribution history, and add, withdraw, pause, complete, and archive actions.
- **FR-039**: Goal contributions and withdrawals MUST preview their effect on goal progress and
  update tracked goal progress only by default. Users MAY explicitly link an existing transaction
  or transfer, but the goal action MUST NOT create or change an account balance silently and MUST
  NOT count the same movement twice in balances, budgets, or reports.
- **FR-040**: A withdrawal MUST NOT exceed the goal's recorded current amount, and reducing a
  target below current progress MUST require the user to confirm how completion is represented.
- **FR-041**: Goal completion MUST use calm language, optional motion, and no required
  celebration, streak, ranking, or other gamification.
- **FR-042**: All converted multi-currency planning totals MUST be labeled as estimates, retain
  access to original amounts, and show an unavailable state when no conversion estimate exists.
- **FR-043**: Sensitive salary, budget, obligation, debt, installment, and savings values MUST
  follow the global hide-values setting and MUST NOT leak through notifications, app previews,
  analytics, raw errors, or accessibility labels.
- **FR-044**: Every planning surface MUST provide relevant initial, loading, success, empty,
  partial-data, error, offline, stale, pending-sync, sync-failed, conflict, read-only, disabled,
  paused, completed, and archived states.
- **FR-045**: Meaningful form data MUST survive validation errors, accidental navigation,
  temporary interruption, and recoverable save failure until the user saves or explicitly
  discards it.
- **FR-046**: Error and recovery messages MUST identify the user action available, preserve
  trustworthy existing data, and never expose internal or provider errors.
- **FR-047**: All screens and states MUST provide Arabic RTL and English LTR parity, use English
  numerals with locale-aware financial formatting, and handle mixed-direction amounts, dates,
  provider names, account names, and identifiers intentionally.
- **FR-048**: Controls MUST meet the 44-by-44 minimum target, content MUST remain usable at 200%
  text size, screen-reader focus MUST follow the task order, and status and progress MUST remain
  understandable without color, motion, iconography, or haptics alone.
- **FR-049**: The feature MUST use the established Masarifi Gulf Premium semantic hierarchy and
  calm, non-judgmental language without introducing a parallel visual or terminology system.
- **FR-050**: The frontend phase MUST demonstrate representative normal, empty, threshold,
  over-limit, overdue, partial-payment, overpayment, early-settlement, ambiguous-match,
  completed-goal, failed, offline, and sync-conflict states without claiming production backend,
  banking, notification-delivery, or payment-provider behavior.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Manual salary, budget, obligation, payment, and savings flows remain
  usable on Android and iOS. Android-detected salary and obligation payments use the established
  source, review, correction, and undo contract. iOS does not imply direct SMS access.
- **Financial trust**: Salary differences do not rewrite expectations silently; budget movements
  preserve the overall limit; payable and receivable amounts stay distinct; detected ambiguity
  enters review; and payment, contribution, withdrawal, correction, and undo effects remain
  explicit and consistent across linked records.
- **Localization and accessibility**: Every state is complete in Arabic RTL and English LTR.
  English numerals, mixed-direction financial content, 200% text, screen readers, minimum touch
  targets, reduced motion, and non-color meaning are acceptance requirements.
- **UI states and tokens**: Existing Gulf Premium semantic tokens and components remain
  authoritative. Relevant loading, empty, partial, error, offline, stale, disabled, review,
  pending, conflict, paused, completed, and archived states are required.
- **Verification**: Focused checks cover salary dates and cycle calculations, budget eligibility
  and rollover, all payment cases and reversals, goal contributions and withdrawals, currency
  estimates, privacy masking, both languages and themes, device sizes, accessibility, offline
  behavior, and synchronization conflicts.

### Key Entities *(include if feature involves data)*

- **Salary Profile**: The user's expected salary amount, currency, salary day, source, receiving
  account, next expected date, and automatic-detection preference.
- **Salary Cycle**: A bounded financial period with actual income, expenses, upcoming
  obligations, remaining amount, suggested daily amount, comparison, and data-sufficiency state.
- **Budget**: A monthly plan with one selected currency, expense, income, and savings targets,
  rollover choice, progress, forecast, comparison, and lifecycle state.
- **Category Budget**: A category-specific limit with alert thresholds, current eligible spend,
  remaining amount, forecast, inherited currency, and a unique category-and-month relationship
  to its monthly budget.
- **Obligation**: An installment, loan, debt, recurring bill, subscription, payable, receivable,
  or custom commitment with fixed-term or open-ended duration, amounts, schedule, account,
  matching settings, reminders, and state.
- **Obligation Payment**: A full, partial, over, early, reversed, or corrected payment linked to
  one obligation and one transaction, with an explicit allocation and schedule effect.
- **Payment Match**: A detected payment candidate with available matching signals, candidate
  obligations, duplicate evidence, confidence state, and review outcome.
- **Savings Goal**: A target with current amount, currency, date, linked account, contribution
  history, required monthly saving, emergency-fund status, and lifecycle state.
- **Goal Movement**: A confirmed contribution or withdrawal with its goal-progress effect and
  an optional explicit link to an existing transaction or transfer; it has no automatic account-
  balance effect.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users identify current-cycle remaining money, next salary date,
  next obligation, and suggested daily amount within 15 seconds without assistance.
- **SC-002**: At least 90% of first-time users complete salary setup in 90 seconds or less and
  can skip it without losing access to any other planning feature.
- **SC-003**: At least 90% of users create or copy, review, and confirm a monthly budget in 90
  seconds or less on their first attempt.
- **SC-004**: At least 90% of users correctly interpret healthy, threshold, near-limit, and
  exceeded budget states in grayscale and at 200% text size.
- **SC-005**: 100% of tested refunds, reversals, transfers, reclassifications, obligation
  payments, and undo actions produce one correct budget result without double-counting.
- **SC-006**: At least 90% of users identify an obligation's remaining amount, next due date,
  completed installments, and available payment action within 20 seconds.
- **SC-007**: 100% of tested partial, over, excessive, early, ambiguous, duplicate, corrected,
  and undone payments produce the specified review or confirmation and leave transaction,
  obligation, schedule, and summary values consistent.
- **SC-008**: At least 90% of users create a savings goal and understand its progress, remaining
  amount, target date, and required monthly contribution in 90 seconds or less.
- **SC-009**: 100% of tested goal contributions, withdrawals, reversals, completions, and target
  changes update goal and linked financial effects once, with no double-counting.
- **SC-010**: 100% of uncertain salary or payment matches enter review, while every clear
  automatic update exposes a working view, edit, and undo or correction path.
- **SC-011**: All critical flows complete in Arabic RTL and English LTR at 200% text size without
  hiding amounts, dates, status, progress, validation, review reasons, or primary actions.
- **SC-012**: In usability testing, at least 85% of users rate salary, budget, obligation,
  payment, and savings explanations as clear, calm, and trustworthy.

## Assumptions

- SPEC-001 through SPEC-006 provide the product principles, design components, navigation,
  authentication, accounts, transactions, categories, automatic review, manual entry, and voice
  proposal behavior consumed by this feature.
- Monthly budgets use calendar months. Salary-cycle summaries remain a separate view and do not
  silently redefine a monthly budget period.
- Rollover is disabled by default; when enabled it carries only positive unused expense limit to
  the next month unless a later product decision explicitly introduces deficit carryover.
- Completed installment count advances when the scheduled amount allocated to that installment
  has been fully covered; partial payments accumulate against that installment.
- Payable obligations and receivables are shown separately. Cross-currency aggregates are
  estimates and are unavailable when no conversion estimate exists.
- A goal tracks designated savings rather than moving money by itself. Any linked account or
  transaction effect is previewed and confirmed separately so the same movement is counted once.
- Automatic matching, synchronization, reminders, notification events, and financial data use
  representative non-production outcomes during the frontend phase.
- Reports, report email delivery, assistant conversations and actions, notification-center
  management, subscription purchase flows, investments, camera capture, receipt scanning,
  production providers, and direct bank connections remain outside scope.
