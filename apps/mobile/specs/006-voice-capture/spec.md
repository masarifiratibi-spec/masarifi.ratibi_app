# Feature Specification: Voice Transaction Capture and Smart Categorization UX

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create SPEC-006 - Voice Transaction Capture and Smart Categorization UX from the complete Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-09

- Q: What is the maximum duration for one voice recording? -> A: 60 seconds.
- Q: How should field confidence affect review? -> A: 90% and above is clear; 60-89% requires explicit confirmation; below 60% is treated as missing.
- Q: How long are voice audio and transcripts retained? -> A: Delete audio after transcription or cancellation and delete the transcript after save or cancellation.
- Q: What happens if saving a selected group of voice transactions fails? -> A: Save the selected group atomically; if any item fails, save none and preserve the review.
- Q: How are relative spoken dates resolved? -> A: Resolve them using the device's local date and timezone, show the resulting date, and require confirmation when ambiguous or future-dated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record and Review a Transaction by Voice (Priority: P1)

As a user, I can describe a financial activity naturally, review the transcript and proposed
transaction, correct it if needed, and explicitly save it.

**Why this priority**: Voice capture is the feature's primary value and reduces the effort of
manual transaction entry on both Android and iOS.

**Independent Test**: Record clear Arabic and English examples for an expense, income, and
transfer; verify permission handling, transcript review, extracted values, correction, and save.

**Acceptance Scenarios**:

1. **Given** microphone access is available, **When** the user records a clear supported
   statement and stops, **Then** the transcript and one structured transaction proposal appear
   before any financial record changes.
2. **Given** a proposal is displayed, **When** the user edits and confirms it, **Then** only the
   confirmed values are saved to the normal transaction ledger.
3. **Given** a transcript or proposal is incorrect, **When** the user chooses re-record or
   cancel, **Then** no transaction is saved.
4. **Given** the user speaks Arabic or English, **When** the result is shown, **Then** the full
   recording and review flow remains usable in the selected application language.

---

### User Story 2 - Resolve Missing or Uncertain Information (Priority: P1)

As a user, I can understand which voice-derived values are uncertain or missing and either
correct them, accept a helpful suggestion, or save when only optional information is absent.

**Why this priority**: Financial trust requires uncertainty to be visible without making voice
entry as demanding as a long manual form.

**Independent Test**: Analyze statements with a missing account, unknown merchant, uncertain
category, unsupported currency, and low-confidence value; verify highlighting and save rules.

**Acceptance Scenarios**:

1. **Given** a required value is missing or uncertain, **When** review opens, **Then** the field
   is clearly identified and saving is blocked until the user supplies or confirms it.
2. **Given** only an optional account is missing, **When** review opens, **Then** the user may
   choose a suggested account, another account, or save without an account.
3. **Given** a category suggestion is uncertain, **When** the user changes it, **Then** the user
   may apply the correction only once or choose to reuse it for that merchant in the future.

---

### User Story 3 - Capture Multiple Transactions in One Recording (Priority: P1)

As a user, I can describe several financial activities in one recording and review each
proposed transaction separately before choosing which ones to save.

**Why this priority**: Natural speech often contains more than one purchase, and combining
them must not create hidden or inseparable financial changes.

**Independent Test**: Record a statement containing two expenses and verify separate review,
individual edits and removal, selected confirmation, confirm all, and re-record.

**Acceptance Scenarios**:

1. **Given** one statement clearly contains multiple transactions, **When** analysis completes,
   **Then** each transaction appears as a separate review item.
2. **Given** multiple proposals, **When** the user edits or removes one, **Then** the remaining
   proposals are unchanged.
3. **Given** multiple proposals, **When** the user confirms selected items or all items, **Then**
   only those explicitly confirmed are saved.
4. **Given** a selected group is being saved, **When** any selected item fails, **Then** none of
   the selected items are saved and the complete reviewed group remains available for recovery.

---

### User Story 4 - Record Recurring and Obligation Payments Safely (Priority: P2)

As a user, I can record a spoken installment, subscription, rent, loan payment, or other
recurring activity and decide whether to link or create related financial planning information.

**Why this priority**: Recognizing recurring intent adds value, but must remain subordinate to
explicit user confirmation because it can affect future records and obligation progress.

**Independent Test**: Analyze monthly, weekly, installment, subscription, rent, and loan-payment
statements and verify one-time, recurring, existing-obligation, and new-obligation choices.

