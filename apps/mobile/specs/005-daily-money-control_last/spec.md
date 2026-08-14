# Feature Specification: Daily Money Control

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Turn the reviewed reference-app UX/UI analysis into the first of two Masarifi specifications: the daily money experience covering Home, transactions, entry, accounts, categories, automatic tracking, review, and voice capture while preserving Masarifi's trust, platform, RTL, accessibility, and Gulf Premium requirements."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand Today at a Glance (Priority: P1)

As a Masarifi user, I can open Home and immediately understand my available money, recent movement, current salary-cycle position, items needing review, and the next useful action without decoding decorative cards.

**Why this priority**: Home is the daily trust surface and the entry point to every core money task.

**Independent Test**: Populate accounts, transactions, a review item, and one upcoming obligation, then verify that Home presents the current position and links to each underlying detail while masking sensitive values when requested.

**Acceptance Scenarios**:

1. **Given** the user has current financial data, **When** Home opens, **Then** total balance, period movement, salary-cycle summary, review status, recent transactions, and relevant planning previews appear in the approved hierarchy.
2. **Given** balances are hidden, **When** Home and its previews render, **Then** sensitive amounts are consistently masked and no accessible announcement reveals them.
3. **Given** there is no financial data, **When** Home opens, **Then** a calm empty state explains automatic, manual, and voice capture with one primary setup action.
4. **Given** totals combine currencies, **When** an aggregate is shown, **Then** it is visibly and accessibly identified as an estimate.

---

### User Story 2 - Find and Correct Transactions (Priority: P1)

As a user, I can scan, search, filter, inspect, and correct transactions while understanding each record's amount, meaning, account, source, and status.

**Why this priority**: A trustworthy ledger is the core record of the product and the recovery path for automatic mistakes.

**Independent Test**: Use a realistic dense ledger containing manual, automatic, voice, transfer, refund, failed, pending-sync, and review-required records; verify discovery, detail, correction, and state distinctions.

**Acceptance Scenarios**:

1. **Given** a dense ledger, **When** the user searches or combines period, account, category, type, source, status, and amount filters, **Then** matching transactions appear grouped by date and all active filters remain visible and removable.
2. **Given** no record matches active filters, **When** results load, **Then** the user sees a filtered-empty explanation with clear-all and add-transaction actions rather than the first-use empty state.
3. **Given** a refund, reversal, transfer, failed transaction, or obligation payment, **When** it appears in the list or detail, **Then** its semantic meaning is conveyed by text and status as well as color.
4. **Given** an automatically added transaction is still reversible, **When** the user selects undo or correction, **Then** the financial effect and related summaries are restored or recalculated consistently.

---

### User Story 3 - Record Money Quickly and Safely (Priority: P1)

As a user, I can add an expense, income, transfer, refund, or obligation payment through an amount-first flow that preserves my work and makes the financial effect clear before saving.

**Why this priority**: Manual entry is the universal fallback and must remain dependable regardless of platform, permission, connectivity, or automation quality.

**Independent Test**: Complete each supported transaction type with valid and invalid values, interrupted navigation, keyboard display, and offline operation; verify draft preservation and correct ledger effects.

**Acceptance Scenarios**:

1. **Given** the user opens Add, **When** a transaction type is selected, **Then** the amount is the dominant field and only fields relevant to that type are presented.
2. **Given** required data is invalid or missing, **When** save is attempted, **Then** actionable validation appears without clearing entered values.
3. **Given** the user records a transfer, **When** source and destination match or the balance effect is unclear, **Then** saving is blocked with a specific explanation.
4. **Given** the device is offline, **When** a valid manual transaction is saved, **Then** it remains editable and visibly pending synchronization.
5. **Given** the user tries to leave a meaningful unsaved draft, **When** navigation occurs, **Then** the user can keep editing or explicitly discard the draft.

---

### User Story 4 - Manage Accounts and Categories (Priority: P2)

As a user, I can maintain the accounts and categories that give transactions accurate financial context.

**Why this priority**: Entry and reporting stay understandable only when account and category choices are searchable, stable, and correctable.

**Independent Test**: Create, edit, search, archive, and select accounts and categories in Arabic and English, including duplicate names, long labels, and empty lists.

**Acceptance Scenarios**:

1. **Given** several accounts, **When** the user opens Accounts, **Then** each row communicates type, masked identifier, currency, balance or available credit, default state, and archived state where applicable.
2. **Given** an account detail, **When** it opens, **Then** the user can understand its current balance, recent activity, income/expense summary, and available management actions.
3. **Given** a long category catalogue, **When** the user selects a category, **Then** search, recent or favorite choices, hierarchy, and current selection reduce effort without relying on emoji or color alone.
4. **Given** a custom category is in use, **When** archive or merge is requested, **Then** the effect on existing transactions is explained before confirmation.

---

### User Story 5 - Trust Automatic and Voice Capture (Priority: P1)

As a user, I can understand tracking status, review uncertainty, undo clear automatic additions, and confirm voice-derived records before any financial change becomes final.

**Why this priority**: Low-effort capture is Masarifi's product promise, but it is useful only when platform limits and financial effects remain transparent.

**Independent Test**: Exercise Android permission states, iOS alternatives, clear and ambiguous detections, duplicates, voice success/failure, missing fields, and multiple proposed transactions.

**Acceptance Scenarios**:

1. **Given** an Android user has not granted SMS access, **When** tracking setup begins, **Then** education and explicit consent precede the operating-system request and declining leaves manual and voice entry available.
2. **Given** an iOS user opens capture settings, **When** options appear, **Then** no direct SMS inbox access is shown or implied and honest alternatives are offered.
3. **Given** a clear automatic detection, **When** it is added, **Then** the user sees the source, resulting record, and immediate view, edit, and undo actions.
4. **Given** a detection is uncertain, conflicting, or possibly duplicated, **When** processing finishes, **Then** it enters review without silently changing financial records.
5. **Given** voice analysis succeeds, **When** proposed data appears, **Then** the transcript and every proposed transaction can be reviewed, edited, removed, re-recorded, or explicitly confirmed.
6. **Given** voice capture fails or permission is denied, **When** recovery is shown, **Then** the message is actionable and manual entry remains available.

### Edge Cases

