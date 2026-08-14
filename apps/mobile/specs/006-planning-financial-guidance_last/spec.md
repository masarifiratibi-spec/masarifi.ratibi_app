# Feature Specification: Planning and Financial Guidance

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Turn the reviewed reference-app UX/UI analysis into the second of two Masarifi specifications: planning and guidance covering salary cycles, budgets, obligations, savings goals, reports, assistant guidance, and related preferences while preserving Masarifi's trust, RTL, accessibility, and Gulf Premium requirements."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan the Current Salary Cycle (Priority: P1)

As a user, I can understand income received, spending since salary, upcoming commitments, remaining money, budget position, and a practical daily allowance for the current cycle.

**Why this priority**: Salary-cycle awareness connects daily activity to the user's immediate financial plan without requiring manual calculation.

**Independent Test**: Provide salary, spending, upcoming obligation, and budget data, then verify that the user can explain the current position and reach each contributing detail.

**Acceptance Scenarios**:

1. **Given** a configured salary cycle, **When** its overview opens, **Then** the user sees cycle dates, received income, expenses, upcoming obligations, remaining amount, suggested daily amount, and previous-cycle comparison.
2. **Given** salary differs from the expected amount, **When** it is detected or entered, **Then** the difference is explained and remains correctable without silently rewriting the salary profile.
3. **Given** salary data is absent or incomplete, **When** the planning overview opens, **Then** setup guidance appears without fabricating a recommendation.
4. **Given** multiple currencies contribute to a total, **When** the cycle summary is shown, **Then** converted values are labeled as estimates and original amounts remain available.

---

### User Story 2 - Set and Monitor Budgets (Priority: P1)

As a user, I can establish monthly and category limits, see progress and forecasts, understand overspending, and open the transactions responsible for each result.

**Why this priority**: Budgets turn transaction history into a controllable near-term plan and are a primary prevention tool.

**Independent Test**: Create a monthly budget and category budgets, copy a prior period, cross alert thresholds, exceed a limit, and drill into related transactions.

**Acceptance Scenarios**:

1. **Given** no budget exists, **When** Budgets opens, **Then** an example-led empty state explains the value and offers create and copy-previous-period actions.
2. **Given** active budgets, **When** spending changes, **Then** current spend, remaining amount, progress, forecast, and threshold state update consistently.
3. **Given** a category is near or over its limit, **When** its card or detail opens, **Then** the state is explained in text and related transactions are reachable.
4. **Given** a copied prior budget, **When** the user reviews it, **Then** every copied amount remains editable before confirmation.

---

### User Story 3 - Control Obligations and Goals (Priority: P1)

As a user, I can manage installments, loans, debts, recurring bills, subscriptions, upcoming payments, and savings goals within one clear planning architecture.

**Why this priority**: Commitments and goals directly determine available money and must be represented with accurate progress and recoverable payment handling.

**Independent Test**: Add obligations and goals, record full/partial/overpayments and goal contributions/withdrawals, link transactions, and verify all totals, schedules, and statuses.

**Acceptance Scenarios**:

1. **Given** active obligations, **When** the overview opens, **Then** outstanding, due, paid, overdue, next-payment, progress, and review-required information is visible without replacing Masarifi's primary navigation.
2. **Given** a payment is partial or greater than expected, **When** it is recorded or detected, **Then** the user chooses the intended treatment before balances, installment counts, or principal change.
3. **Given** more than one obligation could match a detected payment, **When** matching completes, **Then** the item enters review and no obligation is silently updated.
4. **Given** a savings goal is active, paused, completed, or archived, **When** its detail opens, **Then** progress, remaining amount, timing, contribution history, and available actions match that state.
5. **Given** a goal reaches its target, **When** completion is confirmed, **Then** success feedback is calm, optional in motion, and does not pressure the user into gamified behavior.

---

### User Story 4 - Understand Reports and Trends (Priority: P1)

As a user, I can review financial performance for meaningful periods, understand charts through text, compare prior periods, and drill into the records behind each result.

