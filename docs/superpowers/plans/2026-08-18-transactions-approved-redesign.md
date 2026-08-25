# Approved Transactions Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production Transactions presentation with the approved light, grouped-card composition while preserving existing queries, filters, privacy, pagination, and direct edit navigation.

**Architecture:** Keep the current infinite `FlatList`, flattened date headings, and row virtualization. Recompose the header and summary on canonical semantic tokens, pass the existing grouped-position metadata through to `TransactionRow`, and make adjacent rows share one visual outer card with inset dividers.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, TanStack Query, Zustand, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-transactions-approved-redesign-design.md`

## Global Constraints

- Use the supplied approved reference as the primary composition target.
- Preserve real data, queries, filtering semantics, sorting, pagination, privacy masking, sync, persistence, and direct `/transactions/{id}/edit` navigation.
- Consume canonical semantic tokens and existing shared icons/components; add no raw feature colors, emoji mappings, dependency, API, schema, or parallel route.
- Arabic RTL and English LTR are structural mirrors and must remain usable at 200% text.
- Keep the shared Home/Transactions `DateRangeSheet`; do not introduce another picker.
- The worktree already contains unrelated user-owned changes. Do not stage or commit implementation files; only report the scoped diff.

---

### Task 1: Make the shared period flow stable and period-correct

**Files:**
- Modify: `apps/mobile/src/features/filters/DateRangeSheet.test.tsx`
- Modify: `apps/mobile/src/features/filters/DateRangeSheet.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`

**Interfaces:**
- Consumes: `periodFilters(period: DatePeriod): TransactionFilterSet`, `useHomeSummary(currency, filters)`, and the existing `DateRangeSheet` props.
- Produces: a sheet that does not reset on equivalent period-object rerenders and a summary query keyed by the visible period.

- [ ] **Step 1: Add the equivalent-period rerender regression**

Add this test to `DateRangeSheet.test.tsx`:

```tsx
it('keeps the active step when an equivalent period object rerenders', () => {
  const period = monthPeriod(Date.UTC(2026, 7, 17));
  const props = { visible: true, onApply: jest.fn(), onDismiss: jest.fn() };
  const view = renderWithProviders(<DateRangeSheet {...props} period={period} />);

  fireEvent.press(screen.getByText('Custom range'));
  expect(screen.getByLabelText('Start date')).toBeTruthy();

  view.rerender(<DateRangeSheet {...props} period={{ ...period }} />);
  expect(screen.getByLabelText('Start date')).toBeTruthy();
});
```

- [ ] **Step 2: Add a period-specific summary regression**

In `TransactionListScreen.test.tsx`, import `monthPeriod` and `periodFilters`. Update the default summary seed to use the current August period, then extend the shared-period test with distinct July and September summaries:

```tsx
const july = monthPeriod(Date.UTC(2026, 6, 1));
const september = monthPeriod(Date.UTC(2026, 8, 1));

[coreFinanceKeys.home('SAR'), homeSummary],
[coreFinanceKeys.home('SAR', periodFilters(july)), {
  ...homeSummary,
  periodIncomeMinor: 11_100
}],
[coreFinanceKeys.home('SAR', periodFilters(september)), {
  ...homeSummary,
  periodIncomeMinor: 22_200
}]
```

Assert the initial summary shows `+111.00 SAR`, select September in the shared sheet, and assert it changes to `+222.00 SAR` while unrelated filters remain unchanged.

- [ ] **Step 3: Run the two regressions and verify RED**

Run:

```powershell
npx jest --runInBand src/features/filters/DateRangeSheet.test.tsx src/features/transactions/TransactionListScreen.test.tsx -t "equivalent period|shared period flow"
```

Expected: the sheet returns to the choice step after rerender, and Transactions does not use the period-specific summary seed.

- [ ] **Step 4: Apply the minimal root fixes**

Change the shared sheet effect dependency from object identity to period values:

```tsx
useEffect(() => {
  if (!visible) return;
  setStep('choose');
  setStart(period.periodStart);
  setEnd(period.periodEnd);
}, [visible, period.periodStart, period.periodEnd]);
```

In `TransactionListScreen.tsx`, import `periodFilters` and query the visible period:

```tsx
const summary = useHomeSummary(baseCurrencyCode, periodFilters(period));
```

- [ ] **Step 5: Run Task 1 tests and verify GREEN**

Run:

```powershell
npx jest --runInBand src/features/filters/DateRangeSheet.test.tsx src/features/filters/date-period.test.ts src/features/transactions/TransactionListScreen.test.tsx
```

Expected: all three suites pass with no new warning.

---

### Task 2: Recompose the light header, month pill, summary, and quick scopes

**Files:**
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`

**Interfaces:**
- Consumes: `PrimaryShellHeader`, `DesignIcon`, `AmountText`, `DateRangeSheet`, semantic theme colors, and existing quick-scope/filter-store callbacks.
- Produces: the approved light first viewport without changing state ownership.

- [ ] **Step 1: Replace legacy hero assertions with approved composition assertions**

Update tests to require:

```tsx
expect(screen.queryByTestId('transactions-horizon-hero')).toBeNull();
expect(screen.getByTestId('transactions-page-header')).toHaveStyle({
  backgroundColor: lightThemeColors.surfaces.page
});
expect(within(screen.getByTestId('primary-shell-center'))
  .getByLabelText(translate('coreFinance.ledger.search'))).toBeTruthy();
expect(within(screen.getByTestId('primary-shell-center'))
  .getByLabelText(translate('designSystem.navigation.moreOptions'))).toBeTruthy();
expect(screen.getByTestId('transaction-period-control')).toHaveStyle({
  alignSelf: 'center'
});
expect(screen.getByTestId('transaction-summary-income')).toBeTruthy();
expect(screen.getByTestId('transaction-summary-expense')).toBeTruthy();
```

Keep the existing Reports/More navigation, search apply/clear, quick-filter sheet, masking, and large-text tests. Change the RTL header assertion so the title/actions row is `row-reverse` in Arabic and `row` in English.

- [ ] **Step 2: Run the composition tests and verify RED**

Run:

```powershell
npx jest --runInBand src/features/transactions/TransactionListScreen.test.tsx -t "approved light composition|fixed shell actions|200%"
```

Expected: the dark horizon is still present and search/filter actions are outside the shared header center.

- [ ] **Step 3: Remove the legacy dark hero and activity cap**

In `TransactionListScreen.tsx`:

- remove `FinancialHorizonSurface`, the hero wrapper, and `transactions-activity-cap`;
- keep `PrimaryShellHeader` and place a full-width center row containing the localized title plus the existing search and quick-filter icon buttons;
- preserve the `onBack` branch with the existing callback and directional icon;
- render the expanded search field below the header on semantic card/page colors;
- place `MonthlySummary` below the header and the quick-scope rail below the summary.

Use existing components and callbacks; do not create another header component or state store.

- [ ] **Step 4: Restyle the month and summary using semantic tokens**

The month control uses `calendar` and `chevronDown` `DesignIcon`s and the shared control tokens. Replace Unicode arrows in `SummaryMetric` with:

```tsx
<DesignIcon
  name={meaning === 'income' ? 'trendUp' : 'trendDown'}
  label={label}
  color={color}
  decorative
/>
```

Use `theme.colors.surfaces.card`, `theme.colors.surfaces.brandSubtle`, `theme.colors.surfaces.inset`, `theme.colors.borders.subtle`, `theme.colors.financial.income`, and `theme.colors.financial.expense`. Keep summary cards side-by-side at normal text and stacked at `PixelRatio.getFontScale() >= 1.5`.

- [ ] **Step 5: Restyle quick-scope chips without changing filter semantics**

Selected chips use `theme.colors.interactions.primary` with inverse content. Inactive chips use `theme.colors.surfaces.card`, `theme.colors.borders.subtle`, and primary content. Preserve the current All/Transfer/available-category sequence and `applyQuickScopes` behavior.

- [ ] **Step 6: Run Task 2 tests and verify GREEN**

Run:

```powershell
npx jest --runInBand src/features/transactions/TransactionListScreen.test.tsx
```

Expected: the Transactions suite passes, including search, filters, masking, pagination, navigation, RTL/LTR, and large-text cases.

---

### Task 3: Make each time group one continuous rounded card

**Files:**
- Modify: `apps/mobile/src/design-system/components/financial/TransactionRow.test.tsx`
- Modify: `apps/mobile/src/design-system/components/financial/TransactionRow.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`

**Interfaces:**
- Consumes: `buildTransactionSections`, `TransactionGroupedPosition`, and the existing `TransactionRow` presentation props.
- Produces: virtualized rows whose shared edges render as one group card.

- [ ] **Step 1: Replace the independent-card screen regression**

Change the existing test to require real group positions and no per-row wrapper:

```tsx
it('renders one continuous card per real time group', () => {
  // Seed two transactions with the same occurredAt day.
  const rows = screen.UNSAFE_getAllByType(TransactionRow);
  expect(rows.map((row) => row.props.groupedPosition)).toEqual(['first', 'last']);
  expect(screen.queryByTestId('transaction-card')).toBeNull();
  expect(screen.getAllByTestId('transaction-date-header')).toHaveLength(1);
});
```

- [ ] **Step 2: Add shared-row boundary and divider regressions**

In `TransactionRow.test.tsx`, render first, middle, last, and only rows. Assert:

- first owns top corners and top/side borders;
- middle owns side borders but no outer top/bottom border;
- last owns bottom corners and bottom/side borders;
- only owns the complete rounded border;
- first and middle render `transaction-row-divider`;
- last and only do not render a divider;
- the 200% text row remains a column with a growing minimum height.

- [ ] **Step 3: Run grouped-card tests and verify RED**

Run:

```powershell
npx jest --runInBand src/design-system/components/financial/TransactionRow.test.tsx src/features/transactions/TransactionListScreen.test.tsx -t "continuous card|boundary|divider"
```

Expected: Transactions still forces every row to `only`, and the shared row still uses full-width row borders rather than an inset divider.

- [ ] **Step 4: Pass through existing group positions**

Remove the `transaction-card` wrapper and change the list item call to:

```tsx
<TransactionItem
  item={item.item}
  now={now}
  timeZone={timeZone}
  groupedPosition={item.groupedPosition}
  account={accountById.get(item.item.accountId)}
  category={item.item.categoryId ? categoryById.get(item.item.categoryId) : undefined}
/>
```

Keep section headings outside the rows and give the next heading enough top margin to separate completed group cards.

- [ ] **Step 5: Convert grouped row borders into one visual card**

In `TransactionRow.tsx`, retain the ungrouped row fallback for other callers. For grouped rows, apply only the outer borders/corners owned by their position and add this conditional divider after row content:

```tsx
{groupedPosition === 'first' || groupedPosition === 'middle' ? (
  <View
    testID="transaction-row-divider"
    style={[styles.divider, { backgroundColor: theme.colors.borders.subtle }]}
  />
) : null}
```

The divider is absolutely positioned at the row bottom with `left` and `right` equal to `spacing.lg`; it is not a full-width table rule. Preserve category visuals, masking, accessibility announcements, amount semantics, and edit press handling.

- [ ] **Step 6: Run Task 3 tests and verify GREEN**

Run:

```powershell
npx jest --runInBand src/features/transactions/transaction-sections.test.ts src/design-system/components/financial/TransactionRow.test.tsx src/features/transactions/TransactionListScreen.test.tsx
```

Expected: all grouping and presentation tests pass.

---

### Task 4: Verify behavior, code quality, and rendered fidelity

**Files:**
- Verify: all scoped files above
- Capture only: temporary Arabic and English screenshots; do not commit generated captures

**Interfaces:**
- Consumes: Expo web preview and the existing browser-control workflow.
- Produces: a verified production screen and a bounded visual comparison result.

- [ ] **Step 1: Format and run the focused suite**

Run:

```powershell
npx prettier --write src/features/filters/DateRangeSheet.tsx src/features/filters/DateRangeSheet.test.tsx src/features/transactions/TransactionListScreen.tsx src/features/transactions/TransactionListScreen.test.tsx src/design-system/components/financial/TransactionRow.tsx src/design-system/components/financial/TransactionRow.test.tsx
npx jest --runInBand src/features/filters/date-period.test.ts src/features/filters/DateRangeSheet.test.tsx src/features/transactions/transaction-sections.test.ts src/design-system/components/financial/TransactionRow.test.tsx src/features/transactions/TransactionFilters.test.tsx src/features/transactions/TransactionListScreen.test.tsx
```

Expected: all focused suites pass with no new warning.

- [ ] **Step 2: Run static and domain verification**

Run:

```powershell
npm run typecheck
npm run lint -- --no-cache
npm run check:core-finance
git diff --check -- apps/mobile/src/features/filters/DateRangeSheet.tsx apps/mobile/src/features/filters/DateRangeSheet.test.tsx apps/mobile/src/features/transactions/TransactionListScreen.tsx apps/mobile/src/features/transactions/TransactionListScreen.test.tsx apps/mobile/src/design-system/components/financial/TransactionRow.tsx apps/mobile/src/design-system/components/financial/TransactionRow.test.tsx
```

Expected: every command exits successfully. Ignore only unrelated pre-existing whole-worktree whitespace findings.

- [ ] **Step 3: Run the complete mobile Jest suite**

Run:

```powershell
npx jest --runInBand
```

Expected: the complete suite passes. If a failure is unrelated and pre-existing, record its exact suite/test and confirm the focused suites remain green; do not edit unrelated code.

- [ ] **Step 4: Run clean-code and test guards**

Review only the scoped production and test diff using the `clean-code-guard` and `test-guard` skills. Apply only findings that reduce duplication, remove implementation-coupled assertions, or prevent a real behavior regression.

- [ ] **Step 5: Capture the first bounded visual pass**

Start Expo web from `apps/mobile`, open the Transactions route in the in-app browser, and capture:

- Arabic RTL, light, 390×844;
- English LTR, light, 390×844;
- Arabic RTL at the smallest supported phone width, 320×568.

Compare them side-by-side with the approved reference for top spacing, summary proportions, chip density, section rhythm, group width/radius, row height, divider insets, category visual size, merchant hierarchy, amount placement, and bottom-safe-area behavior.

- [ ] **Step 6: Apply one correction batch and confirm once**

Patch all obvious discrepancies found in Step 5 together, rerun the focused suite, then capture Arabic and English once more. Stop after this confirmation round; report any remaining platform-renderer limitation rather than entering an open-ended polish loop.

- [ ] **Step 7: Report the scoped result without staging user changes**

Run:

```powershell
git status --short -- apps/mobile/src/features/filters/DateRangeSheet.tsx apps/mobile/src/features/filters/DateRangeSheet.test.tsx apps/mobile/src/features/transactions/TransactionListScreen.tsx apps/mobile/src/features/transactions/TransactionListScreen.test.tsx apps/mobile/src/design-system/components/financial/TransactionRow.tsx apps/mobile/src/design-system/components/financial/TransactionRow.test.tsx
```

Report the changed files, verification evidence, visual comparison outcome, and any pre-existing unrelated failure. Do not stage or commit these files.
