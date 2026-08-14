# Feature Specification: Reports and Automatic Email Delivery

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create SPEC-008 - Reports and Automatic Email Delivery from the complete Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-09

- Q: How should an in-progress current period be compared? → A: Match elapsed days only.
- Q: Which unresolved or unsynced transactions contribute to report totals? → A: Confirmed records only.
- Q: What appears in detailed email transaction rows? → A: Essential masked fields only.
- Q: What happens to a sent report after source data changes? → A: Preserve sent snapshots.
- Q: What report scale and response target should Core V1 meet? → A: Two seconds at 10,000 records.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand a Financial Period (Priority: P1)

As a user, I can open Reports and quickly understand my income, expenses, net cash flow,
savings rate, obligations, largest spending areas, and change from the previous period.

**Why this priority**: A trustworthy period summary is the core value of the dedicated Reports
tab and the foundation for every trend, drill-down, explanation, and delivery action.

**Independent Test**: Open reports with complete, partial, empty, and multi-currency data; switch
among the four required periods; and verify that every total, comparison, label, and unavailable
state explains the same underlying financial activity.

**Acceptance Scenarios**:

1. **Given** complete activity for a selected period, **When** Reports opens, **Then** it shows
   total income, total expense, net cash flow, savings rate, obligation payments, largest
   category, largest transaction, and an equal-length previous-period comparison.
2. **Given** the user selects monthly, last three months, half-year, or annual, **When** the
   report changes, **Then** all summary values, trends, comparisons, and drill-down destinations
   use that same period and clearly name its exact date range.
3. **Given** there is no eligible activity, **When** a report opens, **Then** it explains that no
   report can yet be calculated and offers paths to add or review transactions without showing
   fabricated zero-value insights.
4. **Given** only part of the period is available or some values cannot be converted, **When**
   the report opens, **Then** the affected results are labeled incomplete or estimated and the
   missing-data reason is available.

---

### User Story 2 - Explore Trends and Comparisons (Priority: P1)

As a user, I can understand how spending, income, budgets, obligations, savings, merchants, and
accounts changed over time without interpreting unexplained charts.

**Why this priority**: Reports become useful when they explain change, not merely repeat ledger
totals.

**Independent Test**: Review representative monthly, three-month, half-year, and annual reports
and verify period-specific questions, readable trends, accessible text summaries, and
insufficient-history behavior.

**Acceptance Scenarios**:

1. **Given** at least two comparable periods, **When** a comparison is shown, **Then** it states
   the current value, previous value, absolute change, percentage change when valid, and whether
   the direction is financially favorable, unfavorable, or neutral in context.
2. **Given** a three-month report, **When** trend details open, **Then** average monthly spending,
   category movement, recurring payments, spending volatility, and savings consistency are
   explained in text as well as visually.
3. **Given** a half-year or annual report, **When** the user reviews it, **Then** month-by-month
   change, highest and lowest spending months, budget consistency, obligation or debt progress,
   savings progression, and subscription impact are shown when sufficient data exists.
4. **Given** insufficient history for a trend or comparison, **When** the report renders, **Then**
   it names the unavailable insight and the minimum missing history rather than inventing a
   percentage or treating missing data as zero.

---

### User Story 3 - Verify a Report Through Drill-Down (Priority: P1)

As a user, I can move from any reported category, account, obligation, merchant, or month to the
financial records that produced it.

**Why this priority**: Reported values must remain traceable so users can verify, correct, and
trust them.

**Independent Test**: Select every supported report dimension and confirm that the destination
uses the visible report period and filters, preserves context, and returns to the same report
state.

**Acceptance Scenarios**:

1. **Given** a category, account, merchant, or month in a report, **When** it is selected, **Then**
   the user sees the contributing transactions with the relevant period and filter clearly
   applied.
2. **Given** an obligation result, **When** it is selected, **Then** the linked obligation and its
   payment history open without losing the report period.
3. **Given** a contributing transaction is corrected, reclassified, refunded, reversed, or
   deleted, **When** the user returns to Reports, **Then** affected totals and comparisons refresh
   consistently and the item is not counted twice.
4. **Given** a chart combines minor categories into Other, **When** Other is selected, **Then**
   the included categories and their contributing transactions are available.

---

### User Story 4 - Schedule Automatic Email Reports (Priority: P1)

As a user, I can choose a verified recipient, delivery frequency, language, currency, delivery
day, and report detail, then understand exactly what will be sent and when.