**Why this priority**: Reports must explain behavior and support decisions rather than merely display attractive charts.

**Independent Test**: Review monthly, three-month, half-year, and annual datasets including dense, empty, insufficient, loading, failed, and multi-currency cases; verify summaries and drill-down.

**Acceptance Scenarios**:

1. **Given** sufficient financial data, **When** a report period is selected, **Then** income, expense, net cash flow, category, account, budget, obligation, savings, and comparison summaries update to that period.
2. **Given** a chart is presented, **When** the user reads visually or through assistive technology, **Then** an equivalent text summary communicates the trend, extrema, comparison, and relevant totals.
3. **Given** a user selects a category, account, obligation, merchant, or month, **When** drill-down opens, **Then** the destination is already filtered to the contributing data.
4. **Given** data is insufficient, loading fails, or no records exist, **When** Reports opens, **Then** the state is explicitly named and offers an appropriate recovery or next action.
5. **Given** scheduled report delivery is configured, **When** its status changes, **Then** last, next, sending, sent, failed, verification-required, retry, and paused states remain understandable.

---

### User Story 5 - Receive Safe, Explainable Guidance (Priority: P1)

As a consenting user, I can ask concrete financial questions, understand whether an answer is fact, estimate, or suggestion, inspect the supporting data, and confirm any proposed change before it occurs.

**Why this priority**: Guidance is valuable only when it stays grounded in the user's data and cannot mutate financial records invisibly.

**Independent Test**: Ask direct, comparison, planning, insufficient-data, and action-producing questions; verify provenance, uncertainty, privacy controls, preview, confirmation, and failure behavior.

**Acceptance Scenarios**:

1. **Given** a user has not enabled personalization, **When** Assistant opens, **Then** a concise privacy explanation and consent choice appear before personal financial data is used.
2. **Given** sufficient data, **When** the user asks a supported question, **Then** the answer identifies its period, relevant values, and whether it is a fact, estimate, or suggestion.
3. **Given** insufficient or conflicting data, **When** an answer is requested, **Then** the assistant says what is missing and does not invent balances, totals, or certainty.
4. **Given** the assistant proposes a budget, goal, reminder, link, or other record change, **When** the user proceeds, **Then** an exact preview and explicit confirmation occur before the change.
5. **Given** the user disables personalization or deletes conversation history, **When** the action completes, **Then** the new privacy state is clearly confirmed and future behavior reflects it.

---

### User Story 6 - Control Planning Preferences and Feedback (Priority: P2)

As a user, I can control notification categories, report delivery, planning defaults, assistant personalization, and privacy through concise grouped settings.

**Why this priority**: Preferences keep guidance useful and non-intrusive, but they support rather than replace the primary financial tasks.

**Independent Test**: Change each related preference in Arabic and English, test dependent states, and verify that financial tasks remain dominant over subscription or promotional content.

**Acceptance Scenarios**:

1. **Given** related settings, **When** the user opens More, **Then** planning, report, notification, assistant, privacy, and security destinations are grouped with clear subtitles and current status where useful.
2. **Given** a notification preference is disabled, **When** the corresponding event occurs, **Then** the user's choice is respected while essential security communication remains separately identified.
3. **Given** lock-screen privacy is enabled, **When** financial notifications or app previews appear, **Then** sensitive amounts and identifying details remain hidden.
4. **Given** a promotional or subscription surface exists elsewhere, **When** the user performs a planning task, **Then** promotion does not obscure the financial answer or primary action.

### Edge Cases

