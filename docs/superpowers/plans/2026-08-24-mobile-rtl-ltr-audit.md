# Masarifi Mobile RTL/LTR Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify every Masarifi Mobile route and deterministic UI state in Arabic RTL and English LTR, then land only evidence-backed direction, bidi, wrapping, overflow, and responsive fixes.

**Architecture:** Audit from shared primitives outward so a single root-cause correction covers all callers. Each production correction follows red-green-refactor in its nearest existing test file; clean routes are recorded as verified without edits. Automated route/state coverage precedes Android device traversal.

**Tech Stack:** Expo Router 55, React Native 0.83, React 19, TypeScript 5.9, Jest 29, React Native Testing Library 13, Zustand, React Native SVG.

**Spec:** `docs/superpowers/specs/2026-08-24-mobile-rtl-ltr-audit-design.md`

## Global Constraints

- Work only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation` on `codex/r01-shared-ui-foundation`.
- Preserve every pre-existing tracked and untracked remediation change.
- Do not redesign the approved UI or change feature behavior, calculations, persistence, or navigation semantics.
- Add no dependency, direction framework, bulk codemod, or speculative abstraction.
- Arabic uses RTL and English uses LTR; financial values, phone numbers, OTPs, account/card fragments, references, and technical identifiers remain coherent LTR runs.
- Mirror only semantically directional icons. Never reverse chart data to imitate RTL.
- Every non-trivial production fix requires a failing regression test first.
- Do not make implementation commits from the dirty remediation worktree unless the user separately requests them; verification must distinguish the audit diff from pre-existing changes.

## File Map

- Create `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md`: durable route/state coverage ledger, confirmed findings, fixes, device evidence, and limitations.
- Modify adjacent `*.test.tsx` files only when a confirmed defect needs a regression test.
- Modify the nearest existing component or screen only after that test fails for the expected direction/layout reason.
- Reuse `apps/mobile/src/test-utils/render.tsx`, `apps/mobile/src/state/preferences.ts`, `apps/mobile/src/state/FoundationProviders.tsx`, `apps/mobile/src/components/StyledText.tsx`, and `apps/mobile/src/design-system/icons.tsx`; do not create replacements.

---

### Task 1: Freeze the Baseline and Create the Audit Ledger

**Files:**
- Create: `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md`
- Inspect: `apps/mobile/package.json`
- Inspect: `apps/mobile/src/test-utils/render.tsx`
- Inspect: `apps/mobile/src/state/FoundationProviders.tsx`

**Interfaces:**
- Consumes: approved specification and current dirty-worktree status.
- Produces: a coverage ledger used by Tasks 2-10; no production interface.

- [ ] **Step 1: Reconfirm scope and capture the pre-audit diff boundary**

Run:

```powershell
git branch --show-current
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```

Expected: branch is `codex/r01-shared-ui-foundation`; existing remediation changes remain present.

- [ ] **Step 2: Count the auditable surfaces**

Run:

```powershell
$routes = rg --files app -g '*.tsx'
$components = rg --files src -g '*.tsx'
$tests = rg --files src -g '*.test.ts' -g '*.test.tsx'
"routes=$($routes.Count) components=$($components.Count) tests=$($tests.Count)"
```

Run from `apps/mobile`. Expected baseline: 118 route TSX files; record the live component and test counts rather than assuming stale documentation.

- [ ] **Step 3: Run the existing direction-sensitive baseline**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/components/StyledText.test.tsx src/design-system/icons.test.tsx src/features/shell/ShellDirection.test.tsx src/design-system/components/overlays/RouteModalContainer.test.tsx
```

Expected: PASS. Any baseline failure is recorded before audit edits and resolved only if it is direction-related.

- [ ] **Step 4: Create the ledger with the exact initial status**

Create `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md` with these sections and initial values:

```markdown
# Masarifi Mobile RTL/LTR Audit — 2026-08-24

## Scope

- Branch: `codex/r01-shared-ui-foundation`
- Routes: 118 TSX route files
- Locales: Arabic RTL and English LTR
- States: loading, empty, populated, error, disabled, permission, validation, confirmation, modal, picker, and keyboard states where applicable
- Responsive checks: narrow phone, normal phone, wide layout, normal font scale, and 200% font scale

## Coverage

| Area | Static review | Paired automated checks | Android RTL | Android LTR | Result |
| --- | --- | --- | --- | --- | --- |
| Foundation and design system | Not run | Not run | Not run | Not run | Not run |
| Shell, public auth, onboarding | Not run | Not run | Not run | Not run | Not run |
| Home, accounts, categories, transactions | Not run | Not run | Not run | Not run | Not run |
| Reports and financial planning | Not run | Not run | Not run | Not run | Not run |
| Tracking, assistant, notifications | Not run | Not run | Not run | Not run | Not run |
| Settings, security, support, subscriptions | Not run | Not run | Not run | Not run | Not run |

## Confirmed Findings

No findings recorded before execution.

## Verification

Not run.

## Environment Limits

- iOS device validation is unavailable in the current environment; platform-aware React Native tests provide iOS-specific coverage.
```

- [ ] **Step 5: Verify documentation-only change**

Run:

```powershell
git diff --check -- apps/mobile/docs/rtl-ltr-audit-2026-08-24.md
```

Expected: no whitespace errors.

---

### Task 2: Audit Locale Propagation, Bidi Primitives, Icons, Controls, Overlays, and Charts

**Files:**
- Inspect: `apps/mobile/src/state/FoundationProviders.tsx`
- Inspect: `apps/mobile/src/state/preferences.ts`
- Inspect: `apps/mobile/src/localization/i18n.ts`
- Inspect: `apps/mobile/src/components/StyledText.tsx`
- Inspect: `apps/mobile/src/design-system/icons.tsx`
- Inspect: `apps/mobile/src/design-system/components/forms/SelectionControls.tsx`
- Inspect: `apps/mobile/src/design-system/components/forms/ChipControls.tsx`
- Inspect: `apps/mobile/src/design-system/components/selection/SelectionScreen.tsx`
- Inspect: `apps/mobile/src/design-system/components/selection/SelectionList.tsx`
- Inspect: `apps/mobile/src/design-system/components/selection/SelectionGrid.tsx`
- Inspect: `apps/mobile/src/design-system/components/overlays/AppSheet.tsx`
- Inspect: `apps/mobile/src/design-system/components/overlays/RouteModalContainer.tsx`
- Inspect: `apps/mobile/src/design-system/components/navigation/GroupedList.tsx`
- Inspect: `apps/mobile/src/design-system/components/financial/FinancialPrimitives.tsx`
- Inspect: `apps/mobile/src/design-system/components/financial/TransactionRow.tsx`
- Inspect: `apps/mobile/src/design-system/charts/AccessibleChartFrame.tsx`
- Inspect: `apps/mobile/src/design-system/charts/DonutChart.tsx`
- Inspect: `apps/mobile/src/design-system/charts/LineChart.tsx`
- Test: adjacent existing test files in the same directories.

**Interfaces:**
- Consumes: locale and direction from `usePreferenceStore`; existing `direction` props and icon map.
- Produces: verified shared behavior inherited by all feature tasks.

- [ ] **Step 1: Run static discovery without treating matches as defects**

Run:

```powershell
rg -n --glob '*.tsx' "row-reverse|writingDirection|textAlign|direction|marginLeft|marginRight|paddingLeft|paddingRight|left:|right:|numberOfLines|ellipsizeMode" src/components src/design-system src/state
```

For every match, classify it as logical layout, intentionally physical geometry, LTR data run, decorative geometry, or confirmed violation. Record only confirmed violations in the ledger.

- [ ] **Step 2: Verify locale switching and semantic icon mirroring**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/state/FoundationProviders.test.tsx src/components/StyledText.test.tsx src/design-system/icons.test.tsx src/design-system/components/navigation/GroupedList.test.tsx
```

Expected: root direction updates for Arabic and English; back/forward icons mirror; non-directional icons remain unchanged; ordinary text uses automatic bidi; amounts remain LTR.

- [ ] **Step 3: Verify shared controls and overlays in both directions**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/design-system/components/forms/SelectionControls.test.tsx src/design-system/components/forms/ChipControls.test.tsx src/design-system/components/selection/SelectionScreen.test.tsx src/design-system/components/overlays/Overlays.test.tsx src/design-system/components/overlays/RouteModalContainer.test.tsx
```

