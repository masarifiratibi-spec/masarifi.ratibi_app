# Tasks: R01 — Design System, App Shell, and Shared Components

**Input**: Design documents in `specs/012-shared-ui-foundation/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/shared-presentation-contract.md`, `quickstart.md`

**Organization**: The approved redesign handoff requires screen-first execution. Shared foundation work appears once, followed by each owned screen/container with its own tests and device-validation fixes. User-story labels remain for traceability but do not replace screen grouping.

**Tests**: Test tasks are mandatory because the specification and constitution require proof for shared contracts, route preservation, localization, accessibility, privacy, state transitions, and critical shell journeys. Test tasks precede their implementation task and must demonstrate the missing behavior before implementation.

## Format: `[ID] [P?] [Story?] Description with exact file path`

- **[P]**: May run in parallel after stated prerequisites because it changes different files.
- **[US1]–[US6]**: Maps screen work to the specification's user stories.
- Setup and Shared Foundation tasks intentionally have no story label.

---

## Phase 1: Baseline and Scope Lock

**Purpose**: Capture the current contract and prove the implementation starts without changing routes, providers, business behavior, or unrelated user work.

- [X] T001 Inventory every current importer of the public components and tokens listed in `specs/012-shared-ui-foundation/contracts/shared-presentation-contract.md`, recording exact consumer files and owning R02–R21 areas in that contract before changing any public prop.
- [X] T002 Run the existing focused shell/design-system tests and boundary checks from `specs/012-shared-ui-foundation/quickstart.md`, then record command, date, pass/fail counts, and known pre-existing failures in `specs/012-shared-ui-foundation/validation/baseline.md` without modifying production code.
- [X] T003 Create the screen-first evidence index in `specs/012-shared-ui-foundation/validation/README.md` with sections for Shared Foundation, Root/Entry, Five-Tab Shell, Auth Required, Planning Conflict, Gallery, Android, iOS, and final regression evidence.

**Checkpoint**: Current behavior and consumer blast radius are recorded; implementation scope is limited to R01.

---

## Phase 2: Shared Foundation

**Purpose**: Establish the blocking Gulf Premium v2.2 contracts used by every owned screen. No screen-specific styling starts until this phase passes.

### Semantic Tokens, Type, Direction, and Motion

- [X] T004 [P] Add failing coverage for all required light/dark surface, content, border, interaction, status, financial, radius, and target roles in `src/design-system/tokens.test.ts` and `src/design-system/theme.test.ts`, including contrast and bronze-restraint assertions.
- [X] T005 Implement the approved semantic aliases and metrics while keeping raw palette ownership centralized in `src/design-system/tokens.ts`; preserve temporary compatibility aliases required by consumers recorded in T001.
- [X] T006 Update theme resolution to expose the new semantic groups without changing light/dark/system preference behavior in `src/design-system/theme.ts` and satisfy T004.
- [X] T007 [P] Add failing coverage for caption, support, body, label, subtitle, title, summary-amount, and row-amount roles plus locale font families in `src/design-system/typography.test.ts`.
- [X] T008 Implement the Gulf Premium v2.2 type metrics and tabular amount roles in `src/design-system/tokens.ts` and `src/design-system/typography.ts` without changing `FontGate` behavior.
- [X] T009 Update `src/components/StyledText.tsx` to expose the new semantic variants, semibold/bold locale weights, wrapping, and bidi-safe defaults while preserving derived accessibility labels.
- [X] T010 [P] Add failing coverage for 100–240 ms duration buckets, immediate reduced-motion completion, and semantic directional/non-directional icon behavior in `src/design-system/motion.test.ts` and `src/design-system/icons.test.tsx`.
- [X] T011 Implement the approved motion and direction behavior in `src/design-system/motion.ts` and `src/design-system/icons.tsx`, reusing installed icon assets and introducing no animation dependency.
- [X] T012 [P] Add all new shared component, state, overlay, financial, chart, gallery, and screen labels required by R01 to `src/localization/messages/en.ts`, with no raw fixture copy left in shared components.
- [X] T013 [P] Add complete natural Arabic equivalents for every R01 key added by T012 to `src/localization/messages/ar.ts`, preserving interpolation parameters and English-numeral placeholders.
- [X] T014 Extend the existing TypeScript-AST checks in `scripts/check-design-system-boundaries.mjs` to reject hard-coded user-visible strings passed through shared/gallery props and local semantic token maps, while allowing deliberate mixed-direction test fixtures in test files.

### Core Surfaces and Actions

- [X] T015 [P] Add failing contract coverage for semantic surface variants, distinct action hierarchy, loading/disabled behavior, focus visibility, non-color status cues, and 44×44 targets in `src/design-system/components/primitives.test.tsx`.
- [X] T016 Implement page/grouped/card/inset/brand-strong/brand-subtle/attention/overlay surface variants and border-first hierarchy in `src/design-system/components/SurfaceCard.tsx` without adding feature-specific layout rules.
- [X] T017 Implement distinct primary, secondary, quiet/tertiary, destructive, and restrained-premium states plus stable loading layout in `src/design-system/components/ActionButton.tsx`, using the existing duplicate-submit contract in `src/design-system/usePendingAction.ts`.
- [X] T018 Implement focused/pressed/disabled icon-button behavior and expanded operational status presentation in `src/design-system/components/IconButton.tsx` and `src/design-system/components/StatusBadge.tsx`, keeping financial tones out of operational status.