- Salary arrives early, late, more than once, in a different amount, or not at all during a cycle.
- A budget period changes after copying, a category is archived, a transaction is reclassified, or a refund changes actual spend.
- A budget has zero limit, no spending, an amount over 100%, or a forecast based on too little data.
- An obligation has no fixed schedule, is overdue, paused, paid early, partially paid, overpaid, corrected, or denominated in another currency.
- A detected payment matches zero, one, or several obligations, or duplicates a manual payment.
- A goal contribution is reversed, a withdrawal exceeds current savings, the target date passes, or the linked account is archived.
- A report has sparse, dense, delayed, conflicting, or multi-currency data; comparisons lack a complete prior period.
- Chart labels, legends, or values become long in Arabic or at 200% text scaling.
- Scheduled report delivery lacks a verified email, fails repeatedly, or is changed while sending.
- The assistant receives an ambiguous date range, unsupported advice request, unavailable data, conflicting records, or a request to make several changes.
- The user revokes assistant consent during an active conversation or hides balances before an answer is announced.
- The app is offline while recording a payment, contribution, preference, or assistant-confirmed action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Planning capabilities MUST remain within Masarifi's approved navigation: Reports is primary, while budgets, obligations, goals, assistant, and related settings are reached from Home, More, contextual links, or report drill-down.
- **FR-002**: The salary-cycle overview MUST show cycle dates, received income, expenses, upcoming obligations, remaining amount, suggested daily amount, and previous-cycle comparison.
- **FR-003**: Salary setup MUST support amount, currency, salary day, source, receiving account, next date, and optional automatic-detection preference.
- **FR-004**: A detected salary difference MUST be explained and correctable without silently changing the expected salary profile.
- **FR-005**: Monthly budgets MUST support expense limit, income target, savings target, optional rollover, copy-previous-period, progress, remaining amount, forecast, and comparison.
- **FR-006**: Category budgets MUST support category, limit, alert threshold, current spend, remaining amount, percentage, forecast, related transactions, edit, pause, and delete.
- **FR-007**: Budget states MUST distinguish no budget, example, healthy, threshold reached, near limit, exceeded, paused, loading, error, offline, and pending synchronization.
- **FR-008**: Example budget content MUST be visibly labeled as an example and excluded from totals, charts, and screen-reader financial summaries.
- **FR-009**: Copying a prior budget MUST produce an editable review state and MUST NOT commit copied amounts without confirmation.
- **FR-010**: Budget progress, alerts, and forecasts MUST be explained with text and values rather than color or animation alone.
- **FR-011**: Obligations MUST use one architecture containing overview, installments and loans, debts, recurring bills, subscriptions, upcoming payments, and payment history.
- **FR-012**: The obligations overview MUST show outstanding, due this month, paid this month, overdue, next payment, active count, progress, timeline, and linked payments requiring review.
- **FR-013**: Users MUST be able to add and edit an obligation's type, provider, totals, currency, installment values, schedule, funding account, matching preference, reminders, and notes.
- **FR-014**: Obligation detail MUST show total, paid, remaining, progress, installments, next due date, schedule, linked transactions, matching status, and payment history.
- **FR-015**: Users MUST be able to record full, partial, over, and early payments and understand the proposed effect before confirmation.
- **FR-016**: A partial payment MUST preserve the unpaid remainder, and completed installment count MUST change only when the applicable payment rule is satisfied.
- **FR-017**: An overpayment MUST require the user to choose whether it covers multiple installments, reduces principal, or corrects a prior record.
- **FR-018**: Ambiguous or duplicate obligation matches MUST enter review; no obligation or transaction MAY be silently updated.
- **FR-019**: Confirmed obligation payments MUST update the linked transaction, paid and remaining totals, installment count, next due date, and relevant summaries consistently.
- **FR-020**: Savings goals MUST support active, paused, completed, emergency-fund, and archived states.
- **FR-021**: Goal creation MUST support title, target, current amount, currency, target date, linked account, named icon, contribution suggestion, and emergency-fund status.
- **FR-022**: Goal detail MUST show progress, remaining amount, time remaining, required monthly saving, contribution history, add, withdraw, pause, complete, and archive actions.
- **FR-023**: Goal identity and progress MUST NOT depend on emoji, color, celebration, or animation alone.
- **FR-024**: Reports MUST support monthly, three-month, half-year, and annual periods, with custom, salary-cycle, and month-to-date periods available only when data and product context support them.
- **FR-025**: Every report MUST clearly present income, expense, net cash flow, savings rate, obligation payments, largest category and transaction, and previous-period comparison when data permits.
- **FR-026**: Reports MUST provide category spending, account activity, merchant activity, budget performance, obligation payments, savings progress, and salary-cycle summaries relevant to the selected period.
- **FR-027**: Every chart MUST provide an equivalent accessible text summary and MUST remain understandable without color.
- **FR-028**: Report drill-down MUST open the corresponding category, account, obligation, merchant, month, or transaction set with the relevant filter context preserved.
- **FR-029**: Reports MUST distinguish loading, empty, insufficient-data, error, offline, stale, and ready states and provide an appropriate next action.
- **FR-030**: Scheduled report delivery settings MUST support frequency, recipient, language, currency, delivery day, summary/detail choice, test, send-now, and pause controls.
- **FR-031**: Delivery status MUST communicate last sent, next scheduled, sending, sent, failed, verification required, retry, and paused states without exposing sensitive contents.
- **FR-032**: Assistant personalization MUST require informed consent and MUST be independently disableable from general app use.
- **FR-033**: Assistant Home MUST provide concrete suggested questions grounded in supported Masarifi data rather than generic promotional prompts.
- **FR-034**: Assistant answers MUST identify relevant period and source values and distinguish direct facts, comparisons, estimates, explanations, and suggestions.
- **FR-035**: The assistant MUST state when data is insufficient or conflicting and MUST NOT invent balances, transactions, obligations, forecasts, or certainty.
- **FR-036**: The assistant MUST NOT provide investment advice or use judgmental, shaming, or novelty-roasting language.
- **FR-037**: Any assistant-proposed financial or preference change MUST show an exact preview, require explicit confirmation, and report success or actionable failure.
- **FR-038**: Users MUST be able to inspect, rename, delete, and clear conversation history and understand the effect of personalization and history controls.
- **FR-039**: Planning, report, assistant, and notification preferences MUST be grouped with clear labels, concise subtitles, current state, and a separate privacy path.
- **FR-040**: Financial notifications MUST support category controls, quiet preferences where applicable, linked destinations, and a hide-sensitive-data option; security notifications MUST remain semantically distinct.
- **FR-041**: Sensitive values MUST remain maskable in-app and hidden from notifications, errors, analytics, app-switcher previews, and assistant content when privacy mode requires it.
- **FR-042**: All planning and guidance surfaces MUST provide Arabic RTL and English LTR parity, English numerals with locale-aware formatting, intentional mixed-direction handling, and logical reading/focus order.
- **FR-043**: All controls MUST meet the 44-by-44 minimum target, content MUST remain usable at 200% text size, and financial summaries MUST be announced as coherent meaning rather than fragmented labels.
- **FR-044**: Reduced-motion mode MUST preserve every navigation, loading, chart, progress, success, and confirmation outcome without spatial animation being required for comprehension.
- **FR-045**: All surfaces MUST use Masarifi's Gulf Premium dark-teal identity, semantic financial/status colors, restrained gradients, borders before shadows, clean cards, and calm practical language.
- **FR-046**: Household collaboration, investments, sports/event modes, AI roasting, dominant paywalls, and reference branding MUST NOT be introduced by this feature.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Planning remains usable with manual records and offline states on both platforms. Android-detected salary or obligation payments use the established review/undo contract; iOS never implies direct SMS access. Assistant and report delivery failures do not block local financial planning.
- **Financial trust**: Original amounts remain available, converted totals are labeled as estimates, ambiguous matches enter review, and partial/overpayment rules require confirmation. Assistant actions always show exact previews and require explicit confirmation.
- **Localization and accessibility**: Arabic RTL and English LTR are complete for every state. English numerals, mixed financial values, charts, progress, tabs, sheets, and forms receive intentional bidirectional behavior. Text scaling, contrast, screen readers, non-color meaning, touch targets, and reduced motion are mandatory.
- **UI states and tokens**: Existing semantic Gulf Premium tokens and components remain authoritative. Every applicable loading, example, empty, insufficient-data, error, offline, stale, disabled, review, permission, delivery, and sync state is represented without a parallel visual language.
- **Verification**: Checks cover planning calculations, payment cases, assistant confirmation, privacy, dense reports, chart summaries, Arabic and English, light and dark modes, small and large phones, 200% text, screen readers, reduced motion, offline behavior, and notification masking.