Expected: labels and trailing controls occupy logical start/end positions; switches remain physically stable; close buttons use the correct edge; long labels wrap.

- [ ] **Step 4: Verify chart order and surrounding RTL presentation**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/design-system/charts/AccessibleChartFrame.test.tsx src/design-system/charts/DonutChart.test.tsx src/design-system/charts/LineChart.test.tsx src/design-system/charts/ReportsCharts.test.tsx
```

Expected: identical domain data order in Arabic and English; localized summaries and legends align correctly; no chart label is clipped by direction changes.

- [ ] **Step 5: Apply TDD to any shared defect**

For each confirmed defect, add one paired `it.each` case to its existing adjacent test. The test must assert visible/accessibility behavior or final composed style, be run alone to show the expected failure, then receive the smallest production correction.

Run the failing test by exact path:

For example, a selection-surface correction is verified with:

```powershell
npm test -- --runInBand --runTestsByPath src/design-system/components/selection/SelectionScreen.test.tsx
```

Expected before the production edit: FAIL on the asserted RTL/LTR contract. Expected after the minimal edit: PASS.

- [ ] **Step 6: Re-run all shared suites and update the ledger**

Use the commands from Steps 2-4. Record pass/fix evidence under “Foundation and design system.”

---

### Task 3: Fix and Verify Public Auth, OTP, Onboarding, and Shell Navigation

**Files:**
- Modify: `apps/mobile/src/features/auth/OtpVerificationForm.test.tsx`
- Modify: `apps/mobile/src/features/auth/OtpVerificationForm.tsx`
- Modify: `apps/mobile/src/design-system/components/navigation/NavigationControls.test.tsx`
- Modify: `apps/mobile/src/design-system/components/navigation/NavigationControls.tsx`
- Inspect: `apps/mobile/app/(public)/**/*.tsx`
- Inspect: `apps/mobile/app/(onboarding)/**/*.tsx`
- Inspect: `apps/mobile/app/(tabs)/**/*.tsx`
- Inspect: `apps/mobile/src/features/auth/**/*.tsx`
- Inspect: `apps/mobile/src/features/onboarding/**/*.tsx`
- Inspect: `apps/mobile/src/features/shell/**/*.tsx`

**Interfaces:**
- Consumes: shared direction root, `DesignIcon`, `StyledText`, Expo Router shell.
- Produces: stable LTR OTP entry and step fractions plus verified RTL/LTR route order.

- [ ] **Step 1: Write the failing OTP direction and narrow-width tests**

Add to `OtpVerificationForm.test.tsx`:

```tsx
import { changeLocale, translate } from '@/localization/i18n';

it.each(['ar', 'en'] as const)('keeps OTP slots in an LTR numeric run in %s', (locale) => {
  changeLocale(locale);
  const screen = renderWithProviders(
    <OtpVerificationForm
      resendAvailable
      onResend={jest.fn()}
      onSubmit={jest.fn()}
    />
  );

  expect(screen.getByTestId('otp-slots')).toHaveStyle({
    direction: 'ltr',
    width: '100%'
  });
  expect(
    screen.getAllByLabelText(
      new RegExp(translate('appShell.auth.otp.code'))
    )
  ).toHaveLength(6);
});
```

- [ ] **Step 2: Run the OTP test and verify RED**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/features/auth/OtpVerificationForm.test.tsx
```

Expected: FAIL because the slots container has no `testID`, explicit LTR direction, or bounded width.

- [ ] **Step 3: Implement the minimal OTP layout correction**

In `OtpVerificationForm.tsx`, add `testID="otp-slots"` to the slots `View`; set `direction: 'ltr'`, `width: '100%'`, `justifyContent: 'space-between'`, and reduce `gap` from `8` to `4`. Keep every slot at the existing 44-point minimum.

