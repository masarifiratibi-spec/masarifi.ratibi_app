# Feature Specification: Mobile Design System and Interaction Language

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Create SPEC-002 - Mobile Design System and Interaction Language from the complete Masarifi Mobile Frontend SpecKit Master and Masarifi Gulf Premium Design System Version 2.1."

## Clarifications

### Session 2026-08-06

- Q: How long may an authorized sensitive-value reveal remain active? -> A: Until app lock or background.
- Q: What font scaling level must critical flows support without content loss? -> A: 200% minimum; reflow above.
- Q: Which motion timing standard governs reusable mobile components? -> A: Version 2.1 duration ranges.
- Q: What happens when a feature needs a semantic design value that does not exist? -> A: Add it centrally before feature use.
- Q: What minimum phone viewport defines responsive acceptance? -> A: 320 x 568 logical pixels.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand Financial Information Consistently (Priority: P1)

As a Masarifi user, I see balances, transactions, budgets, obligations, savings, and reports
through one consistent visual language so I can understand financial meaning without relearning
controls or status cues on each screen.

**Why this priority**: Clear, repeatable financial presentation is the foundation for trust in
every later mobile feature.

**Independent Test**: Present representative financial components together in light and dark
modes and verify that users can identify amounts, financial meaning, operational status, and
the primary action without relying on color alone.

**Acceptance Scenarios**:

1. **Given** income, expense, transfer, refund, savings, and debt examples, **When** they are
   displayed, **Then** each meaning uses a consistent label, icon or shape, and financial
   semantic treatment distinct from system success, warning, and error states.
2. **Given** the same component appears on multiple screens, **When** users interact with it,
   **Then** its anatomy, hierarchy, state behavior, and content rules remain consistent.
3. **Given** a page contains values, metadata, and decoration, **When** it is viewed, **Then**
   the main amount, status, source, and next action have greater visual priority than decoration.

---

### User Story 2 - Complete Mobile Actions Comfortably and Safely (Priority: P1)

As a mobile user, I can complete common and high-risk financial actions with one hand, receive
immediate feedback, and recover from mistakes without losing entered information.

**Why this priority**: A premium design language must make frequent actions efficient while
protecting users from duplicate, destructive, or unintended financial changes.

**Independent Test**: Complete representative add, select, save, undo, destructive-confirmation,
keyboard, and bottom-sheet flows on small and large phones using one hand.

**Acceptance Scenarios**:

1. **Given** a user submits a financial action, **When** processing begins, **Then** repeated
   submission is prevented and a visible loading state appears without shifting the layout.
2. **Given** a reversible automatic action succeeds, **When** feedback appears, **Then** the
   result and an immediate undo path are both available.
3. **Given** a user enters invalid data or the keyboard covers part of a form, **When** the
   error is shown, **Then** entered data remains available and the field, correction, and
   primary action remain reachable.
4. **Given** a destructive action, **When** the user attempts it, **Then** it is visually
   separated from the primary action and requires an explicit confirmation describing the result.

---

### User Story 3 - Use the Same Product in Arabic, English, and Assistive Modes (Priority: P1)

As an Arabic or English user, including a user with visual, motor, or motion-access needs, I
receive a complete and balanced experience that preserves financial clarity.

**Why this priority**: Language direction and accessibility cannot reduce a user's ability to
understand or control money.

**Independent Test**: Run the component validation experience in Arabic RTL and English LTR
with a screen reader, large text, reduced motion, and keyboard or switch-style navigation.

**Acceptance Scenarios**:

1. **Given** Arabic is selected, **When** the interface is displayed, **Then** reading order,
   alignment, navigation, and directional icons follow RTL while amounts, currency codes, and
   mixed-direction identifiers remain readable.
2. **Given** English is selected, **When** the same interface is displayed, **Then** all content,
   states, and actions remain equivalent in LTR.
3. **Given** large text is enabled, **When** financial components and forms are used, **Then**
   important content wraps or reflows without hiding amounts, statuses, or actions.
4. **Given** reduced motion or a screen reader is active, **When** state changes occur, **Then**
   the result is understandable without animation, haptics, illustration, or color alone.

