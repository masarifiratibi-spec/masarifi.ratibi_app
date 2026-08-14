# Feature Specification: Notifications, Smart Financial Assistant, Subscriptions, and Support

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "Create SPEC-009 - Notifications, Smart Financial Assistant, Subscriptions, and Support from the complete Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-11

- Q: What authorization is required for phone-notification actions that reveal or change financial data? → A: Require app unlock first.
- Q: Which security phone alerts may bypass quiet hours? → A: Critical access alerts only.
- Q: What financial context should an assistant response preserve? → A: Snapshot each response.
- Q: How should content created through a now-unavailable paid feature behave after downgrade or expiry? → A: Keep existing content read-only.
- Q: Does deleting an in-app notification affect its linked financial record? → A: Delete the notification only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive and Act on Financial Notifications (Priority: P1)

As a user, I receive timely, understandable feedback about transactions, obligations, budgets,
salary, savings, reports, assistant insights, security, and system status, and I can open the
relevant destination or take an available corrective action.

**Why this priority**: Timely feedback closes the loop after financial activity and helps users
trust automatic capture, correct mistakes, and respond before a budget or obligation worsens.

**Independent Test**: Generate representative events in every notification category and verify
their in-app and phone presentations, linked destinations, sensitive-value treatment, quick
actions, read state, grouping, and recovery behavior.

**Acceptance Scenarios**:

1. **Given** a clear automatic transaction is added, **When** its notification appears, **Then**
   the user can understand the amount, merchant or purpose, category, and source and can view,
   edit, or undo the transaction while those actions remain valid.
2. **Given** an obligation payment is recorded, **When** the notification appears, **Then** it
   states the payment result and remaining obligation context and opens the linked obligation.
3. **Given** a transaction needs review or may be a duplicate, **When** the user opens the
   notification, **Then** the exact review item opens without presenting the transaction as
   final.
4. **Given** a notification links to an item that was removed, resolved, or is no longer
   accessible, **When** the user selects it, **Then** the app explains the changed state and
   offers the nearest valid destination without failing silently.

---

### User Story 2 - Control Notification Attention and Privacy (Priority: P1)

As a user, I can decide which non-essential notification categories reach my phone, define quiet
hours and summaries, and hide sensitive values on the lock screen without losing important
in-app history.

**Why this priority**: Financial notifications are only useful when they respect attention,
privacy, device permission, and the user's preferred level of detail.

**Independent Test**: Change each preference, deny and restore phone-notification permission,
cross quiet-hour boundaries, enable summaries, hide amounts, and verify delivery and privacy in
Arabic and English.

**Acceptance Scenarios**:

1. **Given** phone notifications are permitted, **When** the user disables a category, **Then**
   future events in that category remain available in-app but do not appear as phone alerts.
2. **Given** quiet hours are active, **When** a non-urgent event occurs, **Then** its phone alert
   is deferred or included in the next selected summary while its in-app entry remains available.
3. **Given** lock-screen amounts are hidden or global balance hiding is enabled, **When** a phone
   alert is shown, **Then** its title, body, preview, and accessibility announcement reveal no
   amount or other protected financial detail.
4. **Given** operating-system notification permission is denied, **When** preferences open,
   **Then** the user sees the actual permission state, a recovery path, and a fully usable in-app
   notification center.

---

### User Story 3 - Ask for Contextual Financial Guidance (Priority: P1)

As a consenting user, I can ask questions about my own financial data and receive direct answers,
comparisons, explanations, saving suggestions, and plans that distinguish known facts from
estimates and suggestions.

**Why this priority**: Contextual explanation is a core product capability that turns recorded
financial activity into practical understanding.

**Independent Test**: Ask approved question types using complete, partial, empty, conflicting,
and stale financial contexts and verify cited data scope, calculation clarity, safety language,
privacy controls, and insufficient-data responses.

**Acceptance Scenarios**:

1. **Given** sufficient confirmed data, **When** the user asks how much was spent on a category
   during a named period, **Then** the answer gives the amount, exact period, supporting records
   or report path, and any relevant estimate label.
2. **Given** the user asks why spending changed, **When** a comparison is available, **Then** the
   assistant identifies the main contributing categories or transactions and separates observed
   facts from interpretation.