- [ ] **Step 4: Run the OTP test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write the failing step-fraction bidi test**

Add to `NavigationControls.test.tsx`:

```tsx
import { changeLocale } from '@/localization/i18n';

it.each(['ar', 'en'] as const)('keeps progress fractions LTR in %s', (locale) => {
  changeLocale(locale);
  const screen = renderWithProviders(
    <StepIndicator current={2} total={4} label="Setup" />
  );

  expect(screen.getByText('2/4')).toHaveStyle({ writingDirection: 'ltr' });
});
```

- [ ] **Step 6: Verify RED, implement, and verify GREEN**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/design-system/components/navigation/NavigationControls.test.tsx
```

Expected RED: the fraction lacks explicit LTR writing direction. Add `writingDirection: 'ltr'` to `StepIndicator`’s visible `Text`, then rerun for PASS.

- [ ] **Step 7: Audit all public, onboarding, and shell routes**

Run:

```powershell
rg -n --glob '*.tsx' "row-reverse|textAlign|writingDirection|numberOfLines|ellipsizeMode|left:|right:" "app/(public)" "app/(onboarding)" "app/(tabs)" src/features/auth src/features/onboarding src/features/shell
npm test -- --runInBand --runTestsByPath src/features/auth/AuthRoutes.test.tsx src/features/auth/AuthenticationJourney.test.tsx src/features/onboarding/PlatformOnboardingRoutes.test.tsx src/features/shell/ShellDirection.test.tsx src/features/shell/NavigationJourney.test.tsx src/features/shell/AppTabs.test.tsx
```

Verify route registration, back affordances, tab order, phone/email LTR runs, error/loading states, long labels, and 200% text behavior. Apply the Task 2 evidence gate to any additional defect.

- [ ] **Step 8: Update the ledger**

Record the exact suites, OTP/step corrections, and shell/auth/onboarding result.

---

### Task 4: Audit Home, Accounts, Categories, Transactions, Filters, and Voice Entry

**Files:**
- Inspect: `apps/mobile/app/accounts/**/*.tsx`
- Inspect: `apps/mobile/app/categories/**/*.tsx`
- Inspect: `apps/mobile/app/transactions/**/*.tsx`
- Inspect: `apps/mobile/src/features/home/**/*.tsx`
- Inspect: `apps/mobile/src/features/accounts/**/*.tsx`
- Inspect: `apps/mobile/src/features/categories/**/*.tsx`
- Inspect: `apps/mobile/src/features/transactions/**/*.tsx`
- Inspect: `apps/mobile/src/features/filters/**/*.tsx`
- Inspect: `apps/mobile/src/features/voice/**/*.tsx`
- Test: existing adjacent feature and journey tests.

**Interfaces:**
- Consumes: verified shared financial, selection, overlay, and navigation primitives.
- Produces: verified core-finance customer journeys in both directions.

- [ ] **Step 1: Review every physical edge, fixed row, truncation, and mixed-value run**

Run:

```powershell
rg -n --glob '*.tsx' "row-reverse|flexDirection: 'row'|numberOfLines|ellipsizeMode|writingDirection|textAlign|left:|right:|width:|minWidth|maxWidth" src/features/home src/features/accounts src/features/categories src/features/transactions src/features/filters src/features/voice app/accounts app/categories app/transactions
```

Check account and transaction identities, amounts, currency codes, dates, filter chips, category pickers, clear/remove controls, conflict states, voice review, keyboard layouts, and narrow/large-text stacking. Decorative absolute positions remain unchanged unless they obscure content.

- [ ] **Step 2: Run paired component and journey coverage**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/features/home/HomeScreen.test.tsx src/features/accounts/AccountRow.test.tsx src/features/accounts/AccountScopeSheet.test.tsx src/features/accounts/AccountJourney.test.tsx src/features/categories/CategorySelectionScreen.test.tsx src/features/transactions/TransactionForm.test.tsx src/features/transactions/TransactionListScreen.test.tsx src/features/transactions/TransactionsRoute.test.tsx src/features/filters/DateRangeSheet.test.tsx src/features/voice/VoiceReviewGroup.test.tsx
```

