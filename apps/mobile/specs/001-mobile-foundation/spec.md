# Feature Specification: Product Foundation, Scope, and UX Principles

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Create SPEC-001 - Product Foundation, Scope, and UX Principles from the Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-05

- Q: Who is Core V1 designed for? -> A: Individual personal-finance users only.
- Q: How are sensitive amounts displayed by default? -> A: Visible only in an authenticated
  app session; masked on lock-screen notifications and in the app switcher, with a persistent
  hide-balances control.
- Q: What happens to manual entries created offline? -> A: Save locally immediately and mark
  them pending sync until synchronization is confirmed.
- Q: How does Core V1 handle multiple currencies? -> A: Use one selected base reporting
  currency, retain original transaction amounts, and label converted aggregates as estimates.
- Q: What data deletion is guaranteed in the frontend-only phase? -> A: Device-local data is
  deleted immediately; account deletion and export remain clearly labeled request simulations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand My Financial Position Quickly (Priority: P1)

As a returning user, I can open Masarifi and quickly understand how much money I have,
what I spent, what remains until salary, what obligations are due, and what needs my
attention without performing calculations.

**Why this priority**: Financial awareness is the central product promise and the reason
the other capabilities exist.

**Independent Test**: Present a returning user with representative financial data and
verify that they can identify their balance, recent spending, next obligation, and review
items from the primary experience without assistance.

**Acceptance Scenarios**:

1. **Given** a returning user with accounts and recent activity, **When** they open the
   application, **Then** the current financial position and next important action are clear.
2. **Given** a user with no financial data, **When** they open the application, **Then** they
   see a useful empty state with one clear next action rather than misleading totals.
3. **Given** incomplete or stale data, **When** the financial summary is shown, **Then** the
   interface identifies the data state and does not present uncertain values as complete.

---

### User Story 2 - Capture Activity With Minimal Effort (Priority: P1)

As a user, I can record financial activity automatically, by voice, or manually, and I can
still use the application when automation is unavailable or declined.

**Why this priority**: Manual tracking is commonly abandoned; Masarifi must reduce effort
without making automation a condition of use.

**Independent Test**: Disable or reject every optional automation permission and verify that
the user can still add income, expenses, transfers, adjustments, and obligation payments.

**Acceptance Scenarios**:

1. **Given** an Android user who grants SMS permission, **When** a clear eligible financial
   message is detected, **Then** the activity can be added automatically with immediate
   feedback and correction controls.
2. **Given** an Android user who declines SMS permission, **When** onboarding completes,
   **Then** manual and voice capture remain available and the core application is usable.
3. **Given** an iOS user, **When** capture options are presented, **Then** only honest manual,
   voice, and approved iOS alternatives appear; no Android SMS capability is promised.

---

### User Story 3 - Trust and Correct Financial Changes (Priority: P1)

As a user, I can understand where every automatic financial change came from and can undo,
edit, or report it when it is wrong.

**Why this priority**: A finance product loses trust when records change invisibly or cannot
be corrected.

**Independent Test**: Simulate clear, ambiguous, duplicate, failed, and conflicting detected
activity and verify that each result is either safely added with correction controls or
routed for review.

**Acceptance Scenarios**:

1. **Given** a clear automatic transaction, **When** it is added, **Then** its source is
   visible and undo or edit is immediately available.
2. **Given** an uncertain or conflicting result, **When** analysis completes, **Then** no
   silent financial change occurs and the item enters a review flow.
3. **Given** an assistant suggestion that would change financial data, **When** the user
   views the suggestion, **Then** the exact change is previewed and explicit confirmation is
   required before it is applied.

---

### User Story 4 - Use Masarifi in My Language and Ability Context (Priority: P2)

As an Arabic or English user, including a user relying on accessibility features, I receive
the same complete, understandable product experience.

**Why this priority**: Language direction or accessibility needs must not reduce a user's
ability to understand financial information.

**Independent Test**: Run the same representative journey in Arabic RTL and English LTR
with large text, a screen reader, reduced motion, and hidden balances enabled.

**Acceptance Scenarios**:

1. **Given** Arabic is selected, **When** any Core V1 journey is used, **Then** content and
   navigation follow RTL while numbers, dates, and mixed-direction identifiers remain clear.
2. **Given** English is selected, **When** the same journey is used, **Then** the content is
   complete and behavior matches the Arabic journey.