---

### User Story 4 - Read Charts and Comparisons Without Guesswork (Priority: P2)

As a user reviewing financial performance, I can understand charts, comparisons, and trends
even when there is dense data or I cannot distinguish every color.

**Why this priority**: Reports and dashboard insights are useful only when their meaning is
clear and available to all users.

**Independent Test**: Display representative category, trend, and comparison charts with empty,
insufficient, normal, and dense data, then verify their question, values, and conclusion can be
understood from visible labels and a text summary.

**Acceptance Scenarios**:

1. **Given** more categories than can be explained clearly, **When** a category chart appears,
   **Then** no more than five categories are shown and the remainder is grouped under Other.
2. **Given** a chart is viewed without color or interactive tooltips, **When** the user reads it,
   **Then** labels, patterns or line styles, and a text summary communicate the same conclusion.
3. **Given** a user selects a chart segment or comparison, **When** a drill-down is available,
   **Then** the destination and filtering effect are clear before navigation.

---

### User Story 5 - Keep Sensitive Financial Information Private (Priority: P2)

As a privacy-conscious user, I can hide sensitive values and understand when revealing them
requires authorization or confirmation.

**Why this priority**: Visual consistency is incomplete if design components expose financial
data in previews, notifications, overlays, or shared-device situations.

**Independent Test**: Enable hidden balances and exercise cards, lists, charts, notifications,
overlays, app-switcher previews, and reveal actions with representative sensitive values.

**Acceptance Scenarios**:

1. **Given** sensitive values are hidden, **When** any supported component is displayed, **Then**
   values are masked consistently without breaking layout or revealing totals through labels.
2. **Given** a sensitive value requires authorization, **When** reveal is requested, **Then** the
   reason and effect are clear and confirmation occurs before exposure.
3. **Given** the app leaves the foreground or displays a lock-screen notification, **When** a
   preview is created, **Then** sensitive financial values remain hidden.

### Edge Cases

- Arabic labels expand beyond the equivalent English length or include mixed-direction values.
- System text size is increased while a card contains a long currency name, amount, and status.
- A small phone, display cutout, gesture area, or open keyboard reduces the usable viewport.
- A component is loading, refreshing, empty, filtered-empty, partially failed, offline, disabled,
  selected, or pending synchronization.
- A user rapidly taps a save, destructive, or undo action more than once.
- A financial meaning and a system status coexist, such as an expense whose synchronization
  succeeded or an income transaction that failed to save.
- Hidden balances are enabled while a chart, notification, assistant insight, or app preview is visible.
- A chart has no data, insufficient data, more than five categories, four trend lines, or long labels.
- Dark mode, reduced motion, grayscale, or color-vision deficiency changes how visual cues are perceived.
- A bottom sheet or dialog contains content longer than the available height.
- A component has no optional icon, trend, progress value, subtitle, or secondary action.
- Content refreshes while the user is focused on or interacting with a control.

## Requirements *(mandatory)*

### Scope Boundaries

This specification defines mobile design foundations, reusable component behavior, interaction
language, accessibility, privacy presentation, and validation expectations. It does not define
the Admin Dashboard layout, marketing surfaces, feature-specific business rules, production
services, or the complete screen flows owned by SPEC-003 through SPEC-010.

### Functional Requirements

- **FR-001**: The mobile product MUST use the Masarifi Gulf Premium identity with deep teal as
  the primary interaction family, clean neutral mobile surfaces, and bronze as a restrained
  premium accent rather than a second primary color.
- **FR-002**: Standard mobile screens MUST avoid heavy gradients, glass effects, visual noise,
  decorative shadows on every card, and decoration that competes with financial information.
- **FR-003**: Every reusable component MUST use semantic design values for color, typography,
  spacing, radius, border, elevation, iconography, and motion; feature experiences MUST NOT
  introduce raw brand values when an approved semantic value exists. A missing semantic value
  MUST be added to the shared design system before feature use; feature-local token substitutes
  are not permitted.
- **FR-004**: The semantic color language MUST distinguish financial meaning from operational
  status, including separate treatments for income, expense, transfer, refund, savings, debt,
  success, warning, danger, information, and neutral states.