**Acceptance Scenarios**:

1. **Given** recurring intent is detected, **When** review opens, **Then** one-time and recurring
   choices are explained and no recurring item is created automatically.
2. **Given** a likely obligation payment is detected, **When** the user confirms an existing
   obligation link, **Then** the transaction and obligation progress update consistently.
3. **Given** no appropriate obligation exists, **When** the user chooses to create one, **Then**
   the proposed obligation details are reviewed before creation.

---

### User Story 5 - Recover from Permission, Recording, and Analysis Problems (Priority: P1)

As a user, I can recover from microphone denial, silence, noise, interruption, unsupported
speech, analysis failure, or offline operation without losing control or being blocked from
manual entry.

**Why this priority**: Voice is optional and must fail safely while leaving the core product
usable.

**Independent Test**: Exercise not-requested, denied, permanently denied, noisy, silent,
interrupted, maximum-duration, unsupported-language, failed-analysis, and offline states.

**Acceptance Scenarios**:

1. **Given** microphone permission is denied, **When** voice entry opens, **Then** the consequence
   and appropriate retry, settings, or manual-entry action are available.
2. **Given** recording is silent, noisy, interrupted, or reaches its maximum duration, **When**
   recording ends, **Then** the user receives a calm explanation and can retry or continue
   manually without a financial change.
3. **Given** transcription or analysis fails, **When** the error appears, **Then** the user can
   retry, edit an available transcript, or switch to manual entry without seeing raw errors.
4. **Given** the device is offline, **When** voice analysis is unavailable, **Then** the user is
   told that saving a voice-derived transaction cannot complete and manual entry remains usable.

### Edge Cases

- The recording contains no speech, only background noise, or speech below useful confidence.
- The speaker mixes Arabic and English, changes language mid-sentence, or uses regional terms.
- The statement omits an amount, includes several possible amounts, or uses an unsupported or
  ambiguous currency.
- A date is relative and crosses midnight or a timezone boundary, is ambiguous, in the future,
  or falls outside an allowed transaction range.
- The merchant, beneficiary, category, payment method, and funding account conflict.
- Payment method and funding account are mistaken for each other, such as Apple Pay and the
  bank card behind it.
- Multiple transactions share one total, one merchant, or incomplete values.
- A recurring phrase may describe only the current payment rather than a request to create a
  recurring item.
- An obligation has zero, one, or several possible matches.
- The user changes or removes one proposal after reviewing several transactions.
- Permission changes while recording, the app moves to the background, a call interrupts the
  session, or the recording reaches the maximum duration.
- The user navigates away after recording but before saving.
- Long Arabic text, mixed-direction account names, hidden balances, and 200% text size must not
  hide values, confidence, or actions.

## Requirements *(mandatory)*

### Scope Boundaries

This specification owns microphone permission and recovery, voice recording feedback,
transcript review, voice-derived transaction proposals, missing and uncertain field handling,
multiple-transaction review, recurring and obligation suggestions, smart category correction,
explicit save behavior, and the user-facing effects of saved voice transactions.

It consumes accounts, transactions, categories, and correction behavior from SPEC-004 and may
link to obligations defined by SPEC-007. Android SMS capture belongs to SPEC-005. Production
speech recognition, production AI analysis, provider selection, backend synchronization,
camera or receipt capture, and smart-assistant conversations are outside this specification.

### Functional Requirements

- **FR-001**: Voice entry MUST be available from Home and the Add transaction experience on
  both Android and iOS.
- **FR-002**: The experience MUST explain why microphone access is needed before requesting it
  and MUST begin recording only after explicit permission.
- **FR-003**: Permission recovery MUST distinguish not requested, granted, denied, and
  permanently denied states and provide the appropriate retry, settings, manual-entry, or
  continue action.
- **FR-004**: Denying microphone access MUST NOT block Home, accounts, transactions, tracking,
  reports, or manual transaction entry.
- **FR-005**: The recording experience MUST provide start, duration, active-recording feedback,
  stop, cancel, re-record, example phrases, background-noise guidance, a 60-second maximum with
  advance warning, and an interrupted-recording state.
- **FR-006**: Recording meaning MUST remain understandable without waveform animation, color,
  sound, or haptic feedback alone.
- **FR-007**: The transcript MUST be visible before saving and MUST be editable or replaceable
  through re-recording.
- **FR-008**: No voice-derived financial record MAY be created before the user reviews and
  explicitly confirms the proposed result.