### Grouped Navigation, Forms, and Selection

- [X] T019 [P] Add failing tests for grouped-list boundaries, navigation-row content slots, RTL disclosure, focus/disabled states, 200% wrapping, and single-target accessibility in `src/design-system/components/navigation/GroupedList.test.tsx`.
- [X] T020 Implement `GroupedList` and `NavigationRow` with semantic surfaces, optional description/value/status/visual slots, direction-aware disclosure, and minimum targets in the approved new file `src/design-system/components/navigation/GroupedList.tsx`.
- [X] T021 Update shared header, context menu, segmented control, step indicator, and section-heading behavior in `src/design-system/components/navigation/AppNavigation.tsx` and `src/design-system/components/navigation/NavigationControls.tsx`; satisfy existing and T019 direction/accessibility contracts without changing navigation callbacks.
- [X] T022 [P] Add failing field/picker/selection tests for default, focused, filled, invalid, disabled, read-only, selected, required/optional, long-text, and keyboard states in `src/design-system/components/forms/FormField.test.tsx`, `src/design-system/components/forms/PickerField.test.tsx`, and `src/design-system/components/forms/SelectionControls.test.tsx`.
- [X] T023 Implement persistent labels, focus/error/read-only semantics, help/error announcements, bidi-safe amount input, and direction-aware picker disclosure in `src/design-system/components/forms/FormField.tsx` and `src/design-system/components/forms/PickerField.tsx`.
- [X] T024 Implement non-color selected/disabled states, 44×44 targets, logical RTL/LTR ordering, and large-text wrapping in `src/design-system/components/forms/SelectionControls.tsx` and `src/design-system/components/forms/ChipControls.tsx` without changing caller-owned values.

### Overlays and Modal Containers

- [X] T025 [P] Add failing overlay contract tests for native modal semantics, keyboard/safe-area reachability, supported dismissal, draft preservation, focus containment/return, localized close controls, and one dominant action in `src/design-system/components/overlays/Overlays.test.tsx`.
- [X] T026 Replace inline-only sheet presentation with React Native `Modal` behavior, safe-area/keyboard containment, localized dismissal, and accessibility-modal semantics in `src/design-system/components/overlays/AppSheet.tsx`, preserving owner-controlled visibility and drafts.
- [X] T027 Implement the same confirmation, focus, duplicate-submit, failure, and caller-owned consequence contract in `src/design-system/components/overlays/ConfirmationDialog.tsx` and `src/design-system/components/overlays/PickerOverlays.tsx`; remove the hard-coded recording/ready and close text.
- [X] T028 [P] Add failing coverage for a route-modal surface that adds only header, safe-area, keyboard, focus, and dismissal presentation around feature-owned content in the approved new file `src/design-system/components/overlays/RouteModalContainer.test.tsx`.
- [X] T029 Implement `RouteModalContainer` in `src/design-system/components/overlays/RouteModalContainer.tsx` without owning route decisions, feature data, comparison content, or commands.

### State, Feedback, and Recovery

- [X] T030 [P] Add failing coverage for initial/loading, empty/no-result, error, offline, partial, stale, pending-sync, local-success, permission, review, conflict, disabled, read-only, limit, success, and hidden states in `src/design-system/components/feedback/StateFeedback.test.tsx`.
- [X] T031 Expand caller-supplied title/message/consequence/action/source/freshness and safe live-region behavior in `src/design-system/components/feedback/StateView.tsx` and `src/design-system/components/feedback/StatusBanner.tsx`; never infer recovery or represent unknown money as zero.
- [X] T032 Update toast/snackbar/undo and skeleton geometry/accessibility behavior in `src/design-system/components/feedback/TransientFeedback.tsx` and `src/design-system/components/feedback/Skeleton.tsx`, ensuring consequential outcomes have a persistent owner-supplied destination/state.

### Financial Display, Source, Pulse, Attention, and Progress