3. **Given** data is insufficient, stale, incomplete, or conflicting, **When** the assistant is
   asked for a conclusion, **Then** it names the limitation, avoids inventing values, and offers a
   relevant next step.
4. **Given** personalization is disabled, **When** the user opens the assistant, **Then** no
   personalized financial answer is presented and the consent choice can be reviewed without
   blocking the rest of the application.

---

### User Story 4 - Review and Confirm Assistant Actions (Priority: P1)

As a user, I can turn an assistant suggestion into a budget, savings goal, reminder, linked
transaction, obligation review, or navigation action only after seeing and confirming exactly
what will happen.

**Why this priority**: Guidance must never become a hidden financial change; preview and explicit
confirmation are essential to financial trust.

**Independent Test**: Exercise every supported proposal through preview, edit, cancel, confirm,
pending, success, failure, offline, and repeated-submission states and verify that no change
occurs before confirmation.

**Acceptance Scenarios**:

1. **Given** the assistant proposes a data-changing action, **When** the user selects it, **Then**
   a preview names every affected value and destination before any change is made.
2. **Given** a preview is displayed, **When** the user cancels or leaves it, **Then** no financial
   record, budget, goal, reminder, or link is changed.
3. **Given** the user confirms a valid preview, **When** the representative action succeeds,
   **Then** the result is shown once with a path to inspect or correct the affected item.
4. **Given** the action fails, is offline, or is submitted repeatedly, **When** the result is
   shown, **Then** no duplicate change is claimed and the user can retry or continue without
   losing the proposed values.

---

### User Story 5 - Understand and Manage a Subscription (Priority: P1)

As a user, I can compare Free, Basic, and Premium plans, understand limits and renewal terms,
complete a representative purchase flow, and manage trial, renewal, restoration, plan change,
cancellation, expiration, and payment-failure states.

**Why this priority**: Subscription screens must communicate entitlement and cost honestly even
though production payment processing is outside this frontend phase.

**Independent Test**: Move a representative account through every plan and lifecycle state,
including limit reached, monthly and annual offers, trial eligibility, checkout cancellation,
success, failure, restore, change, cancel, renewal, and expiry.

**Acceptance Scenarios**:

1. **Given** the user compares plans, **When** the comparison opens, **Then** each plan shows its
   approved features, limits, billing period, displayed price, renewal behavior, and current-plan
   status without implying unavailable benefits.
2. **Given** a trial or paid offer is available, **When** the user proceeds, **Then** the review
   shows duration, price, renewal date or rule, included limits, and cancellation context before
   the representative purchase is confirmed.
3. **Given** purchase, restoration, or plan change succeeds or fails, **When** the result appears,
   **Then** entitlement status changes only on success and failure provides a safe retry or exit.
4. **Given** a plan limit is reached or a subscription expires, **When** a limited feature is
   opened, **Then** the user sees the exact limit or lost entitlement, current plan, and valid
   options without losing existing financial data.

---

### User Story 6 - Manage Profile, Security, and Privacy (Priority: P1)

As a user, I can manage profile and application preferences, protect access, understand active
sessions and security events, control tracking and assistant consent, and request export or
account deletion without exposing sensitive information.

**Why this priority**: These controls establish ownership of identity, financial visibility,
permissions, and personal data across the application.

**Independent Test**: Review and edit every approved preference; exercise PIN, biometric,
auto-lock, session, consent, local-data deletion, export request, and account-deletion request
states; and verify confirmation, masking, and recovery behavior.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** profile or application settings change, **Then** the saved
   values and affected behavior are clear and failed saves preserve entered values.
2. **Given** the user enables or changes a PIN, biometrics, or auto-lock, **When** the security
   flow completes, **Then** the new protection state is confirmed without displaying secret
   values or biometric data.
3. **Given** tracking consent or assistant personalization is disabled, **When** the user
   confirms, **Then** the affected personalized behavior stops and the unaffected manual product
   remains usable.
4. **Given** the user requests local-data deletion, data export, or account deletion, **When**
   the action may remove data or access, **Then** scope and consequences are explained and
   explicit confirmation is required before a representative outcome is shown.

---

### User Story 7 - Find Help and Contact Support (Priority: P2)

As a user, I can search help content, create and follow a support ticket, reply, rate support,
send feedback, and report an incorrect transaction or assistant response with useful context.

**Why this priority**: Support provides a recovery path for trust, billing, detection, and
guidance issues after the core financial experiences are available.