- **FR-009**: A proposal MUST represent transaction type, amount, currency, merchant, category,
  subcategory, payment method, funding account, date, time, beneficiary, recurring intent,
  obligation link, notes, confidence, and missing fields when those values are applicable.
- **FR-010**: The experience MUST visually and textually distinguish payment method from the
  funding account and allow either value to be corrected independently.
- **FR-011**: Amount, currency, transaction type, and date MUST be treated as required for a
  saved transaction; any unresolved required value MUST block saving and identify the needed
  correction.
- **FR-012**: Missing optional information MUST NOT block saving.
- **FR-013**: When an account is missing, users MUST be able to select a suggested account,
  choose another account, or save without an account when the transaction type permits it.
- **FR-014**: A material field with confidence of 90% or more MAY appear as clear, confidence
  from 60% through 89% MUST be highlighted and explicitly confirmed, and confidence below 60%
  MUST be treated as missing and entered by the user. Conflicting values MUST require correction.
- **FR-015**: The experience MUST support clear expense, income, transfer, and obligation-payment
  proposals.
- **FR-016**: One recording MUST be able to produce one or more separate transaction proposals.
- **FR-017**: Each proposal in a multiple-transaction result MUST support independent review,
  editing, and removal.
- **FR-018**: Multiple-proposal review MUST support confirm selected, confirm all, re-record,
  and cancel. A selected group MUST save as one outcome: all selected proposals are saved, or
  none are saved and the reviewed group is preserved for recovery.
- **FR-019**: A detected monthly, weekly, installment, subscription, rent, or loan-payment phrase
  MAY suggest a recurring transaction, an existing obligation link, a new obligation, or a
  one-time payment.
- **FR-020**: No recurring item, obligation, or obligation link MAY be created without explicit
  preview and user confirmation.
- **FR-021**: A confirmed obligation payment MUST update the saved transaction and related
  obligation progress consistently.
- **FR-022**: Multiple or conflicting obligation matches MUST require user selection before any
  obligation changes.
- **FR-023**: Category suggestions MUST follow this visible precedence: an existing user rule,
  a known merchant rule, a keyword rule, then a smart suggestion.
- **FR-024**: When the user changes a suggested category, the experience MUST offer to apply the
  correction only this time or reuse it for that merchant; declining MUST preserve the current
  transaction correction without creating a future preference.
- **FR-025**: A saved voice transaction MUST enter the normal ledger and update applicable
  balances, budgets, reports, and confirmed obligation progress.
- **FR-026**: Saving MUST provide immediate success or failure feedback, prevent duplicate
  submissions, and preserve reviewed values when recovery is possible.
- **FR-027**: Saved voice transactions MUST be identifiable as voice-created and become
  available to notifications and financial guidance according to existing user preferences.
- **FR-028**: Audio MUST be deleted after transcription completes or the session is canceled,
  and the transcript MUST be deleted after save or cancellation. Only confirmed transaction
  data and the voice source type MAY remain. Audio and transcripts MUST NOT appear in
  notifications, analytics, raw errors, or unrelated accessibility output.
- **FR-029**: Canceling, re-recording, failed analysis, unsupported language, no speech, or
  permission failure MUST NOT create or modify a financial record.
- **FR-030**: The feature MUST provide understandable loading, recording, processing, review,
  partial-result, empty, error, offline, permission, save-pending, save-failed, and success states.
- **FR-031**: Error and recovery messages MUST be calm, actionable, and free of raw provider or
  internal analysis details.
- **FR-032**: The full experience MUST provide Arabic RTL and English LTR parity, accept natural
  statements in both supported languages, use English numerals with locale-aware financial
  formatting, and handle mixed-direction merchant, account, beneficiary, currency, and amount
  content intentionally.
- **FR-033**: Controls MUST meet a 44-by-44 minimum target, remain usable at 200% text size,
  expose clear labels and logical screen-reader order, and support reduced motion.
- **FR-034**: Users who cannot or choose not to speak MUST have a complete text-based manual
  transaction fallback from every blocking permission or error state.
- **FR-035**: The frontend phase MUST demonstrate clear single, missing-account, unknown-merchant,
  multiple, income, transfer, obligation, failed-analysis, low-confidence, unsupported-language,
  and no-speech scenarios without claiming production speech or AI behavior.