- [X] T033 [P] Add failing formatter coverage for English numerals, sign supplied independently from tone, long currency codes, large/negative/zero values, and Arabic/English bidi isolation in `src/utils/format-financial-value.test.ts`.
- [X] T034 Implement one bidi-safe financial display formatter in `src/utils/format-financial-value.ts` that accepts caller-owned sign/display state and replaces manual amount/currency assembly without adding financial calculations.
- [X] T035 [P] Add failing tests for confirmed/estimated/pending/unknown/absent/hidden amount states, summary/row/supporting sizes, safe accessibility, and tone-independent sign in `src/design-system/components/financial/FinancialPrimitives.test.tsx`.
- [X] T036 Refactor `AmountText`, `FinancialBadge`, and `CategoryIcon` to consume explicit display projections and semantic type roles in `src/design-system/components/financial/FinancialPrimitives.tsx`, removing inferred ledger signs/colors and protected-value leakage.
- [X] T037 Migrate the changed amount contract mechanically in `src/design-system/components/financial/BalanceCard.tsx`, `AccountCard.tsx`, `BudgetCard.tsx`, `SavingsGoalCard.tsx`, `ObligationProgressCard.tsx`, `InstallmentTimeline.tsx`, and `ReportMetricCard.tsx` without redesigning their feature meaning or calculations.
- [X] T038 [P] Add failing transaction-row coverage for explicit amount projection, aligned dense layout, Source Mark, operational status, hidden values, mixed direction, and one accessible row target in `src/design-system/components/financial/TransactionRow.test.tsx`.
- [X] T039 Update `src/design-system/components/financial/TransactionRow.tsx` to use the explicit financial display and Source Mark contracts while preserving caller-supplied title, category, date, account, source, status, and press behavior.
- [X] T040 [P] Add failing coverage proving progress status/threshold text is caller-supplied, over-target meaning is non-color, and no hard-coded English remains in `src/design-system/components/financial/FinancialProgress.test.tsx`.
- [X] T041 Refactor `src/design-system/components/financial/FinancialProgress.tsx` to render caller-owned target/current/remaining/status projections without calculating business thresholds.
- [X] T042 [P] Add contract tests for source privacy, Financial Pulse evidence delegation, Attention item consequence/action, rail ordering, hidden values, RTL/LTR, non-color meaning, and minimum targets in `src/design-system/components/financial/SharedDecisionSurfaces.test.tsx`.
- [X] T043 Implement the caller-supplied, privacy-safe `SourceMark` contract in the approved new file `src/design-system/components/financial/SourceMark.tsx`.
- [X] T044 Implement the non-calculating, evidence-linked `FinancialPulse` contract in the approved new file `src/design-system/components/financial/FinancialPulse.tsx`.
- [X] T045 Implement caller-ordered `AttentionItem` and `AttentionRail` with reason, consequence, status, optional source, and one owner route in the approved new file `src/design-system/components/feedback/AttentionRail.tsx`.

### Charts, Privacy, Public Exports, and Foundation Gate

- [X] T046 [P] Add failing chart coverage for question/scope/summary, empty/error/partial/hidden, one/equal/dense values, top-four-plus-Other membership, four-series limit, pattern labels, decorative geometry, and caller drill-down in `src/design-system/charts/AccessibleChartFrame.test.tsx`, `DonutChart.test.tsx`, and `LineChart.test.tsx`.
- [X] T047 Implement the accessible chart frame and non-color chart behavior in `src/design-system/charts/AccessibleChartFrame.tsx`, `DonutChart.tsx`, `LineChart.tsx`, and `chart-data.ts` without moving feature data or report calculations into R01.
- [X] T048 [P] Add failing privacy tests for stable masking, safe accessibility values, authorized reveal/remask, background/lock reset, and external-surface exclusion in `src/design-system/components/SensitiveValue.test.tsx`, `src/design-system/privacy.test.ts`, and `src/design-system/external-sensitive-display.test.ts`.
- [X] T049 Implement stable non-magnitude masking and safe visible/hidden transitions in `src/design-system/components/SensitiveValue.tsx`, `src/design-system/privacy.ts`, and `src/design-system/external-sensitive-display.ts` without changing preference or authorization ownership.
- [X] T050 Export only the approved semantic contracts and new shared components from `src/design-system/index.ts`; do not add speculative aliases or feature-owned services.
- [X] T051 Run `npm run typecheck`, `npm run lint`, `npm run check:design-system`, and `npm test -- --runInBand src/design-system`; record exact results and all current consumer migrations in `specs/012-shared-ui-foundation/validation/shared-foundation.md`.
- [X] T052 Fix only Shared Foundation defects recorded by T051 in their owning `src/design-system/`, `src/components/StyledText.tsx`, `src/utils/format-financial-value.ts`, `src/localization/messages/`, or `scripts/check-design-system-boundaries.mjs` file, then rerun and append passing evidence to `specs/012-shared-ui-foundation/validation/shared-foundation.md` before starting Screen 1.

**Checkpoint**: Shared contracts are typed, localized, tested, and consumable; downstream screen work may begin.

---

## Phase 3: Screen 1 — Root Layout and Entry (User Story 2, Priority P1)

**Goal**: Apply the shared visual shell and truthful startup state without changing provider order, privacy, notification runtime, hydration, or route resolution.

**Independent Test**: Exercise unhydrated, signed-out, onboarding-incomplete, locked, ready, and valid/invalid pending-destination starts; the same current route must resolve and protected content must never flash.