**Independent Test**: Search the help center, submit every supported ticket category, preserve a
draft through validation or offline interruption, open ticket history, reply, rate a resolved
ticket, and submit contextual reports without an attachment.

**Acceptance Scenarios**:

1. **Given** help content exists, **When** the user searches a term, **Then** relevant FAQs and
   help topics appear with a clear no-results path to create a ticket.
2. **Given** the user creates a ticket, **When** category, subject, and description are valid,
   **Then** the representative ticket appears in the ticket list with its status and submitted
   context.
3. **Given** a transaction or assistant response is reported, **When** the report is reviewed,
   **Then** only the minimum visible context needed to identify the item is included and the user
   can remove optional context before submission.
4. **Given** submission fails or the device is offline, **When** recovery appears, **Then** the
   user's draft is preserved and no successful ticket or reply is claimed.

---

### User Story 8 - Recover Across Languages, Devices, and Data States (Priority: P1)

As a user, I can use notifications, the assistant, subscription management, settings, and
support in Arabic or English, with assistive technology, hidden values, and unreliable
connectivity without losing work or being shown false success.

**Why this priority**: These experiences handle sensitive financial and identity information and
must remain trustworthy outside the ideal online state.

**Independent Test**: Exercise loading, empty, dense, partial, stale, error, offline, permission,
pending, success, and failure states in Arabic RTL and English LTR, light and dark modes, small
and large phones, 200% text, reduced motion, and screen readers.

**Acceptance Scenarios**:

1. **Given** previously available data and no connection, **When** a supported screen opens,
   **Then** available content is clearly dated, unavailable actions explain recovery, and drafts
   or pending changes are not presented as synchronized.
2. **Given** 200% text or a screen reader, **When** a notification, assistant answer, paywall,
   setting, or ticket is used, **Then** amount, status, consent, price, renewal, errors, and
   primary actions remain understandable in task order.
3. **Given** Arabic RTL or English LTR, **When** mixed-direction financial values and names are
   shown, **Then** reading order, navigation meaning, numerals, dates, currency, and controls are
   unambiguous.

### Edge Cases

- Many notifications arrive for the same transaction, obligation, or report in a short period,
  including an initial event followed by correction, reversal, failure, or resolution.
- A notification quick action expires, has already been used, or targets an item that was
  deleted, archived, merged, synchronized differently, or is inaccessible to the current user.
- Phone notification permission is denied, permanently denied, restored in device settings, or
  differs from the preference shown during a stale session.
- Quiet hours cross midnight, the device timezone changes, or a summary window contains both
  deferred and newly generated events.
- A security event occurs during quiet hours, or a user disables its phone delivery while the
  permanent in-app security history must remain available.
- Hidden-value mode changes while a phone alert, app-switcher preview, screen-reader
  announcement, or notification detail is visible.
- Assistant context contains pending local records, review-required detections, unresolved sync
  conflicts, estimated currency values, archived accounts, or a report snapshot that differs
  from current records.
- A question asks for investment advice, information outside Masarifi data, a future prediction,
  or a data change disguised as a conversational request.
- An assistant action preview becomes stale because the underlying budget, goal, obligation,
  transaction, plan entitlement, or permission changes before confirmation.
- A user deletes a conversation while an answer or action is pending, disables personalization
  mid-conversation, or reaches an assistant usage limit after submitting a question.
- A trial is unavailable, already used, ends after a timezone change, or converts to a paid plan;
  a displayed offer changes before representative checkout confirmation.
- Purchase completion is delayed, repeated, cancelled, restored on another platform, or returns
  after the user leaves the paywall; no duplicate entitlement may be shown.
- A downgrade removes a feature entitlement while user-created financial data already exists;
  data remains visible or exportable according to product policy and is never silently deleted.
- A session is current, expired, unknown, or already revoked when the user signs out one or all
  devices; the current device may lose access before the final screen renders.
- Local-data deletion, export, or account-deletion requests are interrupted, repeated, or fail;
  irreversible completion must never be claimed early.
- A support search has no results, a ticket subject or description exceeds its accepted length,
  a draft is restored after interruption, or a referenced financial item is later corrected.
- Long Arabic text, mixed-direction account names, large prices, plan comparison rows, or dense
  notification and ticket lists could obscure status, privacy meaning, or primary actions.