3. **Given** a user cannot perceive color, motion, illustration, or haptics, **When** a
   financial or system state changes, **Then** text and semantic cues communicate the state.

### Edge Cases

- An optional permission is denied, permanently denied, later revoked, or unavailable.
- Automation is paused, fails, produces low confidence, or conflicts with an existing item.
- The device is offline, synchronization is pending, synchronization fails, or only partial
  data is available.
- The user has no accounts, salary, budgets, obligations, savings goals, or transactions.
- A critical form is interrupted by navigation, validation failure, or temporary app closure.
- Arabic text expands, system font size increases, or a mixed-direction value appears in RTL.
- Sensitive balances are hidden while summaries, notifications, or assistant content appear.
- An offline manual entry is edited or removed before its pending synchronization completes.
- Accounts or transactions use a currency different from the selected reporting currency.
- A capability exists on one operating system but not the other.
- A user attempts to access an excluded or Post-MVP capability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST prioritize automatic capture while always providing a manual
  path for the same essential financial outcome.
- **FR-002**: Users MUST be able to add income, expenses, transfers, obligation payments, and
  adjustments manually without enabling automation.
- **FR-003**: Each screen MUST answer one primary user question or support one primary action.
- **FR-004**: Advanced options MUST remain hidden until the user's intent makes them relevant.
- **FR-005**: Onboarding MUST deliver product value before requiring a complete financial
  profile, and all optional setup steps MUST be skippable.
- **FR-006**: Every automatic financial addition MUST expose its source and provide undo or
  correction.
- **FR-007**: Ambiguous, conflicting, duplicate, or insufficient-confidence activity MUST be
  routed for review rather than silently changing financial records.
- **FR-008**: Assistant-proposed record changes MUST show a preview and require explicit user
  confirmation.
- **FR-009**: Android and iOS MUST share the same product identity while presenting only the
  capabilities genuinely available on each platform.
- **FR-010**: Android MUST present education and explicit consent before requesting SMS access,
  and declining access MUST NOT block the application.
- **FR-011**: iOS MUST NOT show or promise direct Android SMS tracking and MUST provide manual,
  voice, and approved platform alternatives.
- **FR-012**: User-facing language MUST be calm, practical, and non-judgmental.
- **FR-013**: Amounts, dates, account names, statuses, sources, and next actions MUST receive
  greater visual priority than decoration.
- **FR-014**: Permission experiences MUST explain what is requested, why it is needed, what
  data is analyzed, how to disable it, and how to remove local data.
- **FR-015**: Every relevant asynchronous experience MUST define initial, loading, success,
  empty, error, offline, partial-data, permission, synchronization, read-only, disabled, and
  archived states where applicable.
- **FR-016**: Critical forms MUST preserve entered data after validation errors and accidental
  navigation.
- **FR-017**: Financial values MUST be visible only in an authenticated app session, masked in
  lock-screen notifications and the app switcher, and controlled by a persistent global
  hide-balances preference.
- **FR-018**: Core V1 MUST include authentication, progressive onboarding, Home, accounts,
  transactions, categories, manual and voice entry, salary, budgets, obligations, debts and
  installments, savings goals, reports, report email settings, notifications, assistant,
  profile, security, subscription, support, offline states, both languages, and both themes.
- **FR-019**: Android V1 MUST include SMS tracking onboarding and status, keyword and sender
  management, automatic detection feedback, review, notifications, background state, and
  permission recovery.
- **FR-020**: iOS V1 MUST include a platform explanation, manual and voice-first capture,
  approved optional automation setup, quick actions, and widget configuration without a
  direct SMS inbox claim.
- **FR-021**: Camera access, receipt photography, receipt scanning, investments, customer web
  dashboard functionality, and production service behavior MUST NOT appear in Core V1.
- **FR-022**: All Core V1 experiences MUST be complete in Arabic RTL and English LTR.
- **FR-023**: Financial numbers and dates MUST use English numerals and locale-aware formatting.
- **FR-024**: The product MUST remain understandable with large text, a screen reader, reduced
  motion, and without relying on color, illustration, motion, or haptics alone.
- **FR-025**: Technical failures MUST be translated into a clear user action and MUST NOT expose
  raw system or provider errors.
- **FR-026**: Core V1 MUST serve individual personal-finance users only; shared household,
  family, and business account roles are outside its scope.
- **FR-027**: Manual entries created offline MUST save locally immediately, remain editable,
  and display pending synchronization until synchronization is confirmed.
