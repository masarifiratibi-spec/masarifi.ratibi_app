# Tasks: Mobile Design System and Interaction Language

**Input**: Design documents from `specs/002-mobile-design-system/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/mobile-design-system-contract.md`, and `quickstart.md`

**Tests**: Required by the plan and constitution. Add focused behavior tests before each
implementation group and run the named targeted command before marking that group complete.

**Organization**: Tasks are grouped by user story. Every task names its target file and its
independent verification so a low-context implementer can execute it without guessing.

## Phase 1: Setup

**Purpose**: Add only the runtime assets and checks required by the approved plan.

- [X] T001 Declare `expo-font`, `@expo/vector-icons`, and `react-native-svg` as direct Expo-compatible dependencies in `package.json` and `package-lock.json`; verify with `npx expo install --check`.
- [X] T002 [P] Add licensed IBM Plex Sans Arabic and IBM Plex Sans regular, semibold, and bold font files plus their license notice under `assets/fonts/`; verify every referenced `.ttf` exists and opens as a non-empty file.
- [X] T003 [P] Add `scripts/check-design-system-boundaries.mjs` and the `check:design-system` script in `package.json` to reject raw colors outside `src/design-system/tokens.ts`, feature-local token maps, Admin imports, and hard-coded gallery strings; verify the script reports its scanned file count and exits 0 on the baseline.
- [X] T004 Record the pre-implementation results of `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, and `npm run check:foundation` under a new baseline section in `specs/002-mobile-design-system/quickstart.md`; verify each command has an explicit PASS or existing-failure note.

---

## Phase 2: Foundational Design-System Primitives

**Purpose**: Complete the shared token, theme, font, motion, icon, localization, and primitive
boundaries that block every user story.

**Critical**: Finish this phase before starting any user-story phase.

- [X] T005 Add failing coverage for reference colors, semantic status colors, financial colors, chart palettes, spacing, radius, elevation, and minimum targets in `src/design-system/tokens.test.ts`; verify the targeted Jest run fails for the missing SPEC-002 values.
- [X] T006 Expand the single raw-value source in `src/design-system/tokens.ts` with the approved teal, bronze, warm-neutral, dark-surface, border, status, financial, and chart reference values; verify `src/design-system/tokens.test.ts` passes its color assertions.
- [X] T007 Add the complete spacing, typography-size, radius, border-width, elevation, icon-size, control-height, and 320-by-568 viewport metrics to `src/design-system/tokens.ts`; verify the remaining metric assertions in `src/design-system/tokens.test.ts` pass.
- [X] T008 Add failing light/dark semantic mapping, status-vs-financial separation, and contrast-pair assertions in `src/design-system/theme.test.ts`; verify the test fails before theme expansion.
- [X] T009 Expand `src/design-system/theme.ts` and `ThemeColors` in `src/design-system/tokens.ts` to resolve every required light/dark semantic value without component mode checks; verify `src/design-system/theme.test.ts` passes.
- [X] T010 Add failing tests for IBM Plex family selection, weights, line heights, tabular financial numbers, locale direction, and font asset registration in `src/design-system/typography.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T011 Implement typography variants and the local Expo Font loader in `src/design-system/typography.ts`; verify `src/design-system/typography.test.ts` passes and exports heading, body, helper, label, and amount styles.
- [X] T012 Gate product rendering on successful local font loading and expose a stable loading fallback in `app/_layout.tsx`; verify `src/design-system/typography.test.ts` confirms no product text renders before fonts are ready.
- [X] T013 Add failing tests for the approved duration buckets and reduced-motion immediate-state behavior in `src/design-system/motion.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T014 Implement motion tokens and a reduced-motion-aware animation helper using React Native Animated in `src/design-system/motion.ts`; verify `src/design-system/motion.test.ts` passes for 100-140, 140-180, 180-220, and 200-240 millisecond buckets.
- [X] T015 Add failing tests for icon sizes, accessible labels, directional mirroring, and non-directional stability in `src/design-system/icons.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T016 Implement the Expo Vector Icons wrapper and explicit directional-icon mapping in `src/design-system/icons.tsx`; verify `src/design-system/icons.test.tsx` passes in RTL and LTR fixtures.
- [X] T017 [P] Add the complete Arabic `designSystem` message namespace for component labels, states, actions, chart summaries, privacy, and gallery sections in `src/localization/messages/ar.ts`; verify no value is empty.
- [X] T018 [P] Add the exact matching English `designSystem` message namespace in `src/localization/messages/en.ts`; verify its key set matches the Arabic namespace.
- [X] T019 Add a localization parity test for every new design-system key and action label in `src/localization/design-system-messages.test.ts`; verify the targeted Jest run passes for Arabic and English.
- [X] T020 Add failing behavior tests for semantic state styling, 44-by-44 targets, loading disablement, and accessible names in `src/design-system/components/primitives.test.tsx`; verify the targeted Jest run fails before primitive creation.
- [X] T021 Implement typed primary, secondary, tertiary, quiet, destructive, premium, loading, and icon-only variants in `src/design-system/components/ActionButton.tsx` and `src/design-system/components/IconButton.tsx`; verify the button cases in `src/design-system/components/primitives.test.tsx` pass.
- [X] T022 Implement border-first surfaces and non-color status cues in `src/design-system/components/SurfaceCard.tsx` and `src/design-system/components/StatusBadge.tsx`; verify the surface and badge cases in `src/design-system/components/primitives.test.tsx` pass.
- [X] T023 Export only the approved public tokens, theme, typography, icons, motion, and primitives from `src/design-system/index.ts`; verify `npm run check:design-system` rejects an intentional temporary raw-color fixture, then remove the fixture and confirm the command exits 0.