## Requirements *(mandatory)*

### Scope Boundaries

This specification owns the in-app notification center; representative phone notifications;
notification permissions, preferences, quiet hours, summaries, privacy, destinations, and quick
actions; assistant consent, conversations, explanations, plans, action previews, history,
feedback, and limits; Free, Basic, and Premium comparison and subscription lifecycle screens;
profile, application, security, and privacy settings; and help, feedback, and support-ticket
experiences.

It consumes confirmed accounts, transactions, salary, budgets, obligations, savings, reports,
categories, recurring payments, session state, and tracking state from SPEC-003 through SPEC-008.
Those specifications remain the owners of financial calculations and record-editing flows;
SPEC-009 links to them and reflects their confirmed outcomes. Production push delivery,
production AI, financial or investment advice, production payment processing, server-side
entitlement enforcement, production support operations, real data export or account deletion,
file attachments, camera capture, receipt scanning, investments, and backend infrastructure are
outside scope.

### Functional Requirements

- **FR-001**: The feature MUST represent notification events for transactions, obligations,
  budgets, salary, savings, reports, assistant insights, security, and system status as defined
  by the master specification.
- **FR-002**: Each notification MUST have one clear category, title, concise body, occurrence
  time, read state, and linked destination or explicit explanation when no destination exists.
- **FR-003**: Transaction notifications MUST distinguish automatic expense, automatic income,
  voice entry, manual entry, review required, possible duplicate, and refund outcomes without
  presenting pending or uncertain activity as confirmed.
- **FR-004**: Obligation notifications MUST distinguish installment, partial payment, due soon,
  overdue, completion, and payment-needs-linking outcomes and MUST show remaining or due context
  only when supported by confirmed obligation data.
- **FR-005**: Budget, salary, savings, and report notifications MUST name the event, relevant
  period or goal when applicable, and a destination where the user can verify the source data.
- **FR-006**: Assistant insight notifications MUST be labeled as insights or suggestions and MUST
  NOT be presented as confirmed financial events or changes.
- **FR-007**: Security and system notifications MUST distinguish session, permission, sync,
  update, and maintenance events and MUST provide an actionable destination when recovery is
  available.
- **FR-008**: The in-app notification center MUST support All, Unread, Transactions,
  Obligations, Budgets, Reports, Assistant, and Security views; date grouping; unread counts;
  mark read; mark all read; delete; empty state; offline state; and linked navigation.
- **FR-009**: Mark-read, mark-all-read, and delete actions MUST update the visible state once per
  user action, preserve a clear pending state when not synchronized, and recover without
  duplicating or restoring unrelated items. Deleting a notification MUST remove only that
  notification entry and MUST NOT delete, reverse, edit, or otherwise change its linked
  transaction, obligation, budget, report, security event, assistant item, or other source data.
- **FR-010**: Phone notifications MUST use a clear title and short body, support linked
  navigation, and expose View, Edit, or Undo quick actions only when the destination and action
  remain valid on the current platform and item state. When the app is locked, opening protected
  content or executing any financial quick action MUST require the normal app unlock first.
- **FR-011**: Selecting a notification or quick action MUST open the exact relevant transaction,
  review item, obligation, budget, salary cycle, goal, report, assistant insight, security event,
  or recovery setting when it remains accessible.
- **FR-012**: If a linked item was resolved, changed, removed, merged, or made inaccessible, the
  notification MUST explain that state and offer the nearest valid destination rather than show
  a blank or raw error.
- **FR-013**: Duplicate notification events for the same outcome MUST NOT cause a financial
  action to execute more than once; later corrections or reversals MUST remain distinguishable
  from the original event.
- **FR-014**: Notification preferences MUST cover overall phone delivery; transaction, income,
  obligation, budget, salary, savings, report, assistant, and security categories; quiet hours;
  daily summary; weekly summary; and lock-screen amount hiding.
- **FR-015**: Disabling a phone-notification category MUST NOT remove its existing or future
  in-app entries. Security history MUST remain available in-app even when its phone delivery is
  disabled.
- **FR-016**: Quiet hours MUST show their start, end, active days, and profile timezone and MUST
  defer non-urgent phone alerts without delaying their in-app availability. Only critical access
  alerts, including a new session, session revocation, or account-access protection change, MAY
  bypass quiet hours; routine security, update, maintenance, and recovery reminders MUST wait.
