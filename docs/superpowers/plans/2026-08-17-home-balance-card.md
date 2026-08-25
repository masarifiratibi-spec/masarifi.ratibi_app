# Home Balance Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the canonical Home balance hero into a premium dark-teal card with a dominant balance and three responsive inset financial stats.

**Architecture:** Keep `FinancialPulse` as the shared hero owner and extend it only with an optional scope-information icon. Keep real Home values and metric semantics in `HomeSummary`; no query, formatter, privacy, or navigation logic moves. Extend the existing `DesignIcon` name map for trend icons rather than importing another icon library.

**Tech Stack:** React Native 0.74, Expo Router, TypeScript, Jest, React Native Testing Library, Masarifi semantic tokens.

## Global Constraints

- Continue only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Preserve all existing uncommitted changes; do not reset, clean, commit, push, or overwrite unrelated files.
- Do not change financial calculations, queries, currency formatting, privacy masking, account scope, period behavior, or Home header behavior.
- Use existing semantic tokens and the shared icon system; add no dependency, raw feature-level color, gradient, or heavy shadow.
- Normal text uses three metric cards in one row; 200% text stacks them without reducing typography.
- Arabic and English must have matching reading order, accessibility order, and hierarchy.

---

### Task 1: Shared hero hierarchy and icon vocabulary

**Files:**
- Modify: `apps/mobile/src/design-system/icons.tsx`
- Modify: `apps/mobile/src/design-system/icons.test.tsx`
- Modify: `apps/mobile/src/design-system/components/financial/FinancialPulse.tsx`
- Test: `apps/mobile/src/design-system/components/financial/SharedDecisionSurfaces.test.tsx`

**Interfaces:**
- Add `DesignIconName` values `trendUp` and `trendDown`, mapped to the installed Ionicons glyphs `trending-up` and `trending-down`.
- Add optional `scopeIcon?: DesignIconName` to `FinancialPulse`.
- Keep every existing `FinancialPulse` caller source-compatible.

- [ ] **Step 1: Write failing shared-component tests**

Add assertions that a pulse with `scopeIcon="info"` renders `financial-pulse-scope`, `financial-pulse-statement`, two decorative orbit elements, and an info icon excluded from accessibility. Add an icons test rendering `trendUp` and `trendDown` through `DesignIcon`.

- [ ] **Step 2: Run the shared tests and verify RED**

Run:

```powershell
npx jest --runInBand src/design-system/icons.test.tsx src/design-system/components/financial/SharedDecisionSurfaces.test.tsx
```

Expected: failures for the missing trend icon names, scope icon, test IDs, and second orbit.

- [ ] **Step 3: Implement the minimum shared changes**

Extend the icon map, then update `FinancialPulse` to:

```tsx
<View testID="financial-pulse-scope" style={scopeRowStyle}>
  <Text>{scope}</Text>
  {scopeIcon ? <DesignIcon name={scopeIcon} label={scope} decorative /> : null}
</View>
<Text
  testID="financial-pulse-statement"
  adjustsFontSizeToFit={!largeText}
  numberOfLines={largeText ? 2 : 1}
>
  {statement}
</Text>
```

Use `PixelRatio.getFontScale()`, `usePreferenceStore`, existing tokens, and two clipped hairline orbit circles. Align scope, statement, and supporting copy to the locale reading edge while keeping the financial statement itself LTR.

- [ ] **Step 4: Run the shared tests and verify GREEN**

Run the Step 2 command. Expected: both suites pass.

---

### Task 2: Home inset metric cards and responsive order

**Files:**
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify: `apps/mobile/src/features/accessibility/LargeTextLayout.test.tsx`

**Interfaces:**
- Keep `HomeSummary` props unchanged.
- Extend the internal `Metric` props with `meaning: 'income' | 'expense' | 'accounts'` and `icon: 'trendUp' | 'trendDown' | 'accounts'`.
- Add stable test IDs `home-financial-metric-income`, `home-financial-metric-expense`, and `home-financial-metric-accounts`.