**Checkpoint**: Shared foundations compile, targeted tests pass, and later phases can import one
public design-system boundary.

---

## Phase 3: User Story 1 - Understand Financial Information Consistently (Priority: P1)

**Goal**: Present financial values and operational states with one consistent hierarchy and
with non-color meaning in both themes.

**Independent Test**: Render representative income, expense, transfer, refund, savings, debt,
success, warning, and error examples; identify amount, meaning, status, and primary action
without relying on color.

### Tests for User Story 1

- [X] T024 [P] [US1] Add failing amount hierarchy, currency direction, sign, masking-slot, and financial badge tests in `src/design-system/components/financial/FinancialPrimitives.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T025 [P] [US1] Add failing balance and account card anatomy, theme, optional-content, and large-text tests in `src/design-system/components/financial/BalanceAccountCards.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T026 [P] [US1] Add failing transaction source, financial meaning, operational status, and optional metadata tests in `src/design-system/components/financial/TransactionRow.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T027 [P] [US1] Add failing progress threshold, label, percentage, and non-color-cue tests in `src/design-system/components/financial/FinancialProgress.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 1

- [X] T028 [US1] Implement stable-width `AmountText`, `FinancialBadge`, and `CategoryIcon` variants in `src/design-system/components/financial/FinancialPrimitives.tsx`; verify `FinancialPrimitives.test.tsx` passes.
- [X] T029 [P] [US1] Implement balance hierarchy, hide-value slot, trend, comparison, and optional action in `src/design-system/components/financial/BalanceCard.tsx`; verify the balance cases in `BalanceAccountCards.test.tsx` pass.
- [X] T030 [P] [US1] Implement account type, masked identifier, balance, status, and optional action in `src/design-system/components/financial/AccountCard.tsx`; verify the account cases in `BalanceAccountCards.test.tsx` pass.
- [X] T031 [US1] Implement category, merchant/title, date, account, source, status, and amount layout in `src/design-system/components/financial/TransactionRow.tsx`; verify `TransactionRow.test.tsx` passes for financial and operational states together.
- [X] T032 [US1] Implement accessible progress bar and ring variants with stable labels in `src/design-system/components/financial/FinancialProgress.tsx`; verify `FinancialProgress.test.tsx` passes at normal, warning, high, and exceeded thresholds.
- [X] T033 [P] [US1] Add failing budget, savings, obligation, and installment composition tests in `src/design-system/components/financial/FinancialCards.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T034 [P] [US1] Implement budget and savings compositions from shared primitives in `src/design-system/components/financial/BudgetCard.tsx` and `src/design-system/components/financial/SavingsGoalCard.tsx`; verify the budget and savings cases in `src/design-system/components/financial/FinancialCards.test.tsx` pass.
- [X] T035 [US1] Implement obligation progress and installment timeline compositions in `src/design-system/components/financial/ObligationProgressCard.tsx` and `src/design-system/components/financial/InstallmentTimeline.tsx`; verify `FinancialCards.test.tsx` passes.
- [X] T036 [P] [US1] Add failing report metric and comparison direction tests in `src/design-system/components/financial/ReportComparison.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T037 [US1] Implement report metric and higher/lower/neutral comparison variants in `src/design-system/components/financial/ReportMetricCard.tsx` and `src/design-system/components/financial/ComparisonIndicator.tsx`; verify `ReportComparison.test.tsx` passes in RTL and LTR.
- [X] T038 [US1] Add gallery coverage tests for every US1 component and all financial-vs-status combinations in `src/features/design-system/gallery/FinancialGallery.test.tsx`; verify the test fails before the section exists.
- [X] T039 [US1] Implement the localized light/dark financial gallery section in `src/features/design-system/gallery/FinancialGallery.tsx`; verify `FinancialGallery.test.tsx` passes without raw colors or hard-coded user strings.
- [X] T040 [US1] Run `npx jest --runInBand src/design-system/components/financial src/features/design-system/gallery/FinancialGallery.test.tsx`; verify all US1 suites pass before marking the story complete.