- [X] T053 [P] [US2] Add failing route-preservation and non-revealing startup presentation coverage in `src/features/shell/RootLayoutOptions.test.tsx`, `src/features/shell/resolve-entry-route.test.ts`, and `src/features/shell/AppShellStates.test.tsx` before editing either owned route.
- [X] T054 [US2] Apply semantic page/system-surface continuity around the existing FontGate → FoundationProviders → AppShellProvider → AppPrivacyGate → NotificationResponseRuntime → Stack order in `app/_layout.tsx`, changing no provider, lock timer, or navigation behavior.
- [X] T055 [US2] Redesign only the unresolved-hydration loading hierarchy in `app/index.tsx` using shared state/skeleton presentation while retaining `resolveEntryRoute` and render-time `Redirect` as the sole destination logic.
- [X] T056 [US2] Cover partial hydration, session expiry, incomplete onboarding, privacy lock, safe pending destination, invalid destination, and redirect success in `src/features/shell/resolve-entry-route.test.ts` and `src/features/shell/ProtectedNavigation.test.tsx`, asserting unchanged destinations and zero protected-content flashes.
- [X] T057 [US2] Validate equivalent startup titles/announcements and logical presentation in Arabic RTL and English LTR in `src/features/shell/AppShellLocalization.test.tsx`; add any missing screen text only to `src/localization/messages/en.ts` and `ar.ts`.
- [X] T058 [US2] Validate root/entry screen-reader order, polite loading announcement, hidden-value privacy, 200% text, 320×568 layout, and safe-area behavior in `src/features/shell/AppShellAccessibility.test.tsx`.
- [X] T059 [US2] Validate active theme changes and immediate reduced-motion behavior do not alter destination or hydration state in `src/features/shell/AppShellStates.test.tsx`.
- [X] T060 [US2] Run the Root/Entry test set and `npm run check:app-shell`, recording exact commands and outcomes in `specs/012-shared-ui-foundation/validation/root-entry.md`.
- [ ] T061 [P] [US2] Validate Root/Entry on a supported Android device in Arabic/English, light/dark, standard/200% text, TalkBack, reduced motion, and locked/unhydrated states; record device/build/screens/states in `specs/012-shared-ui-foundation/validation/root-entry-android.md`.
- [ ] T062 [P] [US2] Validate Root/Entry on a supported iOS device or approved iOS environment with the same applicable matrix and VoiceOver; record evidence in `specs/012-shared-ui-foundation/validation/root-entry-ios.md`.
- [ ] T063 [US2] Fix only Root/Entry defects recorded by T060–T062 in `app/_layout.tsx`, `app/index.tsx`, or the named shared owner, then rerun the focused tests and update `specs/012-shared-ui-foundation/validation/root-entry.md` before Screen 2.

**Checkpoint**: Screen 1 is independently implemented, tested, device-reviewed, and corrected.

---

## Phase 4: Screen 2 — Five-Tab Shell (User Story 2, Priority P1)

**Goal**: Deliver the integrated premium five-tab bar with stable destinations, labels, selection, Add emphasis, safe areas, and direction behavior.

**Independent Test**: Select Home, Transactions, Add, Reports, and More in both directions; every route and label meaning remains unchanged, selected state is non-color, and feature context is preserved.

- [X] T064 [US2] Add failing tests for five fixed destinations, persistent localized labels/icons, non-color selection, integrated Add emphasis, safe-area padding, repeated selection, and 44×44 targets in `src/features/shell/AppTabs.test.tsx`.
- [X] T065 [US2] Implement the Gulf Premium tab hierarchy, icon/label states, border-first separation, and stronger integrated Add treatment in `src/features/shell/AppTabs.tsx` without changing `tabItems`, route strings, or `onSelect` behavior.
- [X] T066 [US2] Integrate bottom safe-area handling and semantic system surfaces in `app/(tabs)/_layout.tsx` while preserving `ProtectedRouteGate`, all five `Tabs.Screen` names, and `router.navigate` behavior.
- [X] T067 [US2] Remove the unused competing presentation from `src/design-system/components/navigation/BottomTabBar.tsx`, its export in `src/design-system/index.ts`, and obsolete expectations in `src/design-system/components/navigation/BottomTabBar.test.tsx` only after T001 confirms no product consumer; keep `AppTabs` as the sole product tab implementation.
- [X] T068 [US2] Add unchanged-route and preserved-context assertions for all tab selections in `src/features/shell/NavigationJourney.test.tsx` and `src/features/shell/ProtectedNavigation.test.tsx`.
- [X] T069 [US2] Validate RTL/LTR visual and focus order, mirrored directional semantics, fixed non-directional icons, English numerals, and identical destination meaning in `src/features/shell/ShellDirection.test.tsx` and `AppShellLocalization.test.tsx`.
- [X] T070 [US2] Validate 200% labels, 320×568 width, 44×44 targets, screen-reader/TalkBack/VoiceOver tab roles and states, and no clipped Add label in `src/features/shell/AppShellAccessibility.test.tsx`.
- [X] T071 [US2] Add brief selected/pressed feedback and immediate reduced-motion alternatives in `src/features/shell/AppTabs.tsx`, with timing assertions in `src/features/shell/AppTabs.test.tsx` and no bounce or navigation delay.
- [X] T072 [US2] Run the Five-Tab tests, shell localization/accessibility journeys, typecheck, and app-shell boundary check; record outcomes in `specs/012-shared-ui-foundation/validation/five-tab-shell.md`.
- [ ] T073 [P] [US2] Validate all five tabs on Android across Arabic/English, light/dark, standard/200% text, TalkBack, reduced motion, smallest/large phone, and bottom insets; record evidence in `specs/012-shared-ui-foundation/validation/five-tab-shell-android.md`.
- [ ] T074 [P] [US2] Validate the equivalent iOS/VoiceOver matrix and home-indicator inset behavior in `specs/012-shared-ui-foundation/validation/five-tab-shell-ios.md`.
- [X] T075 [US2] Fix only tab-shell defects from T072–T074 in `src/features/shell/AppTabs.tsx`, `app/(tabs)/_layout.tsx`, or named shared token/icon owners, then rerun tests and update `specs/012-shared-ui-foundation/validation/five-tab-shell.md`.
- [X] T076 [US2] Re-run `src/features/shell/NavigationJourney.test.tsx` after tab fixes and record proof in `specs/012-shared-ui-foundation/validation/five-tab-shell.md` that every current primary and representative secondary destination remains reachable.

