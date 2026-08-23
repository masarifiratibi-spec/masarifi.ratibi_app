# Feature Specification: R01 — Design System, App Shell, and Shared Components

**Feature Branch**: Not created; no `before_specify` branch hook is configured

**Created**: 2026-08-15

**Status**: Draft for product review

**Input**: Establish the shared visual, interaction, state, localization, accessibility, privacy, and app-shell contract for the Masarifi mobile redesign while preserving the implemented product structure and behavior.

**Primary source of truth**: [`new_Desinge/REDESIGN_ANALYSIS.md`](../../new_Desinge/REDESIGN_ANALYSIS.md)

**Parent roadmap**: [`R01 in the mobile redesign roadmap`](../011-mobile-redesign-roadmap/spec.md#r01--design-system-app-shell-and-shared-components)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize One Premium Masarifi Interface (Priority: P1)

As a Masarifi user, I see one calm, trustworthy financial interface across shared surfaces, so I can understand hierarchy, amounts, status, and actions without relearning presentation patterns on each screen.

**Why this priority**: Every later redesign area depends on a stable visual language. Local styling would recreate inconsistency and increase implementation risk.

**Independent Test**: Review the design-system gallery in Arabic and English, light and dark themes, and confirm that every shared component uses the approved Gulf Premium roles for color, type, spacing, shape, elevation, state, and interaction without relying on feature-specific data.

**Acceptance Scenarios**:

1. **Given** a summary, attention item, progress item, repeated row, and insight, **When** they appear together, **Then** their visual roles are distinct without turning every item into an elevated card.
2. **Given** a primary action, secondary action, selection, warning, destructive action, and premium indication, **When** they are compared, **Then** each has a consistent hierarchy and meaning that does not depend on color alone.
3. **Given** a large amount, supporting amount, title, body, label, and caption, **When** the content is rendered with long Arabic or English text, **Then** the intended hierarchy remains clear without shrinking required content below its semantic type role.
4. **Given** an existing shared component that already satisfies the approved contract, **When** R01 is implemented, **Then** it is reused or evolved rather than replaced by a competing pattern.

---

### User Story 2 - Navigate Through a Stable Five-Tab Shell (Priority: P1)

As a returning user, I can enter Masarifi and move among Home, Transactions, Add, Reports, and More through a stable, accessible shell while all existing startup, session, onboarding, privacy, and protected-route decisions continue to work.

**Why this priority**: The shell is the highest-frequency shared interaction and the route gates protect existing user state and privacy.

**Independent Test**: Exercise cold start, hydrated start, authenticated and unauthenticated protected entry, privacy-locked entry, onboarding entry, tab switching, safe-area layouts, and back/return behavior without changing any resolved destination or tab meaning.

**Acceptance Scenarios**:

1. **Given** any existing startup state, **When** the application opens, **Then** the same current destination is resolved and the loading state never exposes protected content.
2. **Given** the primary tab bar, **When** it is shown in Arabic RTL or English LTR, **Then** all five destinations retain their current meaning and logical order, have persistent labels, and expose a selected state through more than color.
3. **Given** the Add destination, **When** it is shown in the tab bar, **Then** it has stronger emphasis while remaining part of the stable bar rather than becoming a detached floating control.
4. **Given** an unauthenticated attempt to open a protected route, **When** the shared auth-required presentation appears, **Then** sign-in, cancellation, and safe pending-destination recovery remain unchanged.
5. **Given** a planning conflict opened by a feature, **When** its shared container appears, **Then** the owning feature retains all conflict meaning and commands while R01 supplies only the common presentation behavior.

---

### User Story 3 - Complete Common Controls Predictably (Priority: P1)

As a user entering or choosing financial information, I can use buttons, fields, segmented controls, grouped rows, pickers, sheets, and dialogs with the same interaction and recovery behavior throughout the app.

**Why this priority**: Forms and overlays carry consequential financial actions. Predictable behavior reduces errors without changing the underlying commands.

**Independent Test**: Use the component gallery to complete representative field, selection, picker, confirmation, and dismissal flows with keyboard, touch, and screen reader, then confirm that validation content, focus, draft preservation, and action availability follow one shared contract.

**Acceptance Scenarios**:

1. **Given** a field in default, focused, filled, invalid, disabled, and read-only states, **When** its state changes, **Then** the persistent label, value, help or error, and accessibility announcement remain unambiguous.
2. **Given** a small mutually exclusive choice, **When** a segmented control is appropriate, **Then** every option remains visible and selectable; larger or searchable choice sets use the shared picker pattern.
3. **Given** a sheet or dialog opened over an unfinished form, **When** the user selects, cancels, dismisses, or returns from the keyboard, **Then** focus returns safely and the originating draft is not lost.
4. **Given** a destructive or consequential action, **When** confirmation is required by the existing flow, **Then** the presentation names the affected object, consequence, and available recovery without invoking or redefining the feature command.
5. **Given** a control is loading or disabled, **When** it is activated repeatedly, **Then** duplicate submission is prevented and the state is communicated without moving the layout unexpectedly.

---

### User Story 4 - Understand Real Data and Recovery States (Priority: P1)

As a user, I can tell whether information is loading, empty, partial, stale, offline, pending synchronization, under review, conflicted, hidden, successful, or failed, and I know what I can do next.

**Why this priority**: Financial trust depends on distinguishing known results from unknown, provisional, or recoverable states.

**Independent Test**: Render every shared state and source pattern in isolation and in representative summary, row, and overlay contexts, and verify that status, consequence, source, and valid recovery are stated in text and exposed to assistive technology.

**Acceptance Scenarios**:

1. **Given** data has not loaded, **When** a summary or row is shown, **Then** a skeleton or loading treatment preserves expected geometry and never presents unknown money as zero.
2. **Given** the device is offline or data is stale, partial, or pending sync, **When** content remains available, **Then** the content stays usable where current behavior permits and its freshness is visibly distinct from confirmed success.
3. **Given** a recoverable error or permission state, **When** it appears, **Then** the message states what happened, what did or did not change, and the existing valid recovery or fallback.
4. **Given** a financial record or proposal has a source, **When** its source is relevant to trust or review, **Then** the shared source mark conveys a concise label and accessible explanation without exposing protected source content.
5. **Given** values are hidden, **When** the layout changes between visible and hidden states, **Then** protected values are masked consistently without revealing them through accessibility output, layout instability, or app-switcher presentation.

---

### User Story 5 - Use the Same Product in Arabic, English, and Accessible Modes (Priority: P1)

As an Arabic or English user, including a user of assistive technology, I receive equivalent content, actions, privacy, and state meaning in RTL and LTR across themes, text sizes, input methods, and motion preferences.

**Why this priority**: Language parity and accessibility are constitutional product requirements, not final-stage polish.

**Independent Test**: Run the shared gallery and shell on the smallest supported phone and a large phone in Arabic RTL and English LTR, light/dark/system themes, 200% text, screen reader, reduced motion, keyboard open, visible and hidden values.

**Acceptance Scenarios**:

1. **Given** Arabic RTL, **When** a shared layout renders, **Then** start/end alignment, focus order, directional icons, and navigation controls follow task logic while chronology and numeric content are not incorrectly reversed.
2. **Given** a mixed Arabic/English merchant, account, amount, date, phone, code, or reference, **When** it is displayed, **Then** each value remains readable as one intentionally isolated run using English numerals.
3. **Given** 200% text on the smallest supported phone, **When** a shared component renders, **Then** required content and actions reflow without clipping, overlap, inaccessible horizontal scrolling, or touch targets below 44 by 44 points.
4. **Given** a screen reader, **When** the user traverses the shell, controls, status, values, and overlays, **Then** reading and focus order match the visual task sequence and no meaning relies on color, motion, icon, sound, or haptics alone.
5. **Given** reduced motion, **When** state, tab, sheet, dialog, skeleton, progress, or feedback presentation changes, **Then** equivalent information appears without nonessential spatial motion or delayed access.

---

### User Story 6 - Validate Shared Contracts Before Feature Adoption (Priority: P2)

As a design, product, accessibility, localization, QA, or engineering reviewer, I can inspect one representative gallery and contract, so later redesign areas can adopt approved shared patterns without inventing local variants.

**Why this priority**: A reviewable foundation prevents downstream rework while keeping this area independent of feature implementation.

**Independent Test**: Open the existing design-system route and verify that every R01-owned component family, semantic role, interaction state, direction, theme, accessibility behavior, and representative stress case can be inspected without navigating through unfinished feature redesigns.

**Acceptance Scenarios**:

1. **Given** a reviewer opens the design-system gallery, **When** they inspect a component family, **Then** its intended use, prohibited misuse, variants, states, and representative Arabic/English content are demonstrable.
2. **Given** a later feature requires a shared pattern, **When** its specification is reviewed, **Then** the team can identify an existing R01 contract or request one bounded R01 extension rather than creating a local token or duplicate component.
3. **Given** R01 changes a shared contract after a feature has adopted it, **When** the change is reviewed, **Then** affected consumers are identifiable for targeted regression validation.

### Edge Cases

- Startup state is only partially hydrated. The entry route remains on a non-revealing loading surface until the existing resolver chooses a destination.
- A user switches language, theme, value visibility, or reduced-motion preference while the shell is active. Shared presentation updates without changing route, draft, selection, or business state.
- The system returns an unknown or newly introduced status. The interface uses a safe neutral treatment and truthful text rather than guessing success or financial meaning.
- A value is absent, unknown, zero, negative, unusually large, or carries a long currency label. These meanings remain distinct and amounts align without truncating essential digits.
- Arabic copy expands, English text is unusually long, or user-generated content mixes scripts. Components wrap or reflow rather than reduce legibility or overlap actions.
- A tab label or control is focused by assistive technology while its visual state changes. Focus remains stable unless navigation or dismissal intentionally moves it.
- A sheet is opened with the keyboard visible, the app backgrounds, orientation or safe-area dimensions change, or the user dismisses by a supported path. Content remains reachable and an unfinished draft is preserved.
- A confirmation action is submitted once and the result is slow, offline, or fails. The shared presentation distinguishes waiting, locally accepted, pending sync, failure, and confirmed completion according to the feature-owned result.
- A chart has no data, one datum, dense data, identical values, hidden values, or values distinguishable only by color. It retains a textual summary and a safe non-chart fallback.
- A repeated list becomes dense. It uses rows and grouped structure rather than nested cards, while tap targets, separators, status, and amount alignment remain accessible.
- Hidden financial values are masked, but surrounding labels, status, and available actions remain understandable without implying a false zero balance.
- The auth-required or planning-conflict container is invoked from a deep link. Cancellation and successful completion return only to destinations already allowed by the existing flow.

## Ownership and Boundaries

### Existing Routes and Screens Owned by R01

| Existing route | R01 responsibility | Behavior preserved unchanged |
|---|---|---|
| `app/_layout.tsx` | Root visual shell, safe-area/system-surface continuity, shared overlay presentation | Provider order, font gate, privacy gate, notification response handling, root navigation behavior |
| `app/index.tsx` | Startup loading presentation | Hydration checks, destination resolution, redirect behavior, protected-content gating |
| `app/(tabs)/_layout.tsx` | Five-tab shell presentation and accessibility | Protected-route gate, tab destinations, tab meaning, route names, navigation events |
| `app/design-system/index.tsx` | Reviewable catalog entry for approved shared contracts | Existing diagnostic purpose; it does not become a primary product destination |
| `app/modals/auth-required.tsx` | Shared protected-route notice and action presentation | Pending destination sanitization, sign-in behavior, cancellation/back behavior |
| `app/modal/planning-conflict.tsx` | Shared container only | Conflict data, comparison, financial meaning, and resolution commands remain feature-owned |

### Shared Presentation Families Owned by R01

- Semantic color, surface, content, border, status, financial, and interaction roles based on the current Masarifi palette.
- Typography roles for captions, support text, body, labels, subtitles, titles, summaries, and aligned financial amounts.
- Spacing, touch target, radius, border, elevation, safe-area, and responsive layout roles.
- Five-tab bar, shared app/header controls, grouped navigation rows, repeated financial rows, and section structure.
- Buttons, icon buttons, fields, picker rows, segmented and selection controls, chips, badges, and notification counts.
- Sheets, dialogs, picker overlays, skeletons, state views, banners, and transient feedback.
- Sensitive-value presentation, amount and financial-meaning presentation, source marks, Financial Pulse, Attention items/rail, progress surfaces, and restrained insight surfaces.
- Accessible chart framing and shared chart presentation behavior; feature areas retain chart questions, data, filters, calculations, and drill-down destinations.
- Shared motion and focus behavior, including reduced-motion alternatives.

### Explicit Non-Goals

- No production implementation is authorized by this specification phase.
- No route, tab meaning, navigation destination, permission, provider, business rule, calculation, command, persistence model, or product capability changes.
- No redesign of feature-owned screen content from R02 through R20.
- No new camera/receipt capture, investment, payment, authentication, AI, email, SMS, or analytics capability.
- No replacement navigation architecture, new design-system dependency, separate token framework, or speculative abstraction is required.
- No feature-specific financial calculation in shared components. Shared presentation renders values, meaning, state, and commands supplied by the owning feature.

## Shared Presentation Contract

### Visual Direction

- The target character is **Gulf Premium, Quiet Intelligence**: calm financial confidence, dense but readable information, restrained ornament, and clear evidence before decoration.
- The current deep teal remains the primary brand and action family. Warm neutrals remain the default background and grouped surfaces. Bronze is a restrained premium/accent signal, not a broad background, default border, or general status color.
- Semantic roles are used instead of consumer-owned raw color values. Status and financial meaning preserve their approved distinctions in light and dark themes.
- Borders, grouping, spacing, and tonal contrast establish hierarchy before elevation. Elevation is reserved for true overlays or temporarily lifted interaction surfaces.
- Repeated content uses rows and grouped lists. Cards are reserved for summaries, attention, progress, insight, or bounded objects that benefit from an enclosing surface.

### Type, Amount, and Layout Hierarchy

- Shared roles cover approximately: caption 12/16, supporting text and labels 14/20, body 16/24, subtitle 18/26, title 24/32, major financial summary 32/40, and transaction/row amount 17/24. Exact platform font rendering may tune metrics without changing the hierarchy.
- Financial amounts use tabular numerals, a stable sign/currency/value relationship, locale-aware formatting, and semantic meaning supplied by the feature. Missing, hidden, estimated, pending, and confirmed amounts remain visually and accessibly distinct.
- The core spacing rhythm remains compatible with the existing 4, 8, 12, 16, 24, and 32 scale. Screens normally use 16 or 24 outer spacing, sections use approximately 24 separation, and rows use 12 to 16 internal spacing.
- Controls use approximately 8 radius, cards and status surfaces 12, prominent summary or sheet surfaces 16, and full pills only for chips, compact status, and intentionally pill-shaped controls.
- Every actionable target is at least 44 by 44 points; 48 is preferred for primary controls.

### Shared Financial and Decision Surfaces

- **Financial summary** presents the most important confirmed value, scope, supporting context, and visibility control without performing the calculation.
- **Financial Pulse** presents a short, evidence-linked statement about current financial position; it is not a new score, prediction, or business rule.
- **Attention item/rail** presents bounded issues or required review, reason, consequence, source where relevant, and a direct route to the owning screen. It is not a second notification center.
- **Progress surface** presents target, current value, remaining or over-target meaning, status text, and non-color progress. Threshold meaning comes from the feature.
- **Insight surface** explains a relevant observation with supporting scope and a path to evidence; it does not imply advice or automation beyond existing capabilities.
- **Source mark** communicates whether information is manual, automatic, imported, assistant-proposed, or otherwise supplied by current feature data, with protected details revealed only where existing privacy rules allow.

### State and Recovery Vocabulary

| State family | Required shared presentation behavior |
|---|---|
| Initial/loading | Preserve expected geometry, announce progress appropriately, and never substitute unknown financial values with zero |
| Empty/no result | Explain whether the user has no data or a search/filter has no match; provide the current valid first or recovery action |
| Error | State what happened, what did or did not change, and a valid retry, edit, back, settings, or fallback action |
| Offline/partial/stale | Keep available content usable where current behavior allows; label freshness and distinguish cached/local data from confirmed current data |
| Pending sync/local success | Distinguish accepted locally from synchronized completion; preserve existing retry and conflict behavior |
| Permission | Explain purpose, current state, consequence of denial, settings route where supported, and manual/voice fallback where current product behavior provides it |
| Review/conflict | State that review is required, show source and differences supplied by the feature, and avoid implying that a financial record changed before confirmation |
| Disabled/read-only/limit | Explain why the action is unavailable and what existing path, if any, can change the state |
| Success | Confirm the exact completed outcome without overstating provider or synchronization results; expose existing undo or correction when applicable |
| Hidden | Mask protected values consistently in visuals and accessibility while keeping surrounding context and non-sensitive actions usable |

### Direction, Accessibility, Motion, and Privacy

- Arabic and English contain equivalent labels, descriptions, validation, states, consequences, recovery actions, and accessibility names. No shared component owns hard-coded user-visible copy.
- Layout uses logical start/end behavior. Directional navigation icons mirror when meaning depends on direction; universal symbols and chronology do not mirror merely because the locale changes.
- Amounts, currency, dates, phone numbers, OTP codes, masked accounts, sender identifiers, and references use English numerals and intentional bidirectional isolation.
- Screen-reader order follows the task sequence. State changes are announced without duplicate or excessive speech. Hidden values and protected source content are not exposed through accessible names, hints, values, errors, analytics, screenshots, or app-switcher previews.
- Standard feedback and transitions are brief and purposeful, normally completing within 100–240 milliseconds. Reduced motion removes nonessential spatial movement, bounce, and animation delay while preserving immediate state meaning.
- Charts include a textual summary, scope, non-color distinctions, accessible data meaning, empty/error presentation, and a route to supporting records when the owning feature provides one.

## Connections to Other Redesign Areas

| Consumers | R01 contract consumed |
|---|---|
| R02 Accounts, R03 Categories, R04 Transactions | Grouped rows, amount/source/status, forms, pickers, confirmation, hidden values |
| R05 Add, R06 Automatic Tracking | Focused forms, segmented controls, permission/review states, source marks, overlays, feedback |
| R07 Home | Financial summary, Financial Pulse, Attention Rail, progress, recent rows, tab shell |
| R08 Salary, R09 Budgets, R10 Obligations, R11 Savings | Financial summaries, progress, status, forms, consequence and recovery presentation |
| R12 Reports | Chart frame, metric/insight surfaces, filters, amount/date formatting, accessible drill-down |
| R13 Assistant, R14 Notifications | Evidence/source presentation, attention/notification state, suggested actions, deep-link rows |
| R15 More, R16 Profile/Settings, R17 Security/Privacy | Grouped navigation, settings rows, sensitive values, dialogs, permission and secure states |
| R18 Subscription/Support | Premium restraint, plan/status surfaces, forms, external-outcome feedback |
| R19 Authentication, R20 Onboarding | Focused forms, education/progress, state feedback, accessibility, motion, shell gates |
| R21 Final validation | Shared contract remains the owner of cross-app component corrections and regression scope |

## Requirements *(mandatory)*

### Functional Requirements

#### Scope and Compatibility

- **FR-001**: R01 MUST own presentation for exactly the six existing route surfaces listed in the Ownership and Boundaries section; it MUST NOT absorb feature screens owned by R02–R20.
- **FR-002**: The redesign MUST preserve the existing root provider, font, session, onboarding, pending-destination, notification-response, preference-hydration, privacy-gate, and route-resolution behavior.
- **FR-003**: The primary shell MUST retain exactly the existing five destinations and meanings: Home, Transactions, Add, Reports, and More.
- **FR-004**: Existing route names, protected-route decisions, deep-link destinations, back behavior, and feature commands MUST remain unchanged.
- **FR-005**: The auth-required presentation MUST preserve sanitized pending-destination handling, sign-in entry, and safe cancellation.
- **FR-006**: The planning-conflict route MUST use the shared overlay/container contract while all comparison content, financial consequences, resolution options, and commands remain owned by the planning feature.
- **FR-007**: R01 MUST evolve or consolidate appropriate existing shared concepts before introducing a new component; implementation planning MUST identify existing consumers before any shared contract is replaced.
- **FR-008**: R01 MUST NOT add a dependency, product capability, data source, calculation, persistence model, permission, or provider solely to deliver the visual redesign.

#### Semantic Design Language

- **FR-009**: The foundation MUST define semantic roles for page, grouped, card, inset, brand-strong, brand-subtle, attention, and overlay surfaces in light and dark themes.
- **FR-010**: The foundation MUST define semantic roles for primary, secondary, muted, inverted, link, disabled, status, and sensitive content and for default, strong, subtle, focused, selected, error, and disabled borders.
- **FR-011**: The current teal, warm-neutral, bronze, status, and financial palettes MUST remain the base; bronze MUST remain a restrained accent and MUST NOT replace functional status colors.
- **FR-012**: Every shared consumer MUST use approved semantic roles rather than owning raw brand colors or a local token system.
- **FR-013**: Shared typography MUST provide the hierarchy defined in the Shared Presentation Contract, including tabular financial-summary and row-amount roles.
- **FR-014**: Shared spacing, minimum target, radius, border, elevation, safe-area, and responsive roles MUST follow the Shared Presentation Contract and work on the smallest supported phone through large phones.
- **FR-015**: Repeated records and navigation choices MUST default to rows or grouped lists; cards MUST be limited to content requiring summary, attention, progress, insight, or bounded-object emphasis.
- **FR-016**: Elevation MUST be reserved for overlays and interaction states that require separation; ordinary hierarchy MUST use grouping, spacing, border, or tonal contrast first.
- **FR-017**: Installed icon assets MUST be reused, icons MUST have consistent sizing and containers, and direction-dependent icons MUST follow the approved mirroring rules.

#### Shell and Navigation

- **FR-018**: The tab bar MUST display all five persistent text labels and icons, communicate selection without color alone, preserve a stronger but integrated Add treatment, and honor bottom safe areas.
- **FR-019**: Each tab target MUST be at least 44 by 44 points and expose the correct accessibility role, label, selected state, and logical focus order.
- **FR-020**: Shared headers MUST provide consistent title, back, close, overflow, and context-action positions while rendering only the actions supplied by the owning screen.
- **FR-021**: Shared navigation rows MUST provide a label, optional description/value/status, leading or trailing visual, direction-aware disclosure, pressed/focused/disabled behavior, and 200% text reflow.
- **FR-022**: Navigation styling changes MUST NOT reset scroll, draft, selection, filter, or pending-destination context beyond current route behavior.

#### Controls, Forms, and Overlays

- **FR-023**: Buttons MUST provide primary, secondary, quiet/tertiary, destructive, and restrained premium presentation with default, pressed, focused, disabled, and loading states.
- **FR-024**: A screen or overlay MUST present at most one visually dominant primary action in the current viewport unless the approved feature specification documents a necessary exception.
- **FR-025**: Shared fields MUST retain persistent labels and expose default, focused, filled, invalid, disabled, read-only, and loading behavior without using placeholder text as the only label.
- **FR-026**: Validation MUST identify the affected field, explain the corrective action in both languages, preserve meaningful input, and move or announce focus according to the existing submit flow.
- **FR-027**: Segmented controls MUST be limited to small visible mutually exclusive choices; large, searchable, hierarchical, or frequently changing sets MUST use the picker or selection-list contract.
- **FR-028**: Picker rows and selection controls MUST communicate current value, required/optional state, availability, selection, and direction-aware disclosure without relying on icons or color alone.
- **FR-029**: Sheets, dialogs, and picker overlays MUST keep content reachable above safe areas and the keyboard, trap or contain focus while open, provide a clear dismissal path, and return focus to the invoker.
- **FR-030**: Dismissing a shared overlay MUST preserve the originating feature draft and MUST NOT invoke a feature command unless the user confirmed the action.
- **FR-031**: Consequential confirmation MUST name the affected object and consequence, prevent duplicate submission, and represent waiting, failure, and the feature-supplied completion result truthfully.

#### Financial, State, and Feedback Components

- **FR-032**: Shared amount presentation MUST use feature-supplied value and financial meaning and MUST NOT infer ledger sign, transfer, refund, savings, debt, or cash-flow effect from a display variant.
- **FR-033**: Amounts MUST distinguish absent, unknown, zero, hidden, estimated, pending, and confirmed values and MUST remain readable for negative, unusually large, and long-currency cases.
- **FR-034**: Financial summary, Financial Pulse, Attention, progress, insight, and source components MUST follow the contracts in this specification and MUST link or delegate to an owning feature rather than duplicate its rules.
- **FR-035**: Source presentation MUST support the existing manual, automatic, imported, assistant-proposed, and other feature-supplied origins without exposing protected raw source content.
- **FR-036**: Shared state feedback MUST support loading, empty, no-result, error, offline, partial, stale, pending-sync, local success, permission, review, conflict, disabled, read-only, limit, success, and hidden-value presentation as applicable.
- **FR-037**: Loading and skeleton states MUST preserve approximate content geometry, announce progress appropriately, and MUST NOT display unknown financial values as confirmed zero values.
- **FR-038**: Error and recovery presentation MUST state what happened, what did or did not change, and only recovery actions currently supported by the owning feature.
- **FR-039**: Offline, partial, stale, local-success, and pending-sync states MUST remain distinguishable from confirmed current data and synchronized success.
- **FR-040**: Status, warning, selection, progress, review, source, and financial meaning MUST use text or structure in addition to color, icon, motion, sound, or haptic treatment.
- **FR-041**: Transient feedback MUST not be the only record of a consequential outcome; persistent destination or state presentation MUST remain available according to current feature behavior.

#### Charts, Localization, Accessibility, Privacy, and Motion

- **FR-042**: Shared chart framing MUST include title, scope, textual summary, non-color distinctions, accessible data meaning, loading/empty/error/hidden handling, and a feature-supplied path to supporting records where available.
- **FR-043**: Charts MUST remain interpretable for one value, dense values, equal values, hidden values, and small screens; decorative complexity MUST be removed when it does not improve the financial question.
- **FR-044**: Every shared user-visible string, accessibility label, hint, error, state, and action MUST be localizable and have complete Arabic and English coverage; hard-coded user-visible copy is prohibited.
- **FR-045**: Shared layouts MUST use logical start/end alignment and direction-aware focus order, while chronology and universal symbols MUST remain semantically ordered.
- **FR-046**: Amounts, currency, dates, phone numbers, OTP codes, masked accounts, sender identifiers, and references MUST use English numerals and intentional bidirectional isolation in both locales.
- **FR-047**: Every shared control MUST remain operable at 200% text, with screen readers, keyboard where applicable, reduced motion, and a minimum 44-by-44-point target.
- **FR-048**: Required content and primary actions MUST reflow on the smallest supported phone without clipping, overlap, inaccessible horizontal scrolling, or reliance on device-specific screenshots.
- **FR-049**: Sensitive-value presentation MUST mask protected values consistently in visible content, accessibility output, errors, analytics, screenshots, and app-switcher previews according to existing privacy rules.
- **FR-050**: Hidden-value layouts MUST preserve non-sensitive context, status, and available actions and MUST NOT reveal magnitude through replacement length, animation, or accessible metadata.
- **FR-051**: Standard transitions MUST be purposeful and normally complete within 100–240 milliseconds; reduced-motion mode MUST remove nonessential spatial movement, bounce, and delay without suppressing state meaning.
- **FR-052**: Theme, locale, privacy-visibility, and motion-preference changes MUST update shared presentation without changing current route, draft, selection, command, or financial state.

#### Catalog, Adoption, and Validation

- **FR-053**: The existing design-system route MUST demonstrate every shared family owned by R01 in representative light/dark, Arabic/English, default/interaction/state, long-content, dense, hidden, and reduced-motion scenarios as applicable.
- **FR-054**: The gallery MUST identify intended use and misuse boundaries sufficiently for a later feature area to select a shared pattern without creating a local variant.
- **FR-055**: Each shared contract MUST have identifiable consumers so a later R01 change can trigger targeted regression validation rather than an unbounded whole-app rewrite.
- **FR-056**: R02–R20 MAY request a bounded shared variant when their approved specification demonstrates a real reusable need; they MUST NOT introduce raw local tokens or duplicate shared interaction contracts.
- **FR-057**: R01 validation MUST cover the six owned route surfaces plus the shared gallery before any downstream area treats the contract as implementation-ready.
- **FR-058**: R01 completion MUST demonstrate that all preserved startup, tab, protected-entry, and shared-container behaviors produce the same destinations and feature commands as the current implementation.

### Constitution Requirements *(mandatory)*

- **Financial trust and control**: Shared components render feature-owned financial meaning and commands; automatic or assistant-proposed changes retain source, explicit confirmation where required, consequence, correction/undo, and protected evidence.
- **Platform honesty**: R01 introduces no new platform claims. Permission and fallback components can represent the current Android education/consent/recovery path and honest iOS manual, voice, and supported automation alternatives.
- **Localization and accessibility**: Arabic RTL and English LTR have complete parity, English numerals, intentional mixed-direction formatting, 200% text, screen readers, minimum targets, logical focus, non-color meaning, and reduced-motion alternatives.
- **Semantic design system**: Gulf Premium v2.2 evolves the current palette and shared primitives through semantic roles. Feature areas cannot own local token systems or redefine shared controls.
- **Replaceable presentation**: R01 contains no business calculation or provider behavior. It accepts feature-supplied values, statuses, labels, and commands and remains compatible with the existing React Native and route architecture.
- **Verification**: Shared behavior, state, language, accessibility, privacy, and device presentation require focused validation before downstream adoption.

### Key Entities

- **Semantic Design Role**: A named visual purpose for surface, content, border, status, financial meaning, spacing, typography, shape, or elevation that resolves appropriately by theme and state.
- **Shared Component Contract**: A reusable presentation and interaction pattern with defined purpose, variants, states, accessibility behavior, direction behavior, and misuse boundary; it does not own feature data or rules.
- **Shell Destination**: One of the five existing primary destinations with stable route meaning, label, icon, selection, focus, and safe-area behavior.
- **Presentation State**: A truthful visual and accessible representation of loading, empty, error, offline, partial, stale, sync, permission, review, conflict, disabled, read-only, success, hidden, or other feature-supplied status.
- **Sensitive Display State**: The visible or hidden representation of protected content that preserves useful non-sensitive context without disclosure through any output channel.
- **Direction Contract**: The logical start/end, focus, icon-mirroring, numeric-isolation, and mixed-script rules applied to Arabic RTL and English LTR.
- **Consumer Relationship**: The link between an R01 shared contract and downstream redesign areas that use it and require regression validation when it changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All six R01-owned route surfaces preserve their current destination, gate, return, and command behavior in representative startup, protected-entry, tab, and conflict scenarios.
- **SC-002**: All five primary tabs are visible with persistent labels, meet the 44-by-44-point minimum target, and communicate selection without relying on color in Arabic and English.
- **SC-003**: 100% of R01-owned shared component families are reviewable in the design-system gallery with their applicable variants, interaction states, recovery states, and intended-use boundary.
- **SC-004**: Review finds zero shared user-visible strings or accessibility text that exist in only one supported language or are hard-coded outside localization.
- **SC-005**: On the smallest supported phone at 200% text, every catalog scenario and R01-owned route retains all required content and primary actions with zero clipping, overlap, inaccessible horizontal scrolling, or targets below 44 by 44 points.
- **SC-006**: Screen-reader review of every shared family and owned route finds a logical task order, complete names/roles/states, stable overlay focus, and zero status meanings conveyed only by color, icon, motion, sound, or haptics.
- **SC-007**: Light and dark theme review finds all required text, controls, focus indicators, statuses, and chart distinctions meeting the project accessibility contrast standard with zero protected-value leaks.
- **SC-008**: Arabic RTL and English LTR comparison shows equivalent information and actions in 100% of shared states, with correct logical alignment, direction-aware icons, English numerals, and readable mixed-direction values.
- **SC-009**: Loading, empty, error, offline, partial, stale, pending-sync, permission, review, conflict, disabled, read-only, success, and hidden-value examples are visibly and accessibly distinguishable wherever applicable; no unknown amount is represented as zero.
- **SC-010**: Standard shared transitions complete within the approved 100–240 millisecond range, and reduced-motion validation finds zero nonessential spatial motion or animation-delayed access to information.
- **SC-011**: Privacy validation finds zero protected financial values or raw source content in hidden visual output, accessibility output, errors, screenshots, analytics evidence, or app-switcher previews.
- **SC-012**: A downstream area reviewer can identify the correct R01 component, state, direction, and accessibility contract for a representative screen in under five minutes without creating a local token or competing shared pattern.
- **SC-013**: Review of representative shared financial surfaces finds zero calculations, inferred ledger meanings, or feature commands implemented by presentation contracts.
- **SC-014**: R01 device validation passes on at least one supported Android device and one supported iOS device or approved iOS device environment, covering Arabic/English, light/dark, visible/hidden values, keyboard, screen reader, and reduced motion.

## Assumptions

- The approved `new_Desinge/REDESIGN_ANALYSIS.md` remains the visual and UX source of truth.
- The current route tree, shell gates, feature commands, localization preferences, theme preferences, privacy behavior, and installed design-system primitives are the functional foundation.
- The existing Masarifi color families and IBM Plex Sans Arabic typography remain available; this specification changes semantic usage and hierarchy, not brand identity or font-provider behavior.
- Current financial formatters and feature projections remain authoritative. R01 may standardize their presentation but may not redefine their calculations or signs.
- Exact implementation consolidation is decided during `/plan` after consumer inspection; this specification requires one observable contract, not a speculative new abstraction.
- The design-system gallery is a diagnostic and review surface, not a new primary destination for end users.
- R01 is a mandatory dependency for R02–R20. Feature redesign implementation begins only after the relevant shared contract is approved or explicitly identified as an owned extension.
- Real-device validation evidence and validation-fix tasks will be defined during `/tasks`; no production implementation occurs in this `/specify` phase.