**Why this priority**: Automatic delivery is an approved Core V1 capability and must be
predictable, private, and reversible even while delivery is represented by mock outcomes.

**Independent Test**: Create, edit, pause, resume, and disable schedules for every supported
frequency; exercise email verification, success, failure, retry, offline, and changed-timezone
states; and confirm last and next delivery information.

**Acceptance Scenarios**:

1. **Given** no schedule exists, **When** the user enables automatic reports, **Then** the user
   reviews recipient email, frequency, report language, report currency, delivery day,
   assistant-summary choice, and summary-only or detailed content before confirmation.
2. **Given** the recipient email is unverified, **When** the user attempts to enable delivery,
   **Then** scheduling is not presented as active and a clear verification path is shown.
3. **Given** an active schedule, **When** settings open, **Then** the enabled state, recipient,
   last delivery, next scheduled delivery, period covered, and pause or edit actions are visible.
4. **Given** the user pauses or disables delivery, **When** the action is confirmed, **Then** no
   future delivery is shown as active while previous delivery history remains available.
5. **Given** a scheduled mock delivery fails, **When** status is shown, **Then** the user sees a
   calm reason category and can retry, change email, or keep the next schedule without creating
   duplicate deliveries.

---

### User Story 5 - Preview, Send, Export, or Share Safely (Priority: P2)

As a user, I can preview the report content before sending it now, sending a test, downloading,
or sharing, with clear privacy warnings and honest mock states.

**Why this priority**: On-demand delivery and sharing add practical value after the report and
scheduled delivery are trustworthy.

**Independent Test**: Preview summary-only and detailed reports, exercise every supported
on-demand action, cancel before completion, and verify success, failure, privacy, unsupported,
and duplicate-submission states.

**Acceptance Scenarios**:

1. **Given** a report and delivery settings, **When** preview opens, **Then** it shows the exact
   period, recipient when relevant, language, currency, included sections, detail level, and
   sensitive-data warning before any action.
2. **Given** the user sends a test or sends now, **When** the mock action is pending, **Then**
   repeated submission is prevented and the final sent or failed state is visible.
3. **Given** file generation or platform sharing is not available in the frontend phase, **When**
   the user chooses download or share, **Then** the experience is explicitly labeled as a
   preview or simulated outcome and never claims a real file or delivery exists.

---

### User Story 6 - Recover Without Losing Report Settings (Priority: P1)

As a user, I can continue understanding reports and recover from loading, stale, offline,
failed, partial, or conflicting states without losing schedule edits or being shown false
delivery success.

**Why this priority**: Financial interpretation and email delivery lose trust if incomplete data
or failed actions appear final.

**Independent Test**: Exercise all report and schedule states in Arabic and English, light and
dark modes, small and large screens, hidden-value mode, 200% text, and screen readers.

**Acceptance Scenarios**:

1. **Given** the device is offline, **When** Reports opens, **Then** the latest available report
   is labeled with its data time and unavailable refresh, delivery, or drill-down actions explain
   how to recover.
2. **Given** the user has unsaved schedule edits, **When** validation, navigation interruption,
   or a recoverable save failure occurs, **Then** entered values remain until saved or explicitly
   discarded.
3. **Given** a report or delivery request fails, **When** recovery appears, **Then** it preserves
   the last trusted report or schedule, identifies an available action, and shows no raw provider
   error.
4. **Given** sensitive values are hidden, **When** reports, previews, delivery status, and
   accessibility labels render, **Then** no financial amount is revealed inadvertently.

### Edge Cases

- The selected period crosses a year boundary, leap day, daylight-saving change, or profile
  timezone change.
- The current period is incomplete, the previous period has no data, or there is less history
  than a three-month, half-year, or annual report requires.
- Income is zero or negative, so savings rate or percentage change has no meaningful denominator.
- A refund, reversal, transfer, adjustment, deleted transaction, or obligation payment changes
  the current report after a prior version was viewed or delivered; the sent version must remain
  identifiable as its original snapshot.
- A user-confirmed local transaction is pending synchronization, while an automatic detection
  requires review or two synchronized versions remain in conflict.
- One obligation payment appears in expense totals and obligation totals but must affect net
  cash flow only once.
- Savings contributions are transfers between the user's accounts and must not be treated as
  spending merely because they update goal progress.
- Report values contain several currencies, a missing conversion estimate, a changed estimate,
  or an archived account whose history still belongs to the period.
- More categories, merchants, accounts, or months exist than can be explained legibly on one
  chart.