- **FR-017**: Daily and weekly summaries MUST identify their covered period and grouped category
  counts and MUST NOT double-present an event as both a deferred individual alert and a summary
  item unless the user explicitly opens its history.
- **FR-018**: The actual operating-system permission state MUST be distinguishable from in-app
  category preferences, with education and an appropriate settings-recovery path after denial.
- **FR-019**: Lock-screen amount hiding MUST be enabled by default. It and the global
  hide-balances setting MUST suppress protected amounts and financial details from phone-alert
  titles, bodies, previews, quick-action labels, and accessibility announcements.
- **FR-020**: Notification screens MUST distinguish loading, empty, complete, dense, stale,
  offline, permission-denied, sync-pending, sync-failed, deleted-target, and action-expired states.
- **FR-021**: The assistant MUST request informed personalization consent before using the
  user's accounts, transactions, salary, budgets, obligations, debts, installments, savings,
  reports, categories, or recurring payments for a personalized response.
- **FR-022**: The consent explanation MUST name the financial data categories available to the
  assistant, the purpose of their use, the educational nature of guidance, the user's control,
  and the paths to disable personalization and delete conversation history.
- **FR-023**: Users MUST be able to start a conversation, select a suggested question, send a
  question, view conversation history, rename a conversation, delete a conversation, and report
  or rate an assistant response.
- **FR-024**: The assistant MUST support representative direct answers, comparisons,
  explanations, saving suggestions, saving plans, and obligation analyses based on the visible
  confirmed financial context.
- **FR-025**: Every data-based answer MUST state the relevant period or as-of time, identify the
  values or records that support its conclusion through a clear inspectable path, and label any
  conversion or projection as an estimate. Each completed response MUST preserve the confirmed
  financial context snapshot it used; later record changes MUST NOT silently rewrite that
  response, and a new question MUST use the latest confirmed context unless the user explicitly
  asks about an earlier period or snapshot.
- **FR-026**: The assistant MUST distinguish observed fact, derived estimate, and optional
  suggestion in wording and presentation and MUST use calm, non-judgmental language.
- **FR-027**: The assistant MUST NOT invent balances, transactions, totals, causes, or plan
  affordability when supporting data is missing, stale, incomplete, under review, or in conflict.
- **FR-028**: When information is insufficient, the assistant MUST explain the missing or
  excluded context and offer a relevant path such as reviewing transactions, completing a
  profile value, changing the period, or asking a narrower question.
- **FR-029**: The assistant MUST present guidance as educational, MUST NOT present investment
  advice, and MUST refuse or safely redirect requests outside the approved personal-finance
  guidance scope.
- **FR-030**: Users MUST be able to disable assistant personalization without losing access to
  the rest of the application and MUST be able to delete individual or all conversation history
  through an explicit confirmation flow.
- **FR-031**: Assistant states MUST include new conversation, suggested questions, answering,
  complete answer, insufficient data, stale or partial context, offline, error, usage limit,
  disabled personalization, deleted conversation, and privacy explanation.
- **FR-032**: The assistant MAY propose creating or adjusting a budget, creating a savings goal,
  adding a reminder, opening transactions, showing subscriptions, linking a transaction,
  reviewing an obligation, or creating a plan, but MUST NOT apply a data change from ordinary
  conversational text alone.
- **FR-033**: Every proposed data-changing action MUST show a preview of the exact action,
  affected values, affected record or section, and any material consequence before requesting
  confirmation.
- **FR-034**: Users MUST be able to edit an editable proposal, cancel it, or return to the
  conversation without a change. Only an explicit confirmation on the current preview MAY
  produce a representative action result.
- **FR-035**: A preview MUST be revalidated when its source data, permission, or plan entitlement
  changes before confirmation; a stale preview MUST NOT be executed as though current.
- **FR-036**: Assistant action results MUST distinguish pending, succeeded, failed, offline,
  cancelled, and stale-preview outcomes; prevent repeated confirmation; and offer a path to
  inspect, correct, or retry without claiming duplicate success.
- **FR-037**: The subscription experience MUST show the current plan and compare Free, Basic,
  and Premium using the current approved feature catalog and limits, with monthly and annual
  options where available.