**Checkpoint**: Screen 2 is independently implemented, tested, device-reviewed, and corrected.

---

## Phase 5: Screen 3 — Auth Required (User Story 2, Priority P1)

**Goal**: Replace the placeholder-like protected-entry notice with the shared focused hierarchy while retaining sanitized pending destination, sign-in, cancellation, and safe return behavior.

**Independent Test**: Open a protected destination signed out, choose sign-in or back, and confirm only the same current safe destination outcomes occur.

- [X] T077 [US2] Add failing hierarchy, action-state, and safe-navigation tests for the protected-entry screen in the approved new file `src/features/shell/AuthRequiredRoute.test.tsx`, covering valid, invalid, and absent pending destinations.
- [X] T078 [US2] Redesign `app/modals/auth-required.tsx` with the shared route-modal/state hierarchy, one dominant sign-in action, secondary back action, semantic spacing/type, and localized explanation; preserve `sanitizeReturnRoute`, `setPendingDestination`, `router.replace`, and `router.back` behavior.
- [X] T079 [US2] Replace the auth-required use of generic placeholder presentation without changing `src/features/shell/PlaceholderRoute.tsx` behavior for its other current consumers; update imports only in `app/modals/auth-required.tsx`.
- [X] T080 [US2] Add loading/disabled duplicate-submit handling for the async pending-destination write in `app/modals/auth-required.tsx`, showing truthful failure/retry presentation without navigating before the existing write succeeds.
- [X] T081 [US2] Verify pending-destination sanitization, sign-in replacement, cancellation, deep-link origin, expired session, and protected return behavior in `src/features/shell/ProtectedNavigation.test.tsx` and `navigation-context.test.ts`.
- [X] T082 [US2] Add Arabic RTL and English LTR copy/action parity, long-text wrapping, and direction-aware focus assertions to `src/features/shell/AppShellLocalization.test.tsx`; add missing keys only in `src/localization/messages/en.ts` and `ar.ts`.
- [X] T083 [US2] Validate screen-reader heading/action order, 200% text, 320×568, safe area, 44×44 targets, one primary action, and reduced motion in `src/features/shell/AppShellAccessibility.test.tsx` and `AuthRequiredRoute.test.tsx`.
- [X] T084 [US2] Run focused auth-required, protected-navigation, localization, accessibility, typecheck, and app-shell boundary checks; record outcomes in `specs/012-shared-ui-foundation/validation/auth-required.md`.
- [ ] T085 [P] [US2] Validate Auth Required on Android in Arabic/English, light/dark, 200% text, TalkBack, reduced motion, valid/invalid destination, slow write, error, and success states; record `specs/012-shared-ui-foundation/validation/auth-required-android.md`.
- [ ] T086 [P] [US2] Validate the equivalent iOS/VoiceOver matrix and modal safe-area/back behavior in `specs/012-shared-ui-foundation/validation/auth-required-ios.md`.
- [X] T087 [US2] Fix only Auth Required defects from T084–T086 in `app/modals/auth-required.tsx` or its named shared owner, rerun focused tests, and update `specs/012-shared-ui-foundation/validation/auth-required.md` before Screen 4.

**Checkpoint**: Screen 3 is independently implemented, tested, device-reviewed, and corrected.

---

## Phase 6: Screen 4 — Planning Conflict Shared Container (User Story 2, Priority P1)

**Goal**: Apply the R01 route-modal container while leaving all planning conflict lookup, comparison, consequence, decision, and command behavior unchanged.

**Independent Test**: Open a representative conflict, inspect/dismiss/resolve it, and confirm presentation improves while every feature-owned value and outcome matches the current planning tests.

- [X] T088 [US2] Add failing route-container tests for missing/valid `conflictId`, long content, safe-area/keyboard reachability, focus entry/return, and dismissal in the approved new file `src/features/shell/PlanningConflictRoute.test.tsx`.
- [X] T089 [US2] Wrap `PlanningConflictScreen` with the shared `RouteModalContainer` in `app/modal/planning-conflict.tsx`, passing through `conflictId` unchanged and adding no conflict lookup, comparison, consequence, selection, or command logic.
- [X] T090 [US2] Add route-owned localized title/close semantics for the container in `src/localization/messages/en.ts` and `src/localization/messages/ar.ts`; do not alter feature-owned conflict copy.
- [X] T091 [US2] Preserve every loading, not-found/error, unresolved comparison, submitting, failure, and resolution result exposed by `src/features/financial-planning/PlanningConflictScreen.tsx`; prove unchanged behavior in `src/features/financial-planning/PlanningStates.test.tsx` without redesigning the feature screen.
- [X] T092 [US2] Verify dismissal and completion retain current navigation/return consequences and do not invoke a planning command on close in `src/features/shell/PlanningConflictRoute.test.tsx` and `src/features/financial-planning/PlanningStates.test.tsx`.
- [X] T093 [US2] Add Arabic RTL/English LTR container alignment, mixed-direction amount/reference preservation, and direction-aware close/focus assertions in `src/features/financial-planning/FinancialPlanningAccessibility.test.tsx`.
- [X] T094 [US2] Validate screen-reader modal role/order, 200% text, 320×568, keyboard, safe areas, 44×44 close/action targets, one dominant action, and non-color conflict meaning in `src/features/financial-planning/FinancialPlanningAccessibility.test.tsx` and `RouteModalContainer.test.tsx`.
- [X] T095 [US2] Validate standard opening/closing timing and immediate reduced-motion state in `src/design-system/components/overlays/RouteModalContainer.test.tsx` without delaying conflict content.
- [X] T096 [US2] Run planning-container, planning-state, planning-accessibility, typecheck, and boundary checks; record outcomes in `specs/012-shared-ui-foundation/validation/planning-conflict-container.md`.
- [ ] T097 [P] [US2] Validate Planning Conflict container on Android with short/long content, Arabic/English, light/dark, 200% text, TalkBack, keyboard, reduced motion, loading/error/submitting states, and dismissal; record `specs/012-shared-ui-foundation/validation/planning-conflict-android.md`.
- [ ] T098 [P] [US2] Validate the equivalent iOS/VoiceOver modal/safe-area matrix in `specs/012-shared-ui-foundation/validation/planning-conflict-ios.md`.
- [X] T099 [US2] Fix only shared-container defects from T096–T098 in `app/modal/planning-conflict.tsx` or `src/design-system/components/overlays/RouteModalContainer.tsx`; rerun planning tests and update `specs/012-shared-ui-foundation/validation/planning-conflict-container.md` before Screen 5.