- A total or transaction amount is too long for one line, negative, zero, unusually large, or uses a currency different from the selected account.
- Search or filter labels expand under Arabic or 200% text scaling, or no results match a valid filter combination.
- A transfer uses the same account, an archived account, insufficient mock balance, or two currencies without an available conversion estimate.
- A refund or reversal has no original transaction, has already been linked, or only partially offsets the original amount.
- An automatic message contains several amounts, OTP language, failure language, an unknown sender, ambiguous account hints, or a likely duplicate.
- Undo is no longer available because its window expired; correction and transaction detail remain available.
- Tracking permission is denied, permanently denied, revoked in settings, paused, interrupted, or affected by battery restrictions.
- Voice input has no speech, an unsupported language, background noise, interruption, multiple transactions, or missing optional fields.
- A transaction saved offline is edited before synchronization or conflicts with a later update.
- Hiding balances, changing language, or switching theme occurs while a form, picker, sheet, or review flow is open.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST retain Home, Transactions, Add, Reports, and More as the five primary destinations; Accounts and Assistant MUST remain secondary destinations.
- **FR-002**: Home MUST prioritize total balance, current salary-cycle position, quick actions, tracking or review status, recent transactions, and contextually relevant budget, obligation, goal, and insight previews.
- **FR-003**: Home MUST show one dominant financial answer and one clear next action without requiring users to scan excessive decorative content.
- **FR-004**: Every aggregate MUST identify its currency context, and converted multi-currency aggregates MUST be labeled as estimates.
- **FR-005**: Users MUST be able to mask and reveal sensitive values through an authorized action, with the choice applied consistently across this feature.
- **FR-006**: The transaction ledger MUST group records by date and support search, sorting, period selection, and filters for account, category, type, source, status, amount range, and review requirement.
- **FR-007**: Active filters MUST be visible, individually removable, and clearable together.
- **FR-008**: The ledger MUST distinguish first-use empty, filtered-empty, loading, error, offline, pending-sync, and end-of-list states.
- **FR-009**: Every transaction presentation MUST communicate amount and currency, financial meaning, title or merchant, account, date, source, and status when applicable.
- **FR-010**: Expense, income, transfer, refund, reversal, adjustment, fee, failed, recurring, obligation-payment, automatic, voice, and manual records MUST remain semantically distinguishable.
- **FR-011**: Transaction detail MUST expose the record's financial fields, source, related account/category/obligation, correction actions, and original detected-text preview only when privacy rules permit.
- **FR-012**: Users MUST be able to edit and delete eligible records, duplicate a record as a starting point, link supported refunds, report an incorrect classification, and use undo while available.
- **FR-013**: Add MUST provide amount-first flows for expense, income, transfer, refund, and obligation payment with one primary save action.
- **FR-014**: Required entry data MUST be limited to transaction type, amount, account or payment source, category, and date, with type-specific additions only when financially necessary.
- **FR-015**: Validation MUST identify the exact problem, preserve entered data, focus the relevant field, and never expose internal errors.
- **FR-016**: Meaningful drafts MUST survive validation failures, temporary interruptions, and accidental navigation until the user saves or explicitly discards them.
- **FR-017**: Valid manual transactions created offline MUST remain editable and display pending synchronization until resolved.
- **FR-018**: Transfer entry MUST prevent identical source and destination accounts and explain the effect on each balance, fees, and any estimated currency conversion.
- **FR-019**: Refunds and reversals MUST remain linked to their original transaction when known and MUST NOT be presented as ordinary salary or income.
- **FR-020**: The account list MUST show total context plus account type, masked identifier, currency, balance, available credit where relevant, default state, and archived state.
- **FR-021**: Account detail MUST provide recent transactions, income/expense summary, account-specific report access, edit, archive, balance adjustment, and transfer actions.
- **FR-022**: Account selection MUST support realistic list density, search, empty state, current selection, archived restrictions, and long labels.
- **FR-023**: Category selection MUST support search, recent or favorite choices, system and custom categories, hierarchy, and an explicit selected state.
- **FR-024**: Custom categories MUST have text labels in Arabic and English; icon and color MAY personalize them but MUST NOT be their only identity.
- **FR-025**: Category archive or merge MUST explain the effect on existing transactions and require confirmation.
- **FR-026**: Android tracking setup MUST provide education and explicit consent before requesting SMS access, accurately describe permission scope, and keep tracking optional.
- **FR-027**: Tracking status MUST represent not requested, granted, denied, permanently denied, revoked, paused, interrupted, and battery-restricted states with a state-specific recovery action.
- **FR-028**: Clear automatic detections MUST expose their source and immediate view, edit, and undo actions after addition.
- **FR-029**: Uncertain, duplicate, conflicting, low-confidence, failed, or ambiguous detections MUST enter review without silently changing financial records.
- **FR-030**: Review MUST allow confirm, edit, account/category/obligation selection, keep or merge duplicate candidates, ignore, and report-wrong-detection actions as relevant.
- **FR-031**: iOS MUST NOT request, show, or imply direct SMS inbox tracking and MUST offer manual, voice, and approved platform alternatives of equal visual quality.
- **FR-032**: Voice capture MUST show permission education, recording status, duration, cancel, stop, re-record, transcript, processing, interruption, no-speech, and failure states.
- **FR-033**: Voice-derived records MUST remain proposals until the user reviews the transcript and explicitly confirms one or more structured transactions.
- **FR-034**: A single voice recording MAY propose multiple transactions, each independently editable, removable, and selectable for confirmation.
- **FR-035**: Missing optional voice fields MUST NOT block saving; low-confidence or required missing fields MUST be visibly identified for review.
- **FR-036**: Source, review, undo, correction, permission, sync, and privacy meaning MUST be conveyed through text and semantics rather than color, animation, or iconography alone.
- **FR-037**: All screens MUST provide Arabic RTL and English LTR parity, use English numerals with locale-aware financial formatting, and preserve natural reading of mixed-direction amounts, dates, phone numbers, and identifiers.
- **FR-038**: Direction-dependent navigation controls MUST mirror appropriately, while financial chronology and non-directional icons MUST retain their meaning.
- **FR-039**: All primary controls MUST meet the 44-by-44 minimum target, all content MUST remain usable at 200% text size, and screen-reader focus MUST follow the visual and logical task order.
- **FR-040**: Navigation, sheets, dialogs, recording feedback, loading, and success/error feedback MUST remain understandable with reduced motion enabled.
- **FR-041**: Every asynchronous operation MUST expose progress, success, failure, retry, and safe cancellation where cancellation does not risk data loss.
- **FR-042**: The experience MUST use Masarifi's Gulf Premium dark-teal hierarchy, semantic financial and status meanings, restrained borders/shadows, and calm non-judgmental language; reference branding and saturated feature palettes MUST NOT be copied.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android automatic capture follows education, explicit consent, permission recovery, and manual/voice fallbacks. iOS exposes no direct SMS claim and offers honest alternatives. Permission denial, offline operation, and automation failure never block manual capture.
- **Financial trust**: Automatic additions expose source and undo/correction; uncertainty enters review; voice changes require transcript review and explicit confirmation. Sensitive values stay maskable and are excluded from unsafe previews, announcements, errors, and analytics.
- **Localization and accessibility**: Every state and string is complete in Arabic RTL and English LTR. Financial numbers remain naturally readable with locale-aware formatting. Touch, contrast, 200% scaling, screen-reader order, non-color meaning, and reduced motion are acceptance requirements.
- **UI states and tokens**: All surfaces use the existing semantic Gulf Premium system. Loading, empty, filtered-empty, error, offline, disabled, permission, review, undo, and sync states are required; no parallel brand or token language is introduced.
- **Verification**: Acceptance checks cover financial calculations and state transitions, dense data, Arabic and English, light and dark modes, small and large phones, accessibility text, screen readers, reduced motion, offline behavior, and every permission state.