Expected: Arabic and English retain logical start/end placement, financial/date runs remain coherent, and long labels do not overlap actions.

- [ ] **Step 3: Reproduce and repair confirmed defects test-first**

Add the smallest paired failing assertion to the nearest existing test; run it alone; correct the shared caller when all affected screens share semantics, otherwise correct only the screen; rerun the focused suite.

- [ ] **Step 4: Run the full core-finance feature slice**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(home|accounts|categories|transactions|filters|voice)"
```

Expected: PASS. Update the ledger with inspected areas, findings, and focused regression commands.

---

### Task 5: Audit Reports, Charts, Budgets, Obligations, Savings, and Salary

**Files:**
- Inspect: `apps/mobile/app/reports/**/*.tsx`
- Inspect: `apps/mobile/app/budgets/**/*.tsx`
- Inspect: `apps/mobile/app/obligations/**/*.tsx`
- Inspect: `apps/mobile/app/savings/**/*.tsx`
- Inspect: `apps/mobile/app/salary/**/*.tsx`
- Inspect: `apps/mobile/src/features/reports/**/*.tsx`
- Inspect: `apps/mobile/src/features/budgets/**/*.tsx`
- Inspect: `apps/mobile/src/features/obligations/**/*.tsx`
- Inspect: `apps/mobile/src/features/savings/**/*.tsx`
- Inspect: `apps/mobile/src/features/salary/**/*.tsx`
- Test: existing report, chart, budget, obligation, savings, and salary tests.

**Interfaces:**
- Consumes: chart order and financial-value contracts from Task 2.
- Produces: direction-safe reporting and planning journeys without calculation changes.

- [ ] **Step 1: Review report and planning presentation**

Run:

```powershell
rg -n --glob '*.tsx' "reverse\(|row-reverse|flexDirection: 'row'|numberOfLines|ellipsizeMode|writingDirection|textAlign|left:|right:|width:|minWidth|maxWidth" src/features/reports src/features/budgets src/features/obligations src/features/savings src/features/salary app/reports app/budgets app/obligations app/savings app/salary
```

Confirm chart arrays stay chronological, legends and drill-down affordances use logical edges, metrics keep signs/currencies LTR, forms survive keyboard and large text, and cards wrap without hiding actions.

- [ ] **Step 2: Run paired report and planning suites**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/features/reports/ReportsJourney.test.tsx src/features/reports/ReportsStates.test.tsx src/features/reports/ReportsAccessibility.test.tsx src/features/reports/ReportDrillDownJourney.test.tsx src/features/reports/ReportPreviewJourney.test.tsx src/features/reports/ReportScheduleJourney.test.tsx src/features/budgets/BudgetJourney.test.tsx src/features/obligations/ObligationJourney.test.tsx src/features/obligations/PaymentJourney.test.tsx src/features/savings/SavingsJourney.test.tsx src/features/salary/SalaryJourney.test.tsx
```

Expected: PASS or an evidence-backed direction failure.

- [ ] **Step 3: Reproduce and repair confirmed defects test-first**

Follow Task 2’s focused RED/GREEN gate. Do not change report ordering or planning domain calculations to fix presentation.

- [ ] **Step 4: Run the complete slice and update the ledger**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(reports|budgets|obligations|savings|salary|charts)"
```

Expected: PASS.

---

### Task 6: Audit Tracking, Assistant, and Notifications

**Files:**
- Inspect: `apps/mobile/app/tracking/**/*.tsx`
- Inspect: `apps/mobile/app/assistant/**/*.tsx`
- Inspect: `apps/mobile/app/notifications/**/*.tsx`
- Inspect: `apps/mobile/src/features/tracking/**/*.tsx`
- Inspect: `apps/mobile/src/features/assistant/**/*.tsx`
- Inspect: `apps/mobile/src/features/notifications/**/*.tsx`
- Test: existing tracking, assistant, and notification tests.

**Interfaces:**
- Consumes: mixed-direction text, chip, overlay, card, and navigation contracts.
- Produces: verified conversational, automatic-tracking, review, duplicate, and notification states.

- [ ] **Step 1: Review all layouts and bidi-sensitive content**

Run:

```powershell
rg -n --glob '*.tsx' "row-reverse|flexDirection: 'row'|numberOfLines|ellipsizeMode|writingDirection|textAlign|left:|right:|width:|minWidth|maxWidth" src/features/tracking src/features/assistant src/features/notifications app/tracking app/assistant app/notifications
```

Check Arabic and English keywords, sender names, SMS fragments, assistant user/bot bubbles, thinking/loading states, action previews, chips, dates, amounts, badges, and trailing actions.

- [ ] **Step 2: Run paired feature and journey suites**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(tracking|assistant|notifications)"
```