- The largest transaction is tied, later reversed, hidden, or outside the selected currency's
  available conversion data.
- A recipient email is malformed, unverified, changed after scheduling, or different from the
  profile email.
- A delivery day is later than the end of a month, a schedule is created after that day's run,
  or the delivery timezone changes.
- A user taps Send now, Send test, Retry, pause, or save repeatedly during a pending action.
- A delivery fails after its status was pending, succeeds after retry, or returns after the user
  paused future deliveries.
- Detailed transactions contain a sensitive merchant name or masked account label, while notes,
  identifiers, or source text must remain excluded.
- Long Arabic labels, mixed-direction merchant and account names, screen-reader summaries, or
  200% text could obscure amounts, dates, comparison meaning, status, or primary actions.

## Requirements *(mandatory)*

### Scope Boundaries

This specification owns the permanent Reports tab; required report periods; report summaries,
period-specific trends, comparisons, charts, accessible explanations, and drill-down context;
report preview and simulated export or sharing states; automatic email schedule settings; and
mock send, test, delivery, failure, retry, pause, and status experiences.

It consumes accounts, transactions, categories, salary, budgets, obligations, and savings from
SPEC-004 through SPEC-007. The full notification center and phone notifications, assistant
conversations and actions, subscription entitlements, profile management, and support belong to
SPEC-009. This specification may expose entry points and status events for those features but
does not own them. Production email delivery, production file generation, backend reporting,
provider configuration, investments, direct bank connections, camera capture, and receipt
scanning are outside scope.

### Functional Requirements

- **FR-001**: Reports MUST remain a permanent main navigation destination and MUST preserve the
  user's selected period while the user drills down and returns during the current session.
- **FR-002**: The feature MUST support monthly, last-three-months, half-year, and annual reports.
  Optional custom, salary-cycle, and month-to-date periods MAY be absent without reducing any
  required period.
- **FR-003**: Required calendar periods MUST show exact inclusive start and end dates in the
  user's profile timezone. Monthly means one selected calendar month; three-month and half-year
  reports cover three and six consecutive calendar months; annual means one selected calendar
  year.
- **FR-004**: A completed-period comparison MUST use the immediately preceding equal-length
  calendar period. An in-progress current period MUST compare only its elapsed portion with the
  corresponding elapsed portion of the immediately preceding period; a full prior-period total
  MAY appear only as separately labeled secondary context. Both compared date ranges MUST be
  explicit.
- **FR-005**: Every report MUST provide a summary containing total income, total expense, net
  cash flow, savings rate, obligation payments, largest spending category, largest individual
  transaction, and previous-period comparison when the required data exists.
- **FR-006**: Net cash flow MUST equal eligible income less eligible expense for the selected
  period. Transfers between the user's own accounts MUST NOT change income, expense, or net cash
  flow; refunds and reversals MUST offset their linked expense rather than appear as salary or
  unrelated income.
- **FR-007**: Obligation payments MUST appear in the obligation section and eligible expense
  total but MUST affect net cash flow only once. Savings transfers between the user's own
  accounts MUST appear in savings progress without being treated as income or expense solely
  because they are linked to a goal.
- **FR-008**: Savings rate MUST be presented as net cash flow divided by eligible income when
  eligible income is greater than zero. When that denominator is zero or the required data is
  incomplete, the rate MUST be unavailable with an explanation rather than fabricated.
- **FR-009**: Report currency conversion MUST retain access to original amounts, label converted
  totals as estimates, and identify the estimate context. Missing conversion data MUST mark
  affected totals and comparisons incomplete rather than silently omit activity.
- **FR-010**: Monthly reports MUST explain income, expenses, net cash flow, budget performance,
  top categories, obligations paid and due, savings progress, and month-over-month comparison.
- **FR-011**: Three-month reports MUST explain trends, average monthly spending, category
  movement, recurring payments, spending volatility, and savings consistency.
- **FR-012**: Half-year reports MUST explain the six-month trend, highest and lowest spending
  months, debt or obligation reduction, budget consistency, savings progression, and
  subscription impact.
- **FR-013**: Annual reports MUST explain annual income, expense, and net cash flow; category
  distribution; salary and obligation overview; debt progress; savings achievements;
  month-by-month comparison; and a clearly labeled mock summary when sufficient data exists.
- **FR-014**: A comparison MUST show current and previous values, absolute change, and percentage
  change when the previous value supports a meaningful calculation. Undefined or misleading
  percentages MUST be replaced by a plain-language unavailable or newly observed state.