**Checkpoint**: Screen 4 is independently implemented, tested, device-reviewed, and corrected; planning business behavior is unchanged.

---

## Phase 7: Screen 5 — Design-System Gallery (User Stories 1, 3, 4, 5, and 6)

**Goal**: Make every R01 contract, state, boundary, and stress case inspectable from the existing diagnostic route without turning it into a product destination.

**Independent Test**: Navigate every gallery section and switch theme, locale, visibility, motion, text/content stress, and component state; each family demonstrates intended use/misuse and passes accessibility/privacy checks independently of unfinished feature redesigns.

- [X] T100 [US6] Add failing gallery-shell tests for Foundation, Navigation, Financial, Interaction, States, Charts, Accessibility, and Privacy sections plus theme/locale/visibility/motion controls in `src/features/design-system/DesignSystemGallery.test.tsx`.
- [X] T101 [US6] Reorganize `src/features/design-system/DesignSystemGallery.tsx` into the eight approved screen sections with shared segmented/navigation controls, persistent diagnostic title, responsive wrapping, and no change to `app/design-system/index.tsx` route purpose.
- [X] T102 [P] [US1] Add failing semantic-role, typography, spacing, radius, elevation, icon, amount-size, long-text, and light/dark fixture coverage in the approved new file `src/features/design-system/gallery/FoundationGallery.test.tsx`.
- [X] T103 [P] [US1] Implement realistic localized Foundation fixtures and intended/prohibited-use descriptions in `src/features/design-system/gallery/FoundationGallery.tsx`, using no feature calculations or raw brand values.
- [X] T104 [P] [US1] Extend failing financial gallery coverage for summary, Financial Pulse, Source Mark, Attention Rail, progress, insight composition, grouped transaction row, hidden/unknown/estimated/pending values, and restrained cards in `src/features/design-system/gallery/FinancialGallery.test.tsx`.
- [X] T105 [P] [US1] Implement the approved financial visual hierarchy and stress fixtures in `src/features/design-system/gallery/FinancialGallery.tsx`, using caller-supplied projections and no invented business results.
- [X] T106 [P] [US3] Extend failing interaction coverage for every button, field, picker, segment, switch, checkbox, radio, chip, sheet, dialog, validation, loading, duplicate-submit, keyboard, cancel, confirm, error, and draft-preservation state in `src/features/design-system/gallery/InteractionGallery.test.tsx`.
- [X] T107 [P] [US3] Implement localized interaction fixtures and controlled state transitions in `src/features/design-system/gallery/InteractionGallery.tsx`, removing every hard-coded Amount/Save/Saved/Retry/Delete/recording string and proving no fixture command changes feature data.
- [X] T108 [P] [US4] Add failing coverage for the complete shared state/recovery vocabulary, caller-supplied consequence, valid action, non-color meaning, skeleton geometry, and unknown-not-zero behavior in the approved new file `src/features/design-system/gallery/StateGallery.test.tsx`.
- [X] T109 [P] [US4] Implement loading, empty/no-result, error, offline, partial, stale, local-success, pending-sync, permission, review, conflict, disabled, read-only, limit, success, and hidden fixtures in `src/features/design-system/gallery/StateGallery.tsx`.
- [X] T110 [P] [US5] Extend failing coverage for Arabic RTL/English LTR, mixed scripts, English numerals, direction icons, chronology, 200% text, 320×568 reflow, screen-reader order, focus, targets, and reduced motion in `src/features/design-system/gallery/AccessibilityGallery.test.tsx`.
- [X] T111 [P] [US5] Replace hard-coded Setup/week/month and placeholder English fixtures with localized realistic bilingual/mixed-direction data in `src/features/design-system/gallery/AccessibilityGallery.tsx`, exposing the required large-text and focus-order probes.
- [X] T112 [P] [US4] Extend privacy-gallery tests for default masking, authorized reveal/hide, background/lock remask, hidden accessibility output, stable layout, app-switcher/external display, and protected source detail in `src/features/design-system/gallery/PrivacyGallery.test.tsx`.
- [X] T113 [P] [US4] Implement the visible/hidden/source privacy scenarios in `src/features/design-system/gallery/PrivacyGallery.tsx` without embedding real user or message data.
- [X] T114 [P] [US4] Extend chart-gallery tests for question/scope/summary, empty/error/partial/hidden, single/equal/dense values, top-four-plus-Other membership, line-pattern labels, and caller drill-down in `src/features/design-system/gallery/ChartGallery.test.tsx`.
- [X] T115 [P] [US4] Implement localized chart stress fixtures and textual fallbacks in `src/features/design-system/gallery/ChartGallery.tsx`, replacing hard-coded Food/Rent/Bills/Income/Expense/Open details labels.
- [X] T116 [P] [US5] Add every Gallery fixture, intended-use, misuse, state, control, chart, privacy, and validation key introduced by T100–T115 to `src/localization/messages/en.ts` with realistic Masarifi wording.
- [X] T117 [P] [US5] Add complete natural Arabic equivalents with matching parameters and English numerals for T116 in `src/localization/messages/ar.ts`.
- [X] T118 [US6] Add concise intended-use, prohibited-use, variants, states, accessibility, privacy, and downstream-consumer guidance to each gallery section in `src/features/design-system/DesignSystemGallery.tsx` and its section components, keeping the contract aligned with `specs/012-shared-ui-foundation/contracts/shared-presentation-contract.md`.
- [X] T119 [US6] Update `src/features/design-system/DesignSystemIntegration.test.tsx` to traverse all gallery sections and representative Arabic/English, light/dark, visible/hidden, standard/reduced-motion, long/dense, and 200% fixtures without depending on unfinished R02–R20 screens.
- [X] T120 [US5] Run gallery tests, design-system tests, localization parity checks, typecheck, lint, and `npm run check:design-system`; record exact outcomes in `specs/012-shared-ui-foundation/validation/design-system-gallery.md`.
- [ ] T121 [P] [US5] Validate the Gallery on Android across all sections, Arabic/English, light/dark/system, visible/hidden, standard/200% text, TalkBack, reduced motion, keyboard, 320×568/large phone, and every applicable state; record `specs/012-shared-ui-foundation/validation/design-system-gallery-android.md`.
- [ ] T122 [P] [US5] Validate the equivalent iOS/VoiceOver matrix and native overlay/safe-area behavior in `specs/012-shared-ui-foundation/validation/design-system-gallery-ios.md`.
- [X] T123 [US6] Fix only Gallery or owning shared-component defects recorded by T120–T122, rerun affected tests/boundaries, and append final evidence to `specs/012-shared-ui-foundation/validation/design-system-gallery.md` before cross-app validation.