### Key Entities *(include if feature involves data)*

- **Account**: A financial source or destination with type, currency, masked identifier, current balance, optional available credit, default status, and active or archived state.
- **Transaction**: A dated financial event with type, amount, currency, merchant or title, account, category, payment method, source, operational status, review status, notes, and optional obligation or original-transaction relationship.
- **Category**: A system or user-defined classification with Arabic and English labels, hierarchy, optional icon/color personalization, favorite status, and active or archived state.
- **Detected Item**: An automatic capture candidate with source evidence, extracted fields, confidence, ambiguity reasons, duplicate candidates, and review outcome.
- **Voice Proposal**: A transcript plus one or more proposed transactions, missing or low-confidence fields, selection state, and confirmation outcome.
- **Review Item**: A pending decision that links a detected item to candidate accounts, categories, obligations, or duplicates and records the user's resolution.
- **Draft Transaction**: User-entered data retained before final save, including validation, offline, and discard state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In moderated testing, at least 90% of users identify available balance, current-period movement, and pending review from Home within 10 seconds without assistance.
- **SC-002**: At least 90% of users complete a simple manual expense or income entry in 60 seconds or less on their first attempt.
- **SC-003**: At least 90% of users locate a specified transaction in a 500-record ledger within 30 seconds using search or filters.
- **SC-004**: 100% of tested automatic additions expose source plus a working view, edit, and undo or correction path; zero uncertain test cases silently alter financial records.
- **SC-005**: 100% of tested voice saves show the transcript and structured proposal before confirmation; zero voice proposals create records without explicit user confirmation.
- **SC-006**: All supported permission and offline scenarios leave at least one usable transaction-entry path and provide an actionable recovery message.
- **SC-007**: All critical flows complete in Arabic RTL and English LTR at 200% text size without hiding amounts, status, validation, or primary actions.
- **SC-008**: All tested financial states remain understandable in grayscale and through screen-reader output without relying on color, icons, motion, or haptics alone.
- **SC-009**: In usability testing, at least 85% of users rate transaction source, status, and correction controls as clear or very clear.

## Assumptions

- Existing authentication, onboarding, security, navigation meanings, localization, privacy masking, and design-system foundations are retained rather than redesigned.
- This specification consolidates the daily-money portions of master SPEC-004, SPEC-005, and SPEC-006 into one independently plannable delivery unit.
- Reports, budgets, obligations, savings goals, and assistant conversations are implemented by the companion Planning and Financial Guidance specification; Home may show compact previews that link to those owned surfaces.
- Automatic analysis, voice analysis, synchronization, and account data are represented through replaceable non-production behavior during the frontend phase.
- Camera capture, receipt scanning, investments, household collaboration, production banking connections, and production AI/payment providers remain outside scope.
- Reference patterns are quality evidence only; Masarifi branding, approved navigation, platform honesty, and financial trust requirements remain authoritative.