- **FR-015**: Comparison language MUST interpret direction in financial context; an increase in
  income or savings MUST NOT share the same positive or negative wording as an increase in
  expense, debt, or overdue obligations.
- **FR-016**: Reports MUST include category spending, account activity, top merchants, budget
  performance, obligation payments, savings progress, salary-cycle summary, and previous-period
  comparison when relevant data exists.
- **FR-017**: Selecting a category, account, merchant, or month MUST open the contributing
  transactions with report period and dimension filters visible. Selecting an obligation MUST
  open its payment history with report context preserved.
- **FR-018**: Minor categories combined as Other MUST remain inspectable as named categories and
  contributing records; aggregation MUST NOT prevent verification.
- **FR-019**: Correcting, reclassifying, refunding, reversing, deleting, restoring, or
  synchronizing a contributing record MUST refresh every affected report result consistently
  and MUST NOT count a financial effect more than once.
- **FR-020**: Charts MUST answer a named question, limit visible series to a legible number,
  provide labels and values, and include an equivalent text summary and drill-down path.
- **FR-021**: Chart and comparison meaning MUST remain understandable without color, shape,
  position, animation, or percentage alone, including in grayscale and reduced-motion mode.
- **FR-022**: Reports MUST distinguish loading, complete, empty, insufficient-data, partial,
  estimated, stale, error, offline, pending-refresh, and sync-failed states.
- **FR-023**: Empty and insufficient-data states MUST explain the difference between no eligible
  activity and not enough history for a requested insight, and MUST offer a relevant next action.
- **FR-024**: The report MUST expose contextual entry points for Explain this report, Why did
  spending increase, Where can I save, Compare this period, and Create a saving plan. These
  actions MUST pass the visible report context and MUST NOT imply that an assistant invented or
  changed a report total.
- **FR-025**: Any assistant summary displayed within a report MUST cite the report values or
  sections it uses, distinguish facts from estimates or suggestions, identify insufficient data,
  and remain representative mock content in this frontend phase.
- **FR-026**: Users MUST be able to enable, edit, pause, resume, and disable one automatic report
  delivery schedule for their selected recipient.
- **FR-027**: A schedule MUST support monthly, every three months, half-year, and annual
  frequency; recipient email; report language; report currency; delivery day; inclusion of an
  assistant summary; and summary-only or detailed-transaction content.
- **FR-028**: Delivery MUST default to summary-only. Choosing detailed transactions MUST require
  a separate explicit choice and show a privacy warning. Detailed rows MUST be limited to date,
  transaction type, category, merchant when available, amount and currency, and a masked account
  label. Notes, tags, full account identifiers, detected source text, attachments, confidence
  data, and internal references MUST remain excluded from Core V1 email content.
- **FR-029**: Recipient email MUST be validated and verified before a schedule can be shown as
  active or an email can be shown as sent. Changing the recipient MUST require verification of
  the new address without deleting prior delivery history.
- **FR-030**: Delivery day MUST use the user's profile timezone and MUST be restricted to days 1
  through 28 so that every monthly recurrence has a valid day. The default MUST be day 1 after a
  completed reporting period, and the next delivery MUST identify both send date and covered
  report period.
- **FR-031**: A schedule created or resumed after its selected delivery time has passed MUST begin
  with the next eligible recurrence unless the user explicitly chooses Send now; it MUST NOT
  silently send a missed report.
- **FR-032**: Schedule review MUST show whether delivery is enabled, paused, or requires email
  verification; the recipient; frequency; language; currency; detail level; last delivery; next
  delivery; and covered period.
- **FR-033**: Users MUST be able to send a test report and send the currently selected report now
  after reviewing recipient, period, language, currency, included sections, detail level, and
  privacy warning.
- **FR-034**: Send test, Send now, Retry, and schedule-save actions MUST prevent repeated
  submission while pending and MUST use one request outcome so that retry cannot create an
  unintended duplicate delivery.
- **FR-035**: Delivery states MUST include verification required, ready, scheduled, sending,
  sent, failed, retrying, paused, disabled, and offline. A failed attempt MUST NOT be labeled sent
  or silently move the last-successful-delivery date.
- **FR-036**: A failed delivery MUST preserve the trusted schedule and entered settings, show a
  user-actionable reason category, and offer retry, recipient change, or continuation to the next
  scheduled occurrence without exposing provider errors.
- **FR-037**: Pausing or disabling future delivery MUST NOT remove prior success and failure
  history. A late result from an already-started send MUST be labeled as that attempt and MUST NOT
  reactivate future delivery.