- **FR-036**: Relative spoken dates MUST resolve from the device's local date and timezone at
  recording time and display the resulting date in review. Ambiguous, future, or out-of-range
  dates MUST require explicit confirmation or correction before saving.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android and iOS receive the same voice-first capture value, platform-
  appropriate microphone permission recovery, and a complete manual fallback. The feature does
  not imply Android SMS access on iOS.
- **Financial trust**: Transcript and structured proposals are reviewed before saving. Missing,
  uncertain, recurring, and obligation effects require visible correction or confirmation; no
  audio-derived financial change occurs silently.
- **Localization and accessibility**: Arabic RTL and English LTR have complete parity. The flow
  supports English numerals, mixed-direction financial content, screen readers, 200% text,
  minimum touch targets, reduced motion, and non-visual recording status.
- **UI states and tokens**: Existing Gulf Premium semantic tokens and components remain
  authoritative. Permission, recording, processing, review, partial, empty, error, offline,
  save, and interruption states are covered.
- **Verification**: Focused checks cover permission mapping, record/save transitions, multiple
  proposals, required-field rules, category preference choices, obligation effects, financial
  summary consistency, both languages and themes, device sizes, and accessibility.

### Key Entities *(include if feature involves data)*

- **Voice Capture Session**: One temporary user-initiated recording attempt with permission
  state, recording status and duration, transcript, selected language, interruption or failure
  state, and whether the user canceled, re-recorded, or continued to review. Its audio and
  transcript follow the defined deletion points.
- **Voice Transcript**: The reviewable text derived from a recording, including language,
  confidence, user corrections, and analysis state.
- **Voice Transaction Proposal**: One proposed expense, income, transfer, or obligation payment
  with extracted financial values, confidence, missing or conflicting fields, category source,
  recurring intent, and confirmation state.
- **Proposal Group**: The set of proposals derived from one recording with individual selection,
  editing, removal, and group confirmation state.
- **Category Preference**: A user-approved association between a merchant and category for
  future suggestions, distinct from a one-time category correction.
- **Recurring or Obligation Suggestion**: A proposed one-time, recurring, existing-obligation,
  or new-obligation relationship that has no financial effect until confirmed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of test users can record, review, and save a clear single transaction
  in under 45 seconds on their first attempt.
- **SC-002**: 100% of tested voice flows show the transcript and structured proposal before any
  financial record changes.
- **SC-003**: 100% of clear expense, income, transfer, and obligation examples produce the
  expected number of reviewable proposals and save only explicitly confirmed items.
- **SC-004**: 100% of fields below 60% confidence are treated as missing, fields from 60% through
  89% require explicit confirmation, and unresolved required fields prevent saving, while every
  optional-only omission permits completion.
- **SC-005**: At least 90% of users correctly distinguish payment method from funding account
  and correct either value within 20 seconds.
- **SC-006**: 100% of tested multi-transaction recordings allow independent edit, removal, and
  selection without changing sibling proposals.
- **SC-007**: Zero tested recurring items, new obligations, or obligation links are created
  without explicit preview and confirmation.
- **SC-008**: Every saved acceptance example updates the ledger and all applicable visible
  balances, budgets, reports, and obligation progress consistently.
- **SC-009**: At least 90% of users recover from each permission, recording, or analysis problem
  or reach manual entry within 30 seconds without assistance.
- **SC-010**: All critical flows complete in Arabic RTL and English LTR at 200% text size without
  hiding transcript text, financial values, uncertainty, status, or primary actions.
- **SC-011**: At least 85% of test users rate the transcript, confidence, missing-field guidance,
  and confirmation controls as clear and trustworthy.

## Assumptions

- SPEC-001 through SPEC-005 provide product principles, design components, navigation,
  authentication, accounts, transactions, categories, manual entry, and platform honesty used
  by this feature.
- SPEC-007 will define full obligation creation and progress behavior; this feature owns only
  the voice-derived suggestion, preview, and confirmed handoff.
- The frontend phase uses representative simulated recording, transcription, analysis, and
  failure results. Production speech recognition, AI providers, and backend processing remain
  future integration work.
- The application language is the initial expected speech language; mixed Arabic and English
  speech is accepted where the demonstrated analysis scenario supports it.
- Audio is retained only until transcription completes and the transcript only until the user
  saves or cancels; the saved financial record keeps confirmed transaction data and source type.
- Notification delivery and smart-assistant use of saved transactions follow their own feature
  specifications and user preferences.
- Camera capture, receipt scanning, production AI, investments, and direct bank connections
  remain outside scope.