**Checkpoint**: User Story 1 is independently demonstrable and is the suggested MVP.

---

## Phase 4: User Story 2 - Complete Mobile Actions Comfortably and Safely (Priority: P1)

**Goal**: Provide reachable forms, feedback, undo, duplicate-submit protection, and explicit
high-risk confirmations without losing entered data.

**Independent Test**: Complete add, select, validate, save, undo, destructive confirmation,
keyboard, and bottom-sheet fixtures on small and large phones using one hand.

### Tests for User Story 2

- [X] T041 [P] [US2] Add failing visible-label, helper, validation, keyboard type, and preserved-value tests for text, phone, OTP, search, and amount variants in `src/design-system/components/forms/FormField.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T042 [P] [US2] Add failing trigger label, selected value, empty value, disabled, and accessibility tests for date, time, currency, account, category, and payment selectors in `src/design-system/components/forms/PickerField.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T043 [P] [US2] Add failing switch, checkbox, radio-card, selected, disabled, and 44-by-44 tests in `src/design-system/components/forms/SelectionControls.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T044 [P] [US2] Add failing selection, duplicate prevention, deletion, disabled-default, and wrapping tests in `src/design-system/components/forms/ChipControls.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T045 [P] [US2] Add failing loading, success, error, empty, offline, sync, permission, review, and recovery-action tests in `src/design-system/components/feedback/StateFeedback.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T046 [P] [US2] Add failing toast, snackbar, undo timeout, action, and accessible announcement tests in `src/design-system/components/feedback/TransientFeedback.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 2