- **FR-038**: Each displayed offer MUST clearly show price and currency, billing period, included
  features and limits, current-plan state, renewal behavior, and material restrictions before a
  representative checkout can begin.
- **FR-039**: A trial MUST be displayed only when available to the current user and offer and
  MUST disclose trial duration, price during the trial, post-trial price, renewal behavior, and
  cancellation context before confirmation.
- **FR-040**: The subscription lifecycle MUST represent paywall, checkout review, pending,
  success, failure, cancellation, restoration, plan change, renewal date, cancellation at period
  end, expiration, and assistant or tracking usage-limit states.
- **FR-041**: Purchase, restore, and plan-change actions MUST prevent repeated submission and
  MUST change the visible entitlement only after a successful representative outcome.
- **FR-042**: Payment failure or cancellation MUST preserve the prior entitlement, explain that
  no successful change occurred, and offer retry or exit without exposing provider errors.
- **FR-043**: Restore purchases MUST show whether an eligible entitlement was found and MUST NOT
  create a duplicate plan or reset existing financial data.
- **FR-044**: Plan downgrade, cancellation, expiration, or usage-limit states MUST identify the
  affected feature and valid options without silently deleting existing user-created financial
  records, conversations, reports, or settings. Content created exclusively through a paid
  feature that is no longer entitled MUST remain visible in read-only form and exportable where
  export already exists; creating or changing paid-only content MUST require an active
  entitlement.
- **FR-045**: Subscription screens MUST state that purchase outcomes are representative during
  this frontend phase and MUST NOT imply that production payment processing has occurred.
- **FR-046**: Profile settings MUST cover name, avatar placeholder, phone, linked Google account,
  email, country, currency, timezone, and profile-completion status.
- **FR-047**: Application settings MUST cover language, theme, first day of week, default
  account, hidden balances, transaction defaults, dashboard customization, tracking, voice,
  report email, and notification preferences, linking to the owning feature where appropriate.
- **FR-048**: Security settings MUST represent create, confirm, change, and forgot-PIN flows;
  temporary lock; biometric enable and disable; auto-lock duration; privacy-screen status;
  session list; sign out; sign out all devices; security events; and local-data deletion.
- **FR-049**: PIN, biometric, session, and destructive security actions MUST hide secret values,
  explain consequences, require appropriate confirmation, prevent repeated submission, and show
  no success before the representative outcome completes.
- **FR-050**: Privacy settings MUST cover tracking consent, assistant personalization,
  analytics preference, data-export request, account-deletion request, legal documents, and a
  plain-language privacy explanation.
- **FR-051**: Disabling tracking or assistant personalization MUST state what behavior stops,
  what previously created financial records remain, and which manual capabilities continue.
- **FR-052**: Local-data deletion, data-export request, and account-deletion request flows MUST
  explain scope, irreversibility or processing status, and authentication or confirmation needs;
  interrupted or failed outcomes MUST NOT be presented as complete.
- **FR-053**: Profile, settings, security, and privacy forms MUST preserve meaningful entered
  data through validation errors, accidental navigation, temporary interruption, and recoverable
  failure until saved or explicitly discarded.
- **FR-054**: Support MUST provide a searchable help center, FAQ, ticket creation, ticket list,
  ticket detail, replies, support rating, feedback, incorrect-transaction reporting,
  assistant-response reporting, app version, and What's New.
- **FR-055**: Ticket creation MUST require a category, subject, and description, provide clear
  validation, preserve the draft after recoverable failure or interruption, and exclude file
  attachments from Core V1.
- **FR-056**: Ticket list and detail MUST show a stable reference, category, subject, created and
  updated times, status, message history, and available reply or rating action without claiming
  live support processing.
- **FR-057**: Incorrect-transaction and assistant-response reports MUST allow the user to review
  and remove optional context and MUST exclude unrelated financial values, raw detected message
  content, account identifiers, conversation history, and secrets by default.
- **FR-058**: Support submission states MUST include draft, validating, pending, submitted,
  failed, offline, and retry; only a successful representative outcome MAY create a visible
  submitted ticket, reply, feedback item, or report.
- **FR-059**: Analytics MAY record category-level interaction and outcome names for
  notifications, assistant, subscription, settings, and support, but MUST NOT include financial
  amounts, notification bodies, assistant questions or answers, prices tied to identity,
  credentials, contact details, ticket text, or financial-item context.