- **FR-038**: The feature MUST provide report preview, share, download, send by email, and privacy
  warning entry points. Any action without approved real file or delivery support MUST be
  explicitly presented as a simulated or preview outcome.
- **FR-039**: A report preview MUST show exact period, generation or data time, language,
  currency, included sections, detail level, estimate or partial-data labels, and recipient when
  relevant.
- **FR-040**: Schedule forms and report actions MUST preserve meaningful entered data through
  validation errors, accidental navigation, temporary interruption, and recoverable save failure
  until the user saves or explicitly discards it.
- **FR-041**: Sensitive report values MUST follow the global hide-values setting on screen and
  MUST NOT leak through accessibility labels, app previews, analytics, raw errors, or delivery
  status notifications. Email content choices MUST remain explicit because email leaves the app.
- **FR-042**: Analytics for reports MAY identify period selection, schedule actions, and outcome
  categories but MUST NOT contain financial amounts, recipient email, merchant names, account
  identifiers, transaction notes, or report content.
- **FR-043**: All report, preview, schedule, status, validation, privacy, and recovery experiences
  MUST provide complete Arabic RTL and English LTR parity, use English numerals with locale-aware
  financial formatting, and handle mixed-direction values intentionally.
- **FR-044**: Controls MUST meet the 44-by-44 minimum target, content MUST remain usable at 200%
  text size, screen-reader focus MUST follow task order, chart summaries MUST expose equivalent
  values and comparisons, and status MUST not rely on haptics or motion.
- **FR-045**: The feature MUST use the established Masarifi Gulf Premium semantic hierarchy and
  calm, non-judgmental language without hard-coded brand values, user-facing strings, or a
  parallel report visual system.
- **FR-046**: The frontend phase MUST demonstrate representative complete, empty,
  insufficient-history, partial, multi-currency, stale, offline, verification-required,
  scheduled, sending, sent, failed, retry, paused, and simulated export or sharing states without
  claiming production reporting, email, file, assistant, or notification-provider behavior.
- **FR-047**: Report totals MUST include each user-confirmed record once, including a confirmed
  local record pending synchronization. Review-required detections and unresolved conflict
  candidates MUST be excluded until resolved, and their presence MUST mark affected report data
  incomplete with an inspectable reason. A resolved conflict MUST replace its prior counted
  version rather than add another financial effect.
- **FR-048**: Each sent, test, downloaded, or shared report outcome MUST preserve the report
  snapshot and generation time used for that attempt. Later record corrections, synchronization,
  or conversion-estimate changes MUST update newly viewed or generated reports but MUST NOT
  rewrite the earlier snapshot; the experience MUST make any difference traceable by date.
- **FR-049**: Required report summaries and their first useful content MUST remain usable for up
  to 10,000 confirmed contributing records in one selected period; dense breakdowns MUST remain
  navigable without omitting records from totals.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: The same report periods, interpretation, scheduling, preview, and mock
  delivery capabilities are available on Android and iOS. The feature requires no SMS or camera
  permission and remains useful offline through clearly dated previously available data.
- **Financial trust**: Report formulas, inclusions, estimates, missing data, date ranges, and
  comparisons remain explicit and traceable. Transactions are counted once, drill-down supports
  correction, delivery never claims false success, and detailed email content requires an
  informed choice.
- **Localization and accessibility**: Every state has Arabic RTL and English LTR parity. English
  numerals, mixed-direction content, 200% text, screen readers, minimum touch targets, reduced
  motion, non-color meaning, and equivalent chart summaries are acceptance requirements.
- **UI states and tokens**: Existing Gulf Premium semantic tokens and financial components are
  authoritative. Relevant loading, empty, insufficient, partial, estimated, stale, error,
  offline, verification, pending, sent, failed, paused, disabled, and retry states are required.
- **Verification**: Focused checks cover period boundaries, report formulas, transaction
  eligibility, refunds and transfers, multi-currency estimates, comparisons, drill-down filters,
  schedule recurrence, verification, idempotent send and retry, privacy masking, both languages
  and themes, device sizes, accessibility, offline behavior, and sync refresh.

### Key Entities *(include if feature involves data)*

- **Report Period**: A required calendar period with an exact start, end, timezone, period type,
  current or completed state, and equal-length comparison period.
- **Financial Report**: A point-in-time interpretation of eligible financial records for one
  report period and currency, including completeness, estimate, and data-time status.