- **FR-005**: Color MUST NOT be the only indicator of financial meaning, system status,
  severity, selection, validation, or progress.
- **FR-006**: The mobile design language MUST provide complete light and dark themes in which
  teal remains the primary interaction family, bronze remains restrained, and data surfaces
  remain visually distinguishable.
- **FR-007**: Product typography MUST use the approved Version 2.1 product family for Arabic
  and English, preserve readable Arabic at small sizes, and provide distinct styles for
  headings, labels, body text, helper text, and financial values.
- **FR-008**: Financial values MUST use stable-width English numerals where available,
  locale-aware currency formatting, visible minus signs for negative values, and consistent
  decimal treatment for each currency context.
- **FR-009**: Main balances and report totals MUST have the highest numeric priority, followed
  by supporting amounts, percentages or comparisons, and helper labels.
- **FR-010**: Mobile layouts MUST follow a consistent four-unit spacing rhythm, respect safe
  areas, preserve edge padding, support text wrapping, and keep primary actions reachable.
- **FR-011**: Cards, controls, overlays, and sheets MUST use a moderate, consistent shape
  language; pills MUST be reserved for filters, statuses, keywords, and compact actions.
- **FR-012**: Borders MUST define standard card structure before shadows; elevation MUST be
  used only to communicate raised, floating, overlay, or modal relationships.
- **FR-013**: The reusable navigation set MUST cover app bars, bottom navigation, back and
  overflow actions, context menus, step indicators, segmented controls, and sticky headers.
- **FR-014**: The reusable financial set MUST cover balance, account, transaction, category,
  amount, currency, income/expense, budget, obligation, installment, savings, report, and
  comparison presentations required by the approved mobile scope.
- **FR-015**: The reusable form set MUST cover text, phone, OTP, search, amount, date, time,
  account, category, payment method, switch, checkbox, radio, chip, keyword, validation, and
  helper-text interactions required by the approved mobile scope.
- **FR-016**: The reusable feedback set MUST cover toast, snackbar, undo, success, error, empty,
  skeleton, offline, synchronization, permission, review-required, and notification states.
- **FR-017**: The reusable overlay set MUST cover bottom sheets, full-screen sheets,
  confirmations, destructive confirmations, account and category pickers, filters, date ranges,
  and voice-recording presentation.
- **FR-018**: Every reusable component MUST define its anatomy, supported variants and sizes,
  applicable states, responsive behavior, RTL behavior, accessibility behavior, content rules,
  and semantic design mapping.
- **FR-019**: Every interactive control MUST provide visible default, pressed, focused,
  selected where applicable, disabled, and loading states without using opacity alone to
  communicate disabled behavior.
- **FR-020**: Interactive targets MUST be at least 44 by 44 logical pixels, and primary mobile
  form controls SHOULD provide a 48-pixel interaction height where the content permits.
- **FR-021**: Short, low-risk decisions SHOULD use a bottom sheet, while multi-step or high-risk
  financial workflows MUST use a full screen or explicit confirmation surface.
- **FR-022**: Primary and destructive actions MUST be visually and spatially separated, and
  destructive actions MUST state the consequence before confirmation.
- **FR-023**: Saving or mutating an item MUST show immediate visible feedback, prevent repeated
  submission while pending, preserve entered data after validation failure, and provide an
  undo path for reversible automatic actions.
- **FR-024**: Motion MUST be brief, purposeful, and limited to feedback or spatial continuity;
  it MUST NOT delay access to financial information, cause loading layout shifts, or replay
  unnecessarily after minor changes. Micro-interactions MUST complete in 100-140 milliseconds,
  control transitions in 140-180 milliseconds, dialogs in 180-220 milliseconds, and sheets or
  page transitions in 200-240 milliseconds.
- **FR-025**: Reduced-motion mode MUST remove non-essential animation while preserving every
  state change and task outcome through static visual and textual feedback.
- **FR-026**: Haptics MAY reinforce success, warning, or recording interactions but MUST NOT be
  required to understand or complete an action.