- **FR-060**: All user-facing content and states MUST provide complete Arabic RTL and English LTR
  parity, use English numerals with locale-aware financial and date formatting, and handle
  mixed-direction financial names intentionally.
- **FR-061**: Controls MUST meet the 44-by-44 minimum target, content MUST remain usable at 200%
  text size, focus MUST follow task order, and category, read state, plan, consent, warning,
  success, and failure meaning MUST not depend on color, motion, illustration, or haptics alone.
- **FR-062**: The feature MUST follow the established Masarifi Gulf Premium semantic hierarchy,
  prioritize amounts, statuses, privacy, renewal terms, and actions over decoration, and use
  calm, non-judgmental language.
- **FR-063**: Each major screen MUST represent relevant loading, empty, complete, dense, partial,
  stale, error, offline, permission, disabled, pending, success, failure, and archived or expired
  states without raw technical or provider errors.
- **FR-064**: Sensitive financial, identity, security, conversation, subscription, and support
  information MUST be masked where appropriate and MUST NOT leak through lock-screen previews,
  app-switcher previews, accessibility labels, analytics, raw errors, or unrelated destinations.
- **FR-065**: The frontend phase MUST use deterministic representative outcomes for phone
  delivery, assistant answers and actions, subscription lifecycle, session management, export
  and deletion requests, and support operations without claiming production service behavior.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android and iOS receive equivalent in-app notifications, assistant,
  subscription, settings, and support experiences. Phone-notification quick actions appear only
  where supported. No SMS permission is introduced by this feature, and denied notification
  permission never blocks in-app history or core manual finance use.
- **Financial trust**: Notifications and assistant answers reflect confirmed source data and
  label uncertainty. Assistant changes require a current preview and explicit confirmation.
  Sensitive values are masked, subscription outcomes never claim real payment, and destructive
  privacy or security actions never claim early completion.
- **Localization and accessibility**: Every state has Arabic RTL and English LTR parity. English
  numerals, mixed-direction content, 200% text, screen readers, minimum touch targets, reduced
  motion, logical focus, and non-color meaning are acceptance requirements.
- **UI states and tokens**: The established Gulf Premium semantic system is authoritative.
  Relevant loading, empty, dense, stale, offline, permission, consent, limit, pending, success,
  failure, expired, and recovery states are required.
- **Verification**: Focused checks cover notification routing and privacy, preferences and quiet
  hours, assistant evidence and action confirmation, subscription lifecycle and duplicate
  prevention, security and destructive confirmations, support draft preservation, both
  languages and themes, device sizes, accessibility, offline behavior, and stale data.

### Key Entities *(include if feature involves data)*

- **Notification**: A categorized, timestamped in-app event with title, body, read and sync state,
  sensitivity level, linked destination, and optional valid action.
- **Notification Preference**: The user's phone-delivery choices by category, permission state,
  quiet-hour schedule and timezone, summary choices, and lock-screen privacy setting.
- **Assistant Consent**: The user's current personalization choice, disclosed data categories,
  consent time, and disabled state.
- **Assistant Conversation**: A named history of user questions, representative responses,
  context time, privacy state, feedback, and deletion status.
- **Assistant Response**: A direct answer, comparison, explanation, suggestion, plan, or
  obligation analysis with a preserved confirmed-context snapshot and as-of time, supporting
  context, fact or estimate labels, limitations, and optional proposed actions.
- **Assistant Action Preview**: A time-bounded proposal containing the exact action, affected
  values and destination, source-context version, confirmation state, and result.
- **Subscription Offer**: A Free, Basic, or Premium plan presentation with billing period,
  displayed price, features, limits, trial terms when eligible, renewal behavior, and current
  availability.
- **Subscription State**: The current plan, entitlement status, billing period, trial or renewal
  dates, cancellation or expiry state, limits, and latest representative purchase or restoration
  outcome.
- **User Preferences**: Profile, application, security, and privacy choices that control
  identity presentation, localization, financial visibility, default behavior, access
  protection, permissions, and consent.
- **Security Event**: A session, access, permission, or protection event with time, status,
  device context when appropriate, and recovery or revocation action.
- **Support Ticket**: A categorized support request with reference, subject, description,
  approved contextual reference, status, timestamps, messages, and optional rating after
  resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users can identify a notification's event, status, source, and
  next action within 10 seconds without assistance.