- [ ] **Step 1: Write failing Home behavior and layout tests**

In `HomeScreen.test.tsx`, assert:

```tsx
expect(screen.getByTestId('home-financial-metrics')).toHaveStyle({
  flexDirection: 'row'
});
expect(screen.getByTestId('home-financial-metric-income')).toBeTruthy();
expect(screen.getByTestId('home-financial-metric-expense')).toBeTruthy();
expect(screen.getByTestId('home-financial-metric-accounts')).toBeTruthy();
expect(screen.getByTestId('home-financial-metric-income-icon', {
  includeHiddenElements: true
})).toBeTruthy();
```

For Arabic, assert `row-reverse`; at a mocked font scale of `2`, assert English `column` and Arabic `column-reverse`. Retain the current masking assertions and add checks that both income and expense remain `•••• SAR` when hidden.

- [ ] **Step 2: Run Home tests and verify RED**

Run:

```powershell
npx jest --runInBand src/features/home/HomeScreen.test.tsx src/features/accessibility/LargeTextLayout.test.tsx
```

Expected: failures for missing metric cards/icons and Arabic `column-reverse`.

- [ ] **Step 3: Implement the metric-card composition**

Pass `scopeIcon="info"` to `FinancialPulse`. Keep child order Income, Expense, Accounts and set the metrics container direction to:

```ts
largeText
  ? direction === 'rtl' ? 'column-reverse' : 'column'
  : direction === 'rtl' ? 'row-reverse' : 'row'
```

Each `Metric` uses a flexible inset card, semantic background from `surfaces.overlay` with controlled opacity, a shared circular icon, localized reading-edge alignment, and existing formatted values. Use `theme.colors.financial.income` and `.expense`; active accounts uses inverse content. Do not change the values passed into `Metric`.

- [ ] **Step 4: Run Home tests and verify GREEN**

Run the Step 2 command. Expected: both suites pass with no act warnings introduced by this change.

- [ ] **Step 5: Run the complete focused regression set**

Run:

```powershell
npx jest --runInBand src/design-system/icons.test.tsx src/design-system/components/financial/SharedDecisionSurfaces.test.tsx src/features/home/HomeScreen.test.tsx src/features/home/HomeAccessibility.test.tsx src/features/accessibility/LargeTextLayout.test.tsx src/features/privacy/OutputPrivacyRegression.test.tsx
```

Expected: all focused suites pass.

---

### Task 3: Bounded visual correction and release checks

**Files:**
- Modify only if the first rendered comparison finds a material defect in the Task 1–2 files.

**Interfaces:** None.

- [ ] **Step 1: Load the Impeccable craft floor immediately before UI editing**

Read `C:\Users\DELL\.agents\skills\impeccable\reference\craft-floor.md` and apply its constraints to the approved design.

- [ ] **Step 2: Inspect one Arabic and one English mobile-width web render**

Use the existing web process at `http://localhost:8083/`. Verify the balance hierarchy, currency attachment, divider, three normal-scale cards, Arabic/English order, icon placement, orbit restraint, masking, and dark-theme token safety. Capture the first comparison, correct material differences in one batch, and use at most one confirmation capture.

- [ ] **Step 3: Run release verification on the final tree**

Run:

```powershell
npx jest --runInBand
npm run typecheck
npm run lint
npm run check:design-system
npm run check:core-finance
node C:\Users\DELL\.agents\skills\impeccable\scripts\detect.mjs --json apps/mobile/src/design-system/components/financial/FinancialPulse.tsx apps/mobile/src/features/home/HomeSummary.tsx
git diff --check
adb devices -l
```

Expected: Jest, typecheck, lint, boundaries, detector, and diff checks pass. If no authorized Android device appears, stop at the Android gate and explicitly avoid claiming physical Android or TalkBack validation.

- [ ] **Step 4: Preserve the worktree**

Leave branch `codex/r01-shared-ui-foundation` and all uncommitted changes intact. Do not commit, push, merge, reset, clean, or remove the worktree.