**Checkpoint**: Screen 5 independently proves every shared contract and downstream adoption boundary.

---

## Phase 8: Final Cross-Consumer Consistency and R01 Gate

**Purpose**: Prove all R01 screens and shared consumers work together without local tokens, route changes, business-rule drift, privacy leaks, or unresolved device defects.

- [X] T124 Run `npm run typecheck`, `npm run lint`, `npm run check:design-system`, and `npm run check:app-shell`; record zero new failures and exact output in `specs/012-shared-ui-foundation/validation/final-r01.md`.
- [X] T125 Run `npm test -- --runInBand src/design-system src/features/design-system src/features/shell` and append suite/test counts and failures to `specs/012-shared-ui-foundation/validation/final-r01.md`.
- [X] T126 Run targeted regression tests for every importer recorded by T001, verifying mechanical shared-prop migrations did not redesign or alter R02–R20 feature behavior; record file/suite coverage in `specs/012-shared-ui-foundation/validation/consumer-regression.md`.
- [X] T127 Verify all six owned routes preserve provider order, destinations, tab meaning/order, pending-destination behavior, conflict commands, and diagnostic reachability using `src/features/shell/RootLayoutOptions.test.tsx`, `resolve-entry-route.test.ts`, `NavigationJourney.test.tsx`, `ProtectedNavigation.test.tsx`, and `ValidationRoutesRegression.test.tsx`; record results in `specs/012-shared-ui-foundation/validation/final-r01.md`.
- [ ] T128 Verify Arabic/English key parity, English numerals, bidi financial output, light/dark/system roles, hidden values, state distinctions, non-color meaning, 200% text, screen readers, keyboard, safe areas, 44×44 targets, and reduced motion across the Gallery and six owned routes; record the completed matrix in `specs/012-shared-ui-foundation/validation/final-matrix.md`.
- [ ] T129 [P] Re-run the complete R01 journey on a supported Android device, including cold start, lock, all tabs, auth-required, planning conflict, gallery sections, background remask, TalkBack, and smallest/large phone; record final device/build evidence in `specs/012-shared-ui-foundation/validation/final-android.md`.
- [ ] T130 [P] Re-run the equivalent iOS/VoiceOver journey and native modal/home-indicator/app-switcher checks in `specs/012-shared-ui-foundation/validation/final-ios.md`.
- [ ] T131 Fix only defects recorded by T124–T130 in the named owner under `src/design-system/`, `src/features/design-system/`, `src/features/shell/AppTabs.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/modals/auth-required.tsx`, or `app/modal/planning-conflict.tsx`; update `specs/012-shared-ui-foundation/contracts/shared-presentation-contract.md` if a public contract changes, rerun affected checks, and add no downstream local workaround.
- [X] T132 Re-run the full commands from `specs/012-shared-ui-foundation/quickstart.md` after T131 and record final pass/fail totals, unresolved external constraints, and validation timestamps in `specs/012-shared-ui-foundation/validation/final-r01.md`.
- [X] T133 Complete the R01 adoption handoff in `specs/012-shared-ui-foundation/validation/README.md` by linking final Android/iOS evidence, listing approved public components, identifying any explicitly deferred downstream screen adoption, and confirming no route, permission, provider, calculation, command, or product capability changed.