- **SC-002**: At least 95% of notification links and valid quick actions open the correct current
  destination on the first attempt, while 100% of expired or removed targets show an actionable
  fallback instead of a broken destination.
- **SC-003**: 100% of tested hidden-value, denied-permission, quiet-hour, and summary scenarios
  respect the selected privacy and attention settings without removing in-app history.
- **SC-004**: At least 90% of users configure notification categories, quiet hours, summaries,
  and lock-screen privacy in under two minutes on their first attempt.
- **SC-005**: At least 90% of supported financial questions return an answer whose period,
  supporting context, fact or estimate status, and limitation can be correctly identified by
  the user within 30 seconds.
- **SC-006**: 100% of assistant tests with missing, stale, review-required, conflicting, or
  out-of-scope data avoid invented financial values and show a clear limitation or safe redirect.
- **SC-007**: 100% of proposed assistant data changes require a current preview and explicit
  confirmation, and cancellation, failure, stale preview, or repeated submission produces no
  unintended or duplicate change.
- **SC-008**: At least 90% of users correctly identify the current plan, price and period,
  material limits, trial or renewal terms, and cancellation state before confirming a
  representative subscription action.
- **SC-009**: 100% of tested purchase, restore, change, cancel, expiry, and failure scenarios
  display the correct entitlement once and preserve existing financial data.
- **SC-010**: At least 90% of users complete one profile or application preference change and
  one security or privacy task in under two minutes without exposing a secret or losing entered
  data.
- **SC-011**: At least 90% of users find a relevant help topic or submit a valid support ticket
  in under three minutes, and 100% of offline or failed submissions preserve the draft and avoid
  false success.
- **SC-012**: All critical journeys complete in Arabic RTL and English LTR at 200% text size on
  supported small and large phones without hiding amount privacy, consent, price, renewal,
  status, validation, error recovery, or primary actions.
- **SC-013**: In usability testing, at least 85% of users rate notification language, assistant
  explanations, subscription terms, privacy controls, and support recovery as clear, calm, and
  trustworthy.
- **SC-014**: Notification lists and conversation histories containing 1,000 representative
  items remain navigable, searchable or filterable where specified, and show first useful
  content within two seconds on supported devices.

## Assumptions

- SPEC-001 through SPEC-008 provide product principles, design components, authentication and
  session state, financial records, planning data, reports, tracking outcomes, and correction
  destinations consumed by this feature.
- One notification event may have both an in-app representation and a phone representation;
  the in-app record is the durable user history for this frontend phase. Deleting that record
  removes only the notification and never changes its linked source data.
- Lock-screen amounts are hidden by default. Users may opt in to displaying them when global
  hidden-balance mode is off, but security-sensitive values remain masked.
- Quiet hours defer non-urgent phone delivery only. Security history and all financial events
  remain available in-app. Only critical access alerts, including a new session, session
  revocation, or account-access protection change, bypass quiet hours.
- Assistant answers use only user-consented, confirmed Masarifi data. Pending local records,
  review-required detections, and unresolved conflicts may be identified as incomplete context
  but are not treated as confirmed facts. Each completed response preserves the context snapshot
  it used; new questions use the latest confirmed context unless the user names an earlier
  period or snapshot.
- Assistant projections are educational estimates based on visible assumptions; they do not
  predict returns or provide investment advice.
- Free, Basic, and Premium names are approved, while exact prices, feature matrices, usage
  limits, trial availability, and commercial terms come from the current approved offer catalog
  and are not hard-coded by this specification.
- Existing user-created financial data is not silently deleted when a plan changes or expires.
  Content created exclusively through a paid feature remains visible in read-only form and
  exportable where export already exists, while underlying core financial records remain under
  their owning feature's normal rules.
- Profile phone and linked Google account originate from the existing representative
  authentication state. Changing or unlinking authentication identifiers may redirect to the
  owning authentication flow.
- Data export, account deletion, session revocation, phone delivery, assistant processing,
  purchases, restoration, and support operations use deterministic non-production outcomes in
  this frontend phase.
- Support attachments are excluded from Core V1. Contextual transaction and assistant reports
  use minimal user-reviewed references rather than files or unrestricted financial data.
- Notification lists and assistant conversation histories are validated with up to 1,000
  representative items in Core V1; higher volumes require a later measured scale decision.