Expected: PASS or a reproducible direction failure.

- [ ] **Step 3: Reproduce and repair confirmed defects test-first**

Follow Task 2’s focused RED/GREEN gate. Preserve message chronology and assistant conversation order in both locales.

- [ ] **Step 4: Update the ledger**

Record reviewed states and exact test evidence.

---

### Task 7: Audit Settings, Profile, Security, Support, and Subscriptions

**Files:**
- Inspect: `apps/mobile/app/settings/**/*.tsx`
- Inspect: `apps/mobile/app/security/**/*.tsx`
- Inspect: `apps/mobile/app/support/**/*.tsx`
- Inspect: `apps/mobile/app/subscriptions/**/*.tsx`
- Inspect: `apps/mobile/src/features/settings/**/*.tsx`
- Inspect: `apps/mobile/src/features/security/**/*.tsx`
- Inspect: `apps/mobile/src/features/support/**/*.tsx`
- Inspect: `apps/mobile/src/features/subscriptions/**/*.tsx`
- Test: existing settings, security, support, and subscription tests.

**Interfaces:**
- Consumes: shared menu rows, forms, switches, modals, and identifier bidi rules.
- Produces: verified account-management and help journeys.

- [ ] **Step 1: Review all layouts and sensitive values**

Run:

```powershell
rg -n --glob '*.tsx' "row-reverse|flexDirection: 'row'|numberOfLines|ellipsizeMode|writingDirection|textAlign|left:|right:|width:|minWidth|maxWidth" src/features/settings src/features/security src/features/support src/features/subscriptions app/settings app/security app/support app/subscriptions
```

Check profile phone/email values, currency rows, cycle-day pickers, PIN slots, session/device identifiers, security-event dates, support ticket IDs, multiline form fields, plan cards, and destructive confirmations.

- [ ] **Step 2: Run paired feature and journey suites**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(settings|security|support|subscription)"
```

Expected: PASS or a reproducible direction failure.

- [ ] **Step 3: Reproduce and repair confirmed defects test-first**

Follow Task 2’s focused RED/GREEN gate. Security and identifier values must remain exact; presentation fixes may not alter stored or submitted values.

- [ ] **Step 4: Update the ledger**

Record reviewed states and exact test evidence.

---

### Task 8: Prove Complete Route and Responsive-State Coverage

**Files:**
- Inspect: all `apps/mobile/app/**/*.tsx` route files.
- Inspect: all route tests matching `apps/mobile/src/features/**/*Routes.test.tsx` and `*Journey.test.tsx`.
- Modify: nearest route or journey test only for a confirmed uncovered direction state.
- Modify: `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md`.

**Interfaces:**
- Consumes: all preceding feature results.
- Produces: route-count reconciliation and explicit state/responsive evidence.

- [ ] **Step 1: Reconcile every route against a route or journey test**

Run:

```powershell
rg --files app -g '*.tsx' | Sort-Object
rg --files src/features -g '*Routes.test.tsx' -g '*Journey.test.tsx' | Sort-Object
```

Mark all 118 routes in the ledger by route group. Layout-only route wrappers may share their registered route test; screens with distinct content require their feature or journey assertion.

- [ ] **Step 2: Check deterministic state coverage**

Run:

```powershell
rg -n --glob '*.tsx' "loading|empty|error|offline|disabled|permission|confirm|Modal|Sheet|Picker|KeyboardAvoidingView" app src/features src/design-system
rg -n --glob '*.test.tsx' "loading|empty|error|offline|disabled|permission|confirm|modal|sheet|picker|fontScale|PixelRatio|width" src
```

For any reachable deterministic state with no relevant assertion, add a paired Arabic/English case to its existing journey test and run RED before any production correction.

- [ ] **Step 3: Run route registration and journey tests**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(Routes|Journey|ShellDirection|ProtectedNavigation)"
```