- **FR-027**: Arabic and English MUST have complete content and behavior parity; Arabic MUST use
  RTL reading and interaction order, while English MUST use LTR order.
- **FR-028**: Directional navigation icons MUST mirror when meaning depends on direction;
  non-directional, media, utility, and brand icons MUST retain their meaning across locales.
- **FR-029**: Email addresses, phone numbers, account identifiers, currency codes, transaction
  references, and similar mixed-direction values MUST remain readable and correctly ordered in
  Arabic layouts.
- **FR-030**: Normal text MUST meet at least 4.5:1 contrast, large text MUST meet at least 3:1,
  focus MUST remain visible, and labels MUST remain present independently of placeholders.
- **FR-031**: Screen-reader order and names MUST communicate component purpose, current value,
  state, and available action; status changes and validation errors MUST be announced with a
  clear correction path. Critical content and actions MUST remain fully usable at 200% text
  scaling, while larger supported platform settings MUST reflow or scroll without data loss.
- **FR-032**: Charts MUST answer one stated financial question, provide readable labels and a
  text summary, remain understandable without color or tooltips, and expose a clear drill-down
  path when detailed transactions are available.
- **FR-033**: Donut charts MUST show no more than five visible categories and group the remainder
  under Other; standard line charts MUST show no more than four lines and distinguish series by
  more than color.
- **FR-034**: User-facing labels MUST be calm, specific, and action-oriented; vague labels such
  as "Continue", "Confirm", or "Submit" MUST be replaced when the resulting action can be named.
- **FR-035**: Sensitive balances, salary, debt, transaction details, account identifiers, raw
  capture content, notifications, and assistant content MUST support consistent masking and
  MUST be masked by default on first use, remain hidden in lock-screen and app-switcher
  previews, and return to the masked state whenever the app locks or enters the background.
- **FR-036**: Revealing protected sensitive information MUST explain why access is needed,
  require authorization or confirmation where applicable, and avoid leaking values into titles,
  previews, errors, or analytics.
- **FR-037**: Screens and reusable components MUST support small, standard, and large phones,
  display cutouts, gesture navigation, keyboard-open layouts, portrait orientation, and adaptive
  tablet presentation without becoming desktop dashboard replicas. The minimum validation
  viewport is 320 by 568 logical pixels before safe-area and keyboard reductions.
- **FR-038**: Skeletons MUST preserve final content structure, and applicable experiences MUST
  define loading, refreshing, empty, filtered-empty, error, partial-error, offline, permission,
  disabled, and synchronization states without obscuring the next available action.
- **FR-039**: The design system MUST provide a foundations reference covering mobile light and
  dark palettes, text, borders, financial and status semantics, charts, typography, numeric
  styles, spacing, radius, elevation, icons, motion, RTL, contrast, bronze usage, privacy, and
  correct and incorrect examples.
- **FR-040**: Components and screens introduced under this specification MUST NOT copy Admin
  Dashboard density, sidebar navigation, table-first layouts, or admin-specific surface rules.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android and iOS share the same mobile visual identity and interaction
  quality. Platform conventions may differ, but unsupported capabilities must remain honest and
  every optional permission path retains a usable fallback.
- **Financial trust**: Financial and operational semantics remain distinct; automatic actions
  expose correction; destructive actions require confirmation; sensitive values are masked in
  previews, notifications, and hidden-balance states.
- **Localization and accessibility**: Arabic RTL and English LTR have complete parity; English
  numerals and locale-aware formatting preserve financial clarity; contrast, screen readers,
  large text, reduced motion, focus, and minimum target sizes are mandatory.
- **UI states and tokens**: Reusable components consume semantic design values and define all
  applicable states, responsive behavior, RTL behavior, accessibility behavior, content rules,
  and mobile-specific presentation across light and dark themes.
- **Verification**: Acceptance covers both languages, both themes, small and large phones,
  keyboard-open layouts, large text, screen readers, reduced motion, grayscale, hidden balances,
  charts, async states, and app-switcher privacy.

### Key Entities

- **Design Token**: An approved semantic value representing visual or interaction meaning,
  including category, theme value, state, intended use, and contrast obligations.