- [X] T047 [US2] Implement the typed text, phone, OTP, search, and amount variants with visible labels and preserved controlled values in `src/design-system/components/forms/FormField.tsx`; verify `FormField.test.tsx` passes.
- [X] T048 [US2] Implement date, time, currency, account, category, and payment trigger variants in `src/design-system/components/forms/PickerField.tsx`; verify `PickerField.test.tsx` passes.
- [X] T049 [US2] Implement accessible switch row, checkbox, and radio-card variants in `src/design-system/components/forms/SelectionControls.tsx`; verify `SelectionControls.test.tsx` passes.
- [X] T050 [US2] Implement chip selector and keyword chip editor with duplicate guards and wrapping in `src/design-system/components/forms/ChipControls.tsx`; verify `ChipControls.test.tsx` passes.
- [X] T051 [US2] Implement success, error, empty, offline, sync, permission, and review variants with optional recovery in `src/design-system/components/feedback/StateView.tsx` and `src/design-system/components/feedback/StatusBanner.tsx`; verify `StateFeedback.test.tsx` passes.
- [X] T052 [P] [US2] Implement notification count and sync-state badges using the shared status contract in `src/design-system/components/feedback/NotificationBadge.tsx`; verify badge cases in `StateFeedback.test.tsx` pass.
- [X] T053 [US2] Implement toast, snackbar, and undo snackbar variants with accessible announcements in `src/design-system/components/feedback/TransientFeedback.tsx`; verify `TransientFeedback.test.tsx` passes.
- [X] T054 [P] [US2] Add failing fixed-dimension, final-layout, and accessibility-hidden tests in `src/design-system/components/feedback/Skeleton.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T055 [US2] Implement layout-stable skeleton block and card variants in `src/design-system/components/feedback/Skeleton.tsx`; verify `Skeleton.test.tsx` passes.
- [X] T056 [P] [US2] Add failing single-submission, error recovery, and value-preservation tests in `src/design-system/usePendingAction.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T057 [US2] Implement the minimal pending-action guard in `src/design-system/usePendingAction.ts`; verify `usePendingAction.test.ts` passes for rapid repeated calls and failure recovery.
- [X] T058 [P] [US2] Add failing focus, dismiss, keyboard avoidance, safe-area, destructive separation, and accessible-dialog tests in `src/design-system/components/overlays/Overlays.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T059 [US2] Implement low-risk bottom and full-screen sheet variants with keyboard avoidance in `src/design-system/components/overlays/AppSheet.tsx`; verify sheet cases in `Overlays.test.tsx` pass.
- [X] T060 [US2] Implement explicit standard and destructive confirmation variants in `src/design-system/components/overlays/ConfirmationDialog.tsx`; verify dialog cases in `Overlays.test.tsx` pass.
- [X] T061 [US2] Implement account/category/filter/date-range picker and voice-recording overlay compositions in `src/design-system/components/overlays/PickerOverlays.tsx`; verify picker and voice cases in `Overlays.test.tsx` pass.
- [X] T062 [US2] Add interaction-gallery integration tests for validation persistence, duplicate-submit blocking, undo, keyboard reachability, and destructive confirmation in `src/features/design-system/gallery/InteractionGallery.test.tsx`; verify the test fails before the gallery section exists.
- [X] T063 [US2] Implement the localized interaction gallery section in `src/features/design-system/gallery/InteractionGallery.tsx`; verify `InteractionGallery.test.tsx` passes and every fixture has one clear primary action.
- [X] T064 [US2] Run `npx jest --runInBand src/design-system/components/forms src/design-system/components/feedback src/design-system/components/overlays src/design-system/usePendingAction.test.ts src/features/design-system/gallery/InteractionGallery.test.tsx`; verify all US2 suites pass.

**Checkpoint**: User Story 2 works independently after the foundational phase.

---

## Phase 5: User Story 3 - Arabic, English, and Assistive Parity (Priority: P1)

**Goal**: Preserve complete content, navigation, focus, large-text, and screen-reader behavior
in Arabic RTL and English LTR.

**Independent Test**: Run the same navigation and content fixtures in both languages with
200% text, reduced motion, and a screen reader; no amount, state, or action becomes unavailable.

### Tests for User Story 3

- [X] T065 [P] [US3] Add failing Arabic/English font, explicit LTR/auto mixed-value, wrapping, tabular-number, and 200% scaling tests in `src/components/StyledText.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T066 [P] [US3] Add failing app-bar, back, overflow, context-menu, accessible name, and directional-mirroring tests in `src/design-system/components/navigation/AppNavigation.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T067 [P] [US3] Add failing five-item limit, selected state, central action, RTL order, and 44-by-44 tests in `src/design-system/components/navigation/BottomTabBar.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T068 [P] [US3] Add failing step, segmented selection, sticky heading, long-label, and screen-reader-order tests in `src/design-system/components/navigation/NavigationControls.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 3

- [X] T069 [US3] Update `src/components/StyledText.tsx` to use approved font variants, tabular numbers, explicit mixed-value direction, wrapping, and unrestricted scaling for critical text; verify `StyledText.test.tsx` passes.
- [X] T070 [US3] Implement app bar, back action, overflow action, and context menu using the icon wrapper in `src/design-system/components/navigation/AppNavigation.tsx`; verify `AppNavigation.test.tsx` passes in RTL and LTR.
- [X] T071 [US3] Implement the maximum-five-item bottom tab bar and optional emphasized center action in `src/design-system/components/navigation/BottomTabBar.tsx`; verify `BottomTabBar.test.tsx` passes.
- [X] T072 [US3] Implement step indicator, segmented control, and sticky section header variants in `src/design-system/components/navigation/NavigationControls.tsx`; verify `NavigationControls.test.tsx` passes with long Arabic labels.
- [X] T073 [US3] Add a public-component accessibility contract suite for names, roles, states, non-color cues, and minimum targets in `src/design-system/component-accessibility.test.tsx`; verify it fails for any non-compliant public export.
- [X] T074 [US3] Correct accessibility metadata and target sizing exposed by `src/design-system/index.ts`; verify `src/design-system/component-accessibility.test.tsx` passes without excluding a required component.
- [X] T075 [US3] Add locale, mixed-direction, long Arabic, large-text, reduced-motion, and navigation-order gallery tests in `src/features/design-system/gallery/AccessibilityGallery.test.tsx`; verify the test fails before the section exists.
- [X] T076 [US3] Implement the localized accessibility and bidirectional gallery section in `src/features/design-system/gallery/AccessibilityGallery.tsx`; verify `AccessibilityGallery.test.tsx` passes for Arabic and English fixtures.
- [X] T077 [US3] Run `npx jest --runInBand src/components/StyledText.test.tsx src/design-system/components/navigation src/design-system/component-accessibility.test.tsx src/features/design-system/gallery/AccessibilityGallery.test.tsx`; verify all US3 suites pass.

**Checkpoint**: User Story 3 is independently testable in both language directions.

---

## Phase 6: User Story 4 - Read Charts and Comparisons Without Guesswork (Priority: P2)

**Goal**: Provide constrained donut and line charts whose question, values, conclusion, and
drill-down remain available without color or tooltips.

**Independent Test**: Render empty, insufficient, normal, and dense fixtures; donuts show at
most five categories, lines show at most four series, and every chart has a readable summary.

### Tests for User Story 4

- [X] T078 [P] [US4] Add failing Other-grouping, stable ordering, donut-five, line-four, empty, and insufficient-data tests in `src/design-system/charts/chart-data.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T079 [P] [US4] Add failing question, summary, accessible description, optional drill-down, and no-tooltip-dependency tests in `src/design-system/charts/AccessibleChartFrame.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T080 [P] [US4] Add failing segment labels, grouped category, non-color cue, and theme tests in `src/design-system/charts/DonutChart.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T081 [P] [US4] Add failing four-series, line-style, marker, label, and RTL-summary tests in `src/design-system/charts/LineChart.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 4

- [X] T082 [US4] Implement deterministic donut grouping and line-series limiting helpers in `src/design-system/charts/chart-data.ts`; verify `chart-data.test.ts` passes without mutating caller data.
- [X] T083 [US4] Implement the question, text summary, empty/insufficient state, and drill-down wrapper in `src/design-system/charts/AccessibleChartFrame.tsx`; verify `AccessibleChartFrame.test.tsx` passes.
- [X] T084 [US4] Implement the static accessible SVG donut presentation in `src/design-system/charts/DonutChart.tsx`; verify `DonutChart.test.tsx` passes with five visible categories maximum.
- [X] T085 [US4] Implement the static accessible SVG line presentation with line-style or marker distinctions in `src/design-system/charts/LineChart.tsx`; verify `LineChart.test.tsx` passes with four series maximum.
- [X] T086 [US4] Add chart gallery tests for empty, insufficient, dense, grayscale-label, screen-reader-summary, and drill-down fixtures in `src/features/design-system/gallery/ChartGallery.test.tsx`; verify the test fails before the section exists.
- [X] T087 [US4] Implement the localized chart gallery section in `src/features/design-system/gallery/ChartGallery.tsx`; verify `ChartGallery.test.tsx` passes and contains no essential tooltip-only content.
- [X] T088 [US4] Export chart helpers and components from `src/design-system/index.ts`; verify imports work only through the public boundary with `npx jest --runInBand src/design-system/charts src/features/design-system/gallery/ChartGallery.test.tsx`.

**Checkpoint**: User Story 4 is independently demonstrable with accessible chart summaries.

---

## Phase 7: User Story 5 - Keep Sensitive Financial Information Private (Priority: P2)

**Goal**: Mask protected values by default, reveal them only in the authorized foreground
session, and reset them on app lock or background without exposing values externally.

**Independent Test**: Reveal representative values, background or lock the app, and verify all
in-app and external fixtures return to a layout-stable masked state with safe screen-reader text.

### Tests for User Story 5

- [X] T089 [P] [US5] Add failing masked, authorized, revealed, background-reset, lock-reset, and prohibited-surface transition tests in `src/design-system/privacy.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T090 [P] [US5] Add failing first-use hidden-balance default, persisted hide choice, and backward-compatible stored-preference tests in `src/storage/secure-preferences.test.ts`; verify the targeted Jest run fails before preference changes.
- [X] T091 [P] [US5] Add failing layout stability, hidden accessible label, reveal action, and remask behavior tests in `src/design-system/components/SensitiveValue.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 5

- [X] T092 [US5] Implement the typed sensitive-presentation state and pure transition helper in `src/design-system/privacy.ts`; verify `src/design-system/privacy.test.ts` passes for all allowed and prohibited surfaces.
- [X] T093 [US5] Change first-use sensitive values to masked while preserving stored user choices in `src/domain/foundation.ts` and `src/storage/secure-preferences.ts`; verify `src/storage/secure-preferences.test.ts` passes without losing existing preference fields.
- [X] T094 [US5] Implement the layout-stable masked/revealed value wrapper with safe accessible text in `src/design-system/components/SensitiveValue.tsx`; verify `SensitiveValue.test.tsx` passes.
- [X] T095 [P] [US5] Add failing active-to-inactive/background reset and provider cleanup tests in `src/state/SensitiveVisibilityProvider.test.tsx`; verify the targeted Jest run fails before provider creation.
- [X] T096 [US5] Implement transient reveal ownership and React Native AppState reset in `src/state/SensitiveVisibilityProvider.tsx`, then mount it in `src/state/FoundationProviders.tsx`; verify `SensitiveVisibilityProvider.test.tsx` passes.
- [X] T097 [P] [US5] Add external-surface policy tests that never return raw values for lock screen, app switcher, errors, titles, or analytics in `src/design-system/external-sensitive-display.test.ts`; verify the targeted Jest run fails before helper creation.
- [X] T098 [US5] Implement the external sensitive-display helper in `src/design-system/external-sensitive-display.ts`; verify `external-sensitive-display.test.ts` passes for every prohibited surface.
- [X] T099 [US5] Add privacy gallery tests for first-use masking, authorized reveal, background reset, lock reset, and masked screen-reader output in `src/features/design-system/gallery/PrivacyGallery.test.tsx`; verify the test fails before the section exists.
- [X] T100 [US5] Implement the localized privacy gallery section in `src/features/design-system/gallery/PrivacyGallery.tsx`; verify `PrivacyGallery.test.tsx` passes without exposing literal test values in masked output.
- [X] T101 [US5] Export privacy state, provider hooks, external-display helper, and `SensitiveValue` from `src/design-system/index.ts`; verify with `npx jest --runInBand src/design-system/privacy.test.ts src/design-system/external-sensitive-display.test.ts src/design-system/components/SensitiveValue.test.tsx src/state/SensitiveVisibilityProvider.test.tsx src/features/design-system/gallery/PrivacyGallery.test.tsx`.

**Checkpoint**: User Story 5 is independently testable in foreground and background transitions.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Compose the gallery, enforce boundaries, run the full automated suite, and record
native evidence without expanding product scope.

- [X] T102 Add failing shell tests for section navigation, light/dark switching, Arabic/English switching, scrolling, and gallery-only scope in `src/features/design-system/DesignSystemGallery.test.tsx`; verify the test fails before shell composition.
- [X] T103 Compose the five independent gallery sections in `src/features/design-system/DesignSystemGallery.tsx` and expose them from `app/design-system/index.tsx`; verify `DesignSystemGallery.test.tsx` passes.
- [X] T104 Add a localized design-system gallery link without changing existing foundation routes in `app/index.tsx`; verify `src/features/foundation/FoundationRoutes.test.tsx` and `DesignSystemGallery.test.tsx` both pass.
- [X] T105 Add an integration matrix for both themes, both locales, required component families, reduced motion, 200% text fixtures, and hidden balances in `src/features/design-system/DesignSystemIntegration.test.tsx`; verify the targeted Jest run passes without snapshots as the only assertion.
- [X] T106 Run `npm run check:design-system` and update only `scripts/check-design-system-boundaries.mjs` for confirmed false positives; verify it reports zero raw feature colors, local token systems, Admin imports, and hard-coded gallery strings.
- [X] T107 Run `npm test -- --runInBand`; fix only SPEC-002 regressions in `src/design-system/`, `src/features/design-system/`, or directly affected shared primitives until Jest reports zero failing suites.
- [X] T108 Run `npm run typecheck`, `npm run lint`, and `npm run check:foundation`; fix only SPEC-002 regressions in the reported files until all three commands exit 0.
- [X] T109 Validate `app/design-system/index.tsx` on an Android development build in Arabic/English, light/dark, TalkBack, reduced motion, keyboard-open overlays, chart summaries, and background privacy; record device/API and PASS/FAIL evidence in `specs/002-mobile-design-system/quickstart.md`.
- [X] T110 Validate the Android gallery at 320 by 568 logical pixels and `font_scale=2.0`, then restore emulator size, density, and font defaults; record clipping, scroll, target-size, and restoration evidence in `specs/002-mobile-design-system/quickstart.md`.
- [X] T111 Validate `app/design-system/index.tsx` on an iOS simulator or device in Arabic/English, light/dark, VoiceOver, 200% text, keyboard-open overlays, reduced motion, and app-switcher privacy; record PASS/FAIL or an explicit macOS hardware blocker in `specs/002-mobile-design-system/quickstart.md`.
- [X] T112 Perform grayscale and contrast review for all financial, status, chart, focus, disabled, and text pairs in `src/features/design-system/DesignSystemGallery.tsx`; record measured 4.5:1 normal-text and 3:1 large-text outcomes in `specs/002-mobile-design-system/quickstart.md`.
- [X] T113 Audit `app/` and `src/` for Admin Dashboard layouts, production feature journeys, provider calls, camera/receipt flows, investments, unsupported platform claims, and a second token source; record the exact `rg` commands and zero-scope-violation result in `specs/002-mobile-design-system/quickstart.md`.
- [X] T114 Update the final validation record in `specs/002-mobile-design-system/quickstart.md` with all automated command totals, native evidence, known blockers, and the date; verify every quickstart scenario has an explicit PASS, FAIL, or BLOCKED outcome and no unchecked claim.

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no feature dependencies.
- Phase 2 depends on Phase 1 and blocks every user story.
- User Stories 1 through 5 depend on Phase 2.
- User Stories 1 through 5 use separate implementation and gallery-section files and can be
  developed in parallel after Phase 2; merge shared `src/design-system/index.ts` exports in task order.
- Phase 8 depends on all selected user stories because it composes the final gallery and runs
  the complete matrix.

### User Story Dependency Graph

```text
Setup -> Foundations -> US1 (P1) --+
                     -> US2 (P1) --+
                     -> US3 (P1) --+-> Polish and native validation
                     -> US4 (P2) --+
                     -> US5 (P2) --+