Expected: every route group registers and each customer journey passes.

- [ ] **Step 4: Run large-text and accessibility coverage**

Run:

```powershell
npm test -- --runInBand --testPathPattern="(Accessibility|accessibility|HomeScreen|TransactionForm|Selection|AccountRow|DateRangeSheet)"
```

Expected: narrow/stacked layouts, 200% text scenarios, accessibility order, and touch targets pass in both locales.

- [ ] **Step 5: Finalize automated coverage rows in the ledger**

Record each area as Pass, Fixed, or Environment-limited with exact commands. Do not use a general Pass when a route group lacks evidence.

---

### Task 9: Run Full Automated Verification

**Files:**
- Modify: `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md` with command results only.

**Interfaces:**
- Consumes: complete audit diff and focused regression suites.
- Produces: release-level automated verification evidence.

- [ ] **Step 1: Run typecheck and boundary checks**

Run from `apps/mobile`:

```powershell
npm run typecheck
npm run check:frontend-quality
```

Expected: both exit 0.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: exit 0. Record existing warnings separately from audit-introduced warnings.

- [ ] **Step 3: Run the complete Jest suite**

Run:

```powershell
npm test -- --runInBand
```

Expected: every suite and test passes; record exact suite/test totals.

- [ ] **Step 4: Check the complete patch**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and no file outside the designated worktree.

---

### Task 10: Validate Android RTL/LTR Journeys and Complete the Report

**Files:**
- Create or update evidence only under: `.device-smoke/`
- Modify: `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md`

**Interfaces:**
- Consumes: green automated verification and the installed Android development client.
- Produces: final device evidence and a complete audit report.

- [ ] **Step 1: Start the worktree Metro server and connect the device**

Run from `apps/mobile`:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
$env:CI='1'
npx expo start --dev-client --port 8081 --localhost --clear
```

Expected: the Samsung device is listed and Metro serves the worktree bundle. If DevTools installation reports `spawn EPERM`, record it only if Metro itself remains unavailable.

- [ ] **Step 2: Traverse Arabic RTL journeys**

Set Arabic in the application and inspect public/auth, onboarding, Home, account picker, transaction list/add/edit/filter/detail, categories, Reports/drill-down/schedule/preview, budgets, obligations, savings, salary, tracking, assistant, notifications, settings/profile/security, support, subscriptions, route sheets, modals, loading/empty/error examples, keyboard forms, and back/tab navigation.

Capture screenshots and UI hierarchy dumps under `.device-smoke/rtl/`. Confirm no clipping, overlap, incorrect edge placement, reversed numeric runs, mirrored non-directional icon, or reversed chart chronology.

- [ ] **Step 3: Traverse English LTR journeys**

Repeat Step 2 in English and store evidence under `.device-smoke/ltr/`. Confirm locale switching leaves no stale RTL layout.

- [ ] **Step 4: Re-run focused tests after any device finding**

For every device-only defect, first add a failing automated reproduction where React Native Testing Library can express it, then apply the minimal correction and rerun Tasks 9.1-9.3. If the defect is purely visual geometry, preserve before/after screenshots and run the nearest journey test.

- [ ] **Step 5: Complete the ledger and final diff review**

Replace every “Not run” entry with Pass, Fixed, or Environment-limited. List each confirmed defect with root cause, files changed, regression test, and device evidence. State explicitly that iOS device validation was unavailable.

- [ ] **Step 6: Apply completion verification workflow**

Read and follow `superpowers:verification-before-completion`, then review changed production code with `clean-code-guard` and changed tests with `test-guard`. Re-run any command those reviews require before claiming completion.