### Key Entities *(include if feature involves data)*

- **Salary Profile**: Expected salary amount, currency, day, source, receiving account, next date, and detection preference used to define a salary cycle.
- **Salary Cycle**: A bounded period with received income, spending, upcoming obligations, remaining amount, suggested daily amount, and comparison state.
- **Budget**: A monthly or category plan with limit or target, period, threshold, current value, remaining amount, forecast, rollover, and active state.
- **Obligation**: A loan, installment, debt, recurring bill, subscription, or custom commitment with provider, amounts, schedule, account, matching state, reminders, and status.
- **Obligation Payment**: A full, partial, over, or early payment linked to an obligation and transaction, with its effect and review status.
- **Savings Goal**: A target with current amount, currency, date, linked account, contribution history, recommendation, and lifecycle state.
- **Report**: A period-bound explanation of income, expense, cash flow, categories, accounts, budgets, obligations, savings, comparisons, and data sufficiency.
- **Report Delivery Preference**: Recipient, cadence, language, currency, content scope, delivery day, verification, and delivery status.
- **Assistant Conversation**: A consent-bound exchange containing questions, grounded answers, source period, fact/estimate/suggestion labels, proposed actions, and history/privacy state.
- **Proposed Action**: An assistant-suggested change with exact before/after preview, confirmation state, outcome, and failure recovery.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users identify salary-cycle remaining money, next obligation, and budget status within 15 seconds without assistance.
- **SC-002**: At least 90% of users create or copy and confirm a monthly budget in 90 seconds or less on their first attempt.
- **SC-003**: At least 90% of users correctly interpret healthy, near-limit, and over-limit budgets in grayscale and at 200% text size.
- **SC-004**: 100% of tested partial, over, early, ambiguous, and duplicate payment cases require the intended review or confirmation before changing obligation progress.
- **SC-005**: At least 90% of users can explain an obligation's remaining amount, next due date, and payment progress within 20 seconds of opening its detail.
- **SC-006**: For every chart used in acceptance testing, users can obtain the same essential trend, comparison, extrema, and total information from accompanying text.
- **SC-007**: At least 90% of users reach the transactions behind a report category, account, obligation, merchant, or period in two actions or fewer from the relevant report element.
- **SC-008**: 100% of assistant answers in the acceptance dataset identify fact, estimate, or suggestion appropriately; zero insufficient-data cases invent a financial value.
- **SC-009**: 100% of assistant-proposed changes show an exact preview and require explicit confirmation; zero rejected proposals alter financial or preference data.
- **SC-010**: All critical flows complete in Arabic RTL and English LTR at 200% text size without hiding amounts, status, chart summaries, validation, or primary actions.
- **SC-011**: In usability testing, at least 85% of users rate planning explanations and assistant guidance as calm, clear, and trustworthy.
- **SC-012**: All tested notification and app-preview scenarios respect the configured sensitive-data masking state.

## Assumptions

- The companion Daily Money Control specification owns Home, accounts, transaction ledger and entry, categories, capture permissions, automatic review, and voice proposal creation; this feature consumes those financial records and links back to them.
- This specification consolidates the planning and guidance portions of master SPEC-007, SPEC-008, and the relevant assistant/notification/settings portions of SPEC-009 into one independently plannable delivery unit.
- Existing authentication, onboarding, security, navigation meanings, localization, privacy masking, and design-system foundations are retained rather than redesigned.
- Report delivery, assistant responses, automatic matching, notifications, and synchronization use replaceable non-production behavior during the frontend phase.
- Subscription purchase flows, dominant paywalls, general support/ticketing, import/export, account deletion, release notes, investments, household collaboration, event promotions, and camera capture remain outside this feature and require separate scope.
- Reference examples establish quality and hierarchy only; their colors, terminology, navigation taxonomy, promotional features, and incomplete RTL behavior are not product requirements.