```

### Within Each User Story

- Add the named failing tests before implementation.
- Implement only enough behavior to satisfy those tests and the story contract.
- Build the story-specific gallery section after component tests pass.
- Run the story's targeted verification command before moving to another phase.

## Parallel Execution Examples

### Foundations

- T017 and T018 can run together because Arabic and English catalogs are separate files.
- T013-T016 can split into motion and icon pairs after token/theme work is stable.

### User Story 1

- T024-T027 can run together because each creates a separate focused test file.
- T029 and T030 can run together after the shared financial primitives pass.
- T033 and T034 can run together because they target separate card groups.

### User Story 2

- T041-T046 can run together because each test file targets a separate component group.
- T047-T050 can run together after their matching tests exist.
- T054, T056, and T058 can run together because skeleton, pending-action, and overlay files do not overlap.

### User Story 3

- T065-T068 can run together because text and each navigation group use separate files.
- T070-T072 can run together after the icon and primitive contracts are stable.

### User Story 4

- T078-T081 can run together because data, frame, donut, and line tests are separate.
- T083-T085 can run together after `chart-data.ts` is complete.

### User Story 5

- T089-T091 can run together because state, storage, and component tests are separate.
- T095 and T097 can run together after `privacy.ts` is stable.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 through T040.
3. Demonstrate consistent financial meaning and hierarchy independently.
4. Continue only after the US1 targeted suite passes.

### Incremental Delivery

1. Add US2 for safe forms, feedback, undo, and overlays.
2. Add US3 for complete RTL/LTR and accessibility parity.
3. Add US4 for constrained accessible charts.
4. Add US5 for sensitive-value lifecycle and external-surface privacy.
5. Compose and validate the final gallery in Phase 8.

### Completion Standard

No task is complete when only code exists. Mark a task complete only after its named file is
updated and its inline verification produces the expected result. Native validation tasks may
be marked BLOCKED in the quickstart only when the required platform hardware is unavailable;
they must not be marked PASS from a web or opposite-platform substitute.