**Final Checkpoint**: R01 is ready for downstream feature-area implementation only when T124–T133 are complete and no required validation defect remains.

---

## Dependencies and Execution Order

### Phase Dependencies

```text
Phase 1 Baseline
  → Phase 2 Shared Foundation
    → Screen 1 Root/Entry → validate/fix
      → Screen 2 Five-Tab Shell → validate/fix
        → Screen 3 Auth Required → validate/fix
          → Screen 4 Planning Conflict Container → validate/fix
            → Screen 5 Design-System Gallery → validate/fix
              → Phase 8 Final R01 Gate
```

- Phase 2 blocks every screen because all owned screens consume its semantic, state, overlay, localization, accessibility, privacy, and motion contracts.
- Each screen's final fix task blocks the next screen to enforce independent visual review.
- Phase 8 starts only after the Gallery fix task T123.
- Android/iOS validation tasks marked `[P]` may run in parallel after that screen's automated checks pass.

### User Story Traceability

- **US1 — Premium Masarifi interface**: Shared Foundation plus Gallery tasks T102–T105; independently proven through semantic and financial gallery fixtures.
- **US2 — Stable shell navigation**: Screen tasks T053–T099; independently proven by unchanged route/gate/command outcomes and four screen-specific device gates.
- **US3 — Predictable controls**: Shared Foundation plus Gallery tasks T106–T107; independently proven through controlled form/selection/overlay and draft-recovery fixtures.
- **US4 — Real states and recovery**: Shared Foundation plus Gallery tasks T108–T109 and T112–T115; independently proven by the state, privacy, and chart fixtures.
- **US5 — Arabic/English accessibility parity**: Shared Foundation plus Gallery tasks T110–T111 and T116–T122; independently proven by the full language/accessibility device matrix.
- **US6 — Contract review before adoption**: Gallery tasks T100–T101, T118–T119, and T123; independently proven when every family and misuse boundary is reachable from `/design-system`.

## Parallel Opportunities

- After T003, independent failing-test tasks in tokens/type, primitives, navigation, forms, overlays, states, financial, charts, and privacy may be authored in parallel where marked `[P]`.
- English and Arabic localization tasks may run in parallel only when both preserve identical keys and interpolation parameters.
- After Gallery shell T101, section-specific test/fixture pairs for Foundation, Financial, Interaction, States, Accessibility, Privacy, and Charts may proceed in parallel, with each implementation waiting for its own failing test.
- Android and iOS validation for a completed screen may run in parallel; both must finish before the screen's defect-fix task.
- Screen implementations themselves remain sequential under the user's screen-first contract.

### Parallel Example: Shared Foundation

```text
T004 token/theme tests
T007 typography tests
T010 motion/icon tests
T019 grouped-navigation tests
T022 form/selection tests
T025 overlay tests
T030 state tests
T033 formatter tests
T046 chart tests
T048 privacy tests
```

### Parallel Example: Gallery Screen

```text
T102/T103 Foundation fixtures
T104/T105 Financial fixtures
T106/T107 Interaction fixtures
T108/T109 State fixtures
T110/T111 Accessibility fixtures
T112/T113 Privacy fixtures
T114/T115 Chart fixtures
```

## Implementation Strategy

### Reviewable MVP

The smallest reviewable slice is Phase 1 + Phase 2 + Gallery shell T100–T101 + US1 fixtures T102–T105. It proves the Gulf Premium visual contract but does **not** complete R01 or authorize downstream implementation until every owned screen and final gate passes.

### Sequential Delivery

1. Complete and validate Shared Foundation.
2. Implement Root/Entry, validate on both platforms, fix findings.
3. Repeat for Five-Tab Shell, Auth Required, and Planning Conflict.
4. Implement the Gallery contract harness, validate every shared state, fix findings.
5. Run cross-consumer regression and final Android/iOS journeys.

### Stop Conditions

- Stop a screen before device validation if its focused automated tests or boundary checks fail.
- Stop before the next screen if Android or iOS evidence has an unresolved required defect.
- Return a shared defect to its R01 owner; do not patch an individual downstream feature screen.
- Require a separate approved specification before changing a route, permission, business rule, provider, calculation, command, or product capability.

## Notes

- Every task uses an existing or explicitly approved new file path.
- Existing user changes must be preserved; do not reset unrelated work.
- `[P]` means file-level parallelism, not permission to bypass task dependencies.
- Tests precede implementation for each changed contract or screen.
- Commit only after a logical task group passes its focused checks; do not combine unrelated screens.