- **Report Summary**: Income, expense, net cash flow, savings rate, obligation payments, largest
  category, largest transaction, and comparison results with calculation availability.
- **Report Breakdown**: A category, account, merchant, obligation, savings, salary, budget, or
  monthly trend result linked to the dimensions and records that support it.
- **Report Comparison**: Current and prior values, absolute and valid percentage change,
  contextual direction, date ranges, and insufficient-data reason.
- **Report Schedule**: The user's automatic delivery choice containing verified recipient,
  frequency, language, currency, delivery day and timezone, content options, lifecycle status,
  last result, and next eligible delivery.
- **Report Delivery Attempt**: A scheduled, test, immediate, or retry attempt with covered period,
  requested content, status, time, preserved report snapshot, actionable failure category, and
  relationship to one schedule.
- **Report Preview**: The exact period, data time, language, currency, included sections, detail
  level, recipient context, and privacy or estimate notices shown before an external action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users identify income, expense, net cash flow, largest category,
  and comparison direction for a report within 20 seconds without assistance.
- **SC-002**: At least 90% of users switch among all four required periods and correctly identify
  the exact covered dates and comparison period on their first attempt.
- **SC-003**: 100% of tested transfers, refunds, reversals, obligation payments, savings
  transfers, corrections, deletions, and sync refreshes produce one consistent report effect
  without double-counting.
- **SC-004**: At least 90% of users can explain the main conclusion of every required report type
  using either its chart or text summary, including in grayscale and at 200% text size.
- **SC-005**: At least 90% of users reach the contributing transactions or obligation history
  from a report result in three actions or fewer and return to the unchanged report context.
- **SC-006**: At least 90% of first-time users configure and review an automatic email schedule
  in under two minutes, while 100% can pause or disable it in three actions or fewer.
- **SC-007**: 100% of tested unverified, pending, successful, failed, retried, paused, disabled,
  offline, and late-result delivery scenarios display the correct state and never claim a false
  or duplicate successful delivery.
- **SC-008**: 100% of tested partial-data and missing-conversion reports label affected results
  as incomplete or estimated and never fabricate a total, rate, or comparison.
- **SC-009**: All critical report and schedule journeys complete in Arabic RTL and English LTR at
  200% text size without hiding values, dates, filters, comparison meaning, privacy warnings,
  validation, status, or primary actions.
- **SC-010**: In usability testing, at least 85% of users rate report explanations, delivery
  choices, and privacy language as clear, calm, and trustworthy.
- **SC-011**: For report periods containing up to 10,000 confirmed contributing records, at
  least 95% of period selections show the summary and first useful report content within two
  seconds on supported devices.

## Assumptions

- SPEC-001 through SPEC-007 provide product principles, design components, navigation,
  authentication, accounts, transactions, categories, salary cycles, budgets, obligations,
  payments, and savings data consumed by this feature.
- Required reports use calendar periods in the profile timezone. Optional custom, salary-cycle,
  and month-to-date periods may be considered later without blocking Core V1.
- Completed-period comparisons use the immediately preceding equal-length calendar period.
  In-progress periods compare matching elapsed portions so a partial period is never presented
  against a complete one as though they were equivalent.
- Internal transfers do not create income or expense; refunds and reversals offset expenses;
  obligation payments affect expense and obligation reporting once; and goal-linked internal
  transfers affect savings progress without becoming spending.
- User-confirmed local records pending synchronization contribute once. Review-required
  detections and unresolved conflict candidates remain outside totals until resolved and make
  affected report data explicitly incomplete.
- The selected report currency is used for comparison totals. Original currencies remain
  available, conversions are estimates, and results become incomplete when an estimate is
  missing.
- External report outcomes preserve the generated snapshot and time for trust and traceability;
  current on-screen reports recalculate from the latest confirmed records and available
  conversion estimates.
- One automatic report schedule per user is sufficient for Core V1. It defaults to summary-only,
  day 1, the profile timezone, current app language, and profile currency, all editable before
  confirmation.
- Core V1 validation covers report periods with up to 10,000 confirmed contributing records;
  larger histories may use the same totals but require a later measured scale decision.
- Recipient email verification is represented through deterministic frontend states. Report
  generation, email sending, file download, platform sharing, delivery history, and assistant
  explanations use representative non-production outcomes during this phase.
- Notifications of report readiness or delivery status, full assistant conversations and
  actions, subscription entitlement enforcement, support, production providers, investments,
  camera capture, and receipt scanning remain outside this feature.