- **FR-028**: Users MUST select one base reporting currency; original transaction amounts MUST
  be retained and converted aggregate values MUST be labeled as estimates.
- **FR-029**: Deleting device-local data MUST take effect immediately; account deletion and
  data-export actions MUST be presented as simulated requests during the frontend-only phase.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android prioritizes consent-based SMS tracking; iOS presents honest
  alternatives. Permission denial always leaves manual and voice paths available.
- **Financial trust**: Automatic changes expose source and undo/correction; uncertain results
  require review; assistant changes require confirmation; sensitive values are hidden on
  request and excluded from exposed errors.
- **Localization and accessibility**: Arabic RTL and English LTR have complete parity;
  financial values use English numerals and locale-aware formatting; every outcome remains
  understandable with assistive technology and non-color cues.
- **UI states and tokens**: Every applicable global state is specified, and visual work must
  use the shared semantic design system across light and dark modes and supported phone sizes.
- **Verification**: Acceptance must cover both platforms, both languages, both themes,
  permission denial, offline and partial data, large text, hidden balances, automatic undo,
  review routing, and all explicit exclusions.

### Key Entities

- **Product Capability**: A user-visible Core V1, platform-specific V1, Post-MVP, or excluded
  capability with an intended outcome and scope classification.
- **Capture Method**: Automatic, voice, manual, or approved platform-assisted entry, including
  availability, required permission, fallback, and confidence state.
- **Financial Change**: A proposed or completed record change with source, certainty, status,
  user confirmation, and correction options.
- **Platform Capability**: An Android or iOS operating-system capability and the honest
  alternative offered when parity is impossible.
- **Permission State**: The request purpose, current authorization state, recovery action,
  disable path, and effect on product availability.
- **Frontend State**: The user-visible condition of an asynchronous screen or component,
  including loading, empty, error, offline, partial, permission, and synchronization states.
- **Reporting Currency**: The user's selected base currency for summaries, with original
  transaction amounts preserved and converted aggregates identified as estimates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of representative returning users can identify their current
  balance, recent spending, next obligation, and review status within 10 seconds of opening
  the primary experience.
- **SC-002**: 100% of automatic financial additions in acceptance testing expose their source
  and an immediate undo or correction path.
- **SC-003**: 100% of ambiguous, conflicting, duplicate, and low-confidence test cases enter a
  review or rejection state without an unconfirmed financial change.
- **SC-004**: All essential capture outcomes remain completable after every optional permission
  is declined.
- **SC-005**: Every Core V1 acceptance journey passes in Arabic RTL and English LTR without
  hidden amounts, statuses, or actions.
- **SC-006**: Every Core V1 asynchronous journey demonstrates loading, empty, error, and offline
  behavior, plus permission and synchronization behavior where relevant.
- **SC-007**: All critical journeys remain completable with large text and a screen reader, and
  every financial or operational state is understandable without color alone.
- **SC-008**: Acceptance review finds zero camera or receipt-scanning entry points, zero
  investment entries in Core V1 navigation, and zero Android SMS claims in iOS flows.
- **SC-009**: At least 90% of usability participants can identify the primary purpose or action
  of each tested screen within 5 seconds.
- **SC-010**: 100% of offline manual-entry acceptance cases preserve the entry locally and show
  pending synchronization until a confirmed result is available.
- **SC-011**: Acceptance review finds zero sensitive amounts exposed in lock-screen
  notifications or app-switcher previews.

## Assumptions

- This specification establishes cross-product rules and scope; later specifications define
  detailed screens and feature-specific behavior without weakening these rules.
- Core V1 supports one individual personal-finance user per session; household collaboration,
  family roles, and business finance are future scope.
- The current phase demonstrates frontend behavior with representative mock data and simulated
  service outcomes rather than production integrations.
- Arabic and English are equally required product languages; Arabic remains the RTL reference
  and English remains the LTR reference.
- Portrait phones are the primary context; tablets adapt the mobile experience without
  becoming desktop dashboard replicas.
- User consent is required before any optional permission or personalized assistant access.
- Advanced multi-currency portfolio management is Post-MVP; Core V1 uses one base reporting
  currency while preserving original transaction amounts.
- The frontend-only phase can guarantee immediate removal only for device-local data; account
  deletion and export are simulated request experiences until production services exist.
- The approved master specification and mobile constitution resolve unspecified defaults.