- **Theme**: A complete light or dark mapping of semantic design values that preserves brand,
  financial meaning, status meaning, readability, and surface hierarchy.
- **Component Contract**: A reusable mobile pattern with anatomy, variants, sizes, states,
  content rules, responsive behavior, RTL behavior, accessibility behavior, and semantic mapping.
- **Financial Semantic**: A presentation meaning such as income, expense, transfer, refund,
  savings, or debt that remains separate from success, warning, danger, and information states.
- **Interaction State**: A user-visible condition such as default, pressed, focused, selected,
  disabled, loading, success, error, empty, offline, permission-required, or pending sync.
- **Content Pattern**: An approved label, helper, error, comparison, or feedback structure with
  tone, action clarity, localization, and privacy rules.
- **Chart Presentation**: A question-led visual summary with series, labels, text alternative,
  comparison meaning, empty or insufficient-data state, and optional drill-down destination.
- **Sensitive Presentation**: A value or content region with masking state, reveal requirement,
  preview behavior, and accessible description.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of representative users identify the main financial value, its
  meaning, current status, and primary action within 5 seconds on each validation screen.
- **SC-002**: 100% of audited reusable components use approved semantic design values wherever
  an equivalent exists, with zero raw brand colors introduced by feature experiences.
- **SC-003**: 100% of interactive controls demonstrate pressed, focused, disabled, and loading
  states, and all measured touch targets meet or exceed 44 by 44 logical pixels.
- **SC-004**: Every representative component and validation screen passes in Arabic RTL and
  English LTR without clipped or hidden amounts, statuses, labels, or actions.
- **SC-005**: Every critical interaction remains completable on the smallest supported phone
  viewport of 320 by 568 logical pixels, with the keyboard open and at 200% text scaling;
  larger supported settings preserve all content and actions through reflow or scrolling.
- **SC-006**: All normal text and large text samples meet contrast ratios of at least 4.5:1 and
  3:1 respectively in both light and dark themes.
- **SC-007**: 100% of tested financial meanings, statuses, chart series, and validation results
  remain distinguishable in grayscale and without animation or haptic feedback.
- **SC-008**: Every chart validation case includes a visible or screen-reader-accessible text
  summary, no donut exceeds five visible categories, and no standard line chart exceeds four lines.
- **SC-009**: 100% of save and mutation flows prevent duplicate submission, preserve entered
  data after validation errors, and show a result or recovery action within one second of the
  user-visible outcome becoming available.
- **SC-010**: Acceptance testing finds zero sensitive financial values in lock-screen
  notifications, app-switcher previews, hidden-balance components, raw errors, or analytics
  examples, and every authorized reveal is masked again after app lock or background.
- **SC-011**: At least 90% of usability participants complete representative selection, save,
  undo, and destructive-confirmation tasks on the first attempt without assistance.
- **SC-012**: Visual review finds zero mobile screens using Admin Dashboard navigation, density,
  table-first composition, or admin-specific surface treatment.

## Assumptions

- Masarifi Gulf Premium Design System Version 2.1 is the authoritative detailed visual source;
  where the master document leaves the final font open, Version 2.1's approved IBM Plex Sans
  Arabic and IBM Plex Sans product family resolves that choice.
- This specification defines the system and validation contract; later feature specifications
  decide which approved components appear in each user journey.
- Arabic and English are equally complete product languages, with Arabic as the RTL reference
  and English as the LTR reference.
- Portrait phones are the primary mobile context; tablets adapt the mobile hierarchy and do not
  reproduce desktop or Admin Dashboard layouts.
- Platform-native behavior may differ where user expectations require it, while brand,
  accessibility, privacy, and financial meaning remain equivalent.
- Illustrations and low-opacity Gulf patterns are optional and limited to onboarding, empty,
  premium, or selected insight contexts; no user journey depends on them.
- The center quick-add action may use bronze only when its prominence remains accessible and
  bronze stays within the approved restrained accent role.
- Production service behavior and feature-specific financial calculations remain owned by later
  specifications and do not belong to this design-system scope.
