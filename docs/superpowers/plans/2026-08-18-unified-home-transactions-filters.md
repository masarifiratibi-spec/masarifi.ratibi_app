# Unified Home and Transactions Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse one date-range sheet on Home and Transactions, expose supported Transactions filters directly in the unified sheet, and remove the redundant All Filters entry.

**Architecture:** Move the approved Home period model and sheet into shared filter ownership, keeping them store-agnostic. Home retains local period state; Transactions adapts the shared period to its existing Zustand draft/applied filter store and reuses the existing advanced filter content inside the quick sheet.

**Tech Stack:** React Native, Expo Router, TypeScript, Zustand, Jest, React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-08-18-unified-home-transactions-filters-design.md`

## Global Constraints

- Work only in the existing `codex/r01-shared-ui-foundation` worktree.
- Do not change APIs, repositories, persistence, filter schemas, date semantics, or sorting semantics.
- Do not add dependencies or navigation abstractions.
- Preserve Home and Transactions as separate state owners.
- Reuse existing `AppSheet`, `ChipSelector`, `PickerField`, `ActionButton`, icons, spacing, radii, theme, account picker, and category picker.
- Preserve structural Arabic RTL and English LTR behavior, accessibility roles/states, and minimum touch targets.
- Do not stage or commit unrelated dirty-worktree files.

---

### Task 1: Shared date-range flow and Transactions period control

**Files:**

- Create: `apps/mobile/src/features/filters/date-period.ts`
- Create: `apps/mobile/src/features/filters/DateRangeSheet.tsx`
- Create: `apps/mobile/src/features/filters/DateRangeSheet.test.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.tsx`
- Delete: `apps/mobile/src/features/home/home-period.ts`
- Delete: `apps/mobile/src/features/home/HomePeriodSheet.tsx`
- Delete: `apps/mobile/src/features/home/HomePeriodSheet.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`

**Interfaces:**

- Produces: `DatePeriod`, `monthPeriod(timestamp?)`, `customPeriod(start, end)`, `periodFromRange(start, end, fallback?)`, `periodFilters(period)`, `formatPeriodLabel(period, locale)`, and `DateRangeSheet({ visible, period, onApply, onDismiss })`.
- Consumes: existing `TransactionFilterSet`, `AppSheet`, `TransactionDateField`, locale/direction preferences, and the Transactions filter store.

- [ ] **Step 1: Replace the Transactions route expectation with a failing shared-flow behavior test**

Change the existing `opens the existing filters from the selected period control` test to prove the real behavior and unrelated-state preservation:

```tsx
it("opens the shared period flow and preserves unrelated transaction filters", () => {
  const initial = {
    ...emptyTransactionFilters,
    periodStart: Date.UTC(2026, 6, 1),
    periodEnd: Date.UTC(2026, 7, 1) - 1,
    sources: ["manual" as const],
  };
  useCoreFinanceViewState.setState({ filters: initial, draftFilters: initial });
  renderTransactionList(initial);

  fireEvent.press(screen.getByTestId("transaction-period-control"));
  expect(screen.getByText("Choose date range")).toBeTruthy();
  fireEvent.press(screen.getByText("By month"));
  fireEvent.press(screen.getByLabelText("September 2026"));

  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    periodStart: Date.UTC(2026, 8, 1),
    periodEnd: Date.UTC(2026, 9, 1) - 1,
    sources: ["manual"],
  });
  expect(screen.getByText("September 2026")).toBeTruthy();
});
```

Use the file's existing query seeds rather than introducing a mock component.

- [ ] **Step 2: Run the focused Transactions test and verify RED**

Run:

```powershell
npm test -- --runInBand src/features/transactions/TransactionListScreen.test.tsx -t "opens the shared period flow"
```

Expected: FAIL because pressing the period still pushes `/modals/transaction-filters` and `Choose date range` is absent.

- [ ] **Step 3: Move the existing Home period implementation into shared filter ownership**

Move the existing logic without changing its UTC behavior:

```ts
export interface DatePeriod {
  kind: "month" | "custom";
  periodStart: number;
  periodEnd: number;
}

export function periodFromRange(
  start: number | null,
  end: number | null,
  fallback = Date.now(),
): DatePeriod {
  if (start === null && end === null) return monthPeriod(fallback);
  const resolvedStart = start ?? end!;
  const resolvedEnd = end ?? start!;
  const month = monthPeriod(resolvedStart);
  return resolvedStart === month.periodStart && resolvedEnd === month.periodEnd
    ? month
    : { kind: "custom", periodStart: resolvedStart, periodEnd: resolvedEnd };
}

export function periodFilters(period: DatePeriod): TransactionFilterSet {
  return {
    ...emptyTransactionFilters,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };
}
```

Move `formatPeriodLabel` beside these helpers. Rename `HomePeriodSheet` to `DateRangeSheet`, `HomePeriod` to `DatePeriod`, and its test IDs from `home-period-*` to `date-period-*`. Keep the existing month list, custom date fields, validation, icons, spacing, and RTL structure.

- [ ] **Step 4: Connect Home and Transactions to the shared component**

Home changes imports only and retains local state plus `useHomeSummary('SAR', periodFilters(period))`.

Transactions owns visibility and adapts the shared result to its existing store:

```tsx
const [periodOpen, setPeriodOpen] = useState(false);
const transactionPeriod = periodFromRange(
  draft.periodStart,
  draft.periodEnd,
  now
);

<MonthlySummary
  periodStart={filters.periodStart}
  onPeriodPress={() => {
    beginFilterSession();
    setPeriodOpen(true);
  }}
/>
<DateRangeSheet
  visible={periodOpen}
  period={transactionPeriod}
  onApply={(next) => {
    editFilters({
      periodStart: next.periodStart,
      periodEnd: next.periodEnd
    });
    applyFilters();
  }}
  onDismiss={() => setPeriodOpen(false)}
/>
```

Make `MonthlySummary` accept and call `onPeriodPress`; remove its advanced-route navigation. Use shared `formatPeriodLabel` for the pill label.

- [ ] **Step 5: Move the existing date-sheet tests and run GREEN**

Move the Home period sheet tests to `DateRangeSheet.test.tsx`, update imports/test IDs/names only, and run:

```powershell
npm test -- --runInBand src/features/filters/DateRangeSheet.test.tsx src/features/home/HomeScreen.test.tsx src/features/transactions/TransactionListScreen.test.tsx
```

Expected: PASS with the Transactions shared-flow test updating the store and visible label.

---

### Task 2: Reuse advanced filter content in the Transactions quick sheet

**Files:**

- Modify: `apps/mobile/src/features/transactions/TransactionFilters.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionFilters.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`

**Interfaces:**

- Consumes: Task 1 `DateRangeSheet`, `periodFromRange`, and `formatPeriodLabel`.
- Produces: `TransactionFilters({ embedded?, onApplied?, onCancelled? })`, usable by the existing route and inside the quick sheet.

- [ ] **Step 1: Write failing quick-sheet coverage**

Replace `applies quick sorting and opens all filters` with behavior that catches missing direct filters and the redundant entry:

```tsx
it("applies supported filters directly without an All Filters entry", () => {
  renderTransactionList(emptyTransactionFilters);
  fireEvent.press(
    screen.getByLabelText(translate("designSystem.navigation.moreOptions")),
  );

  expect(
    screen.queryByText(translate("coreFinance.filters.allFilters")),
  ).toBeNull();
  expect(
    screen.getByText(translate("coreFinance.filters.accounts")),
  ).toBeTruthy();
  expect(
    screen.getByText(translate("coreFinance.filters.categories")),
  ).toBeTruthy();
  expect(
    screen.getByText(translate("coreFinance.filters.sources")),
  ).toBeTruthy();

  fireEvent.press(screen.getByText(translate("coreFinance.type.expense")));
  fireEvent.press(screen.getByText(translate("coreFinance.source.automatic")));
  fireEvent.press(
    screen.getByText(translate("coreFinance.filters.sort.amount_high")),
  );
  fireEvent.press(screen.getByText(translate("coreFinance.filters.apply")));

  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    types: ["expense"],
    sources: ["automatic"],
    sort: "amount_high",
  });
});
```

- [ ] **Step 2: Run the quick-sheet test and verify RED**

Run:

```powershell
npm test -- --runInBand src/features/transactions/TransactionListScreen.test.tsx -t "without an All Filters entry"
```

Expected: FAIL because `All Filters` is still rendered and accounts/sources are absent from the quick sheet.

- [ ] **Step 3: Make `TransactionFilters` embeddable and use the shared period flow**

Add optional callbacks while preserving the route defaults:

```ts
export function TransactionFilters({
  embedded = false,
  onApplied,
  onCancelled,
}: {
  embedded?: boolean;
  onApplied?: () => void;
  onCancelled?: () => void;
} = {});
```

After applying/cancelling, call the supplied callback or `router.back()`. Give embedded content a bounded, shrinking height so the parent `AppSheet` owns the bottom-sheet shell:

```ts
sheetScreen: { flexShrink: 1, height: 560 }
```

Replace the two free-text date fields and their parser with one `PickerField` that opens Task 1's `DateRangeSheet`. Applying a date range edits only the draft period; the sheet-level Apply action still commits the whole draft. Keep the existing five sections and every already-supported filter.

- [ ] **Step 4: Render the shared advanced content directly in the quick sheet**

Delete the quick sheet's local sorting/type/category implementation, `categoryPickerOpen`, and the `All Filters` action. Mount the reusable content only while open:

```tsx
{
  quickFiltersOpen ? (
    <AppSheet
      appearance="menu"
      title={translate("coreFinance.filters.quick")}
      visible
      onDismiss={() => {
        cancelFilterSession();
        setQuickFiltersOpen(false);
      }}
    >
      <TransactionFilters
        embedded
        onApplied={() => setQuickFiltersOpen(false)}
        onCancelled={() => setQuickFiltersOpen(false)}
      />
    </AppSheet>
  ) : null;
}
```

The overflow handler only opens the sheet; `TransactionFilters` begins the draft session on mount.

- [ ] **Step 5: Update focused `TransactionFilters` tests**

Replace assertions for start/end text fields with the shared period row and flow:

```tsx
fireEvent.press(screen.getByText(translate("coreFinance.filters.period")));
expect(
  screen.getByText(translate("coreFinance.home.period.choose")),
).toBeTruthy();
```

Add an embedded callback test proving Apply calls `onApplied`, Cancel calls `onCancelled`, and neither requires route navigation.

- [ ] **Step 6: Run the focused filter tests and verify GREEN**

Run:

```powershell
npm test -- --runInBand src/features/transactions/TransactionFilters.test.tsx src/features/transactions/TransactionListScreen.test.tsx
```

Expected: PASS; the quick sheet exposes all existing filter sections and never renders `All Filters / كل الفلاتر`.

---

### Task 3: State preservation and RTL/LTR regression coverage

**Files:**

- Modify: `apps/mobile/src/features/transactions/TransactionFilters.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`

**Interfaces:**

- Consumes: shared date flow and embeddable transaction filter content from Tasks 1–2.
- Produces: regression evidence for independent state fields and structural directionality.

- [ ] **Step 1: Add a failing state-preservation test**

Start with an applied period and source, change sort/type in the quick sheet, apply, and assert the period/source remain unchanged:

```tsx
expect(useCoreFinanceViewState.getState().filters).toMatchObject({
  periodStart: Date.UTC(2026, 7, 1),
  periodEnd: Date.UTC(2026, 8, 1) - 1,
  sources: ["manual"],
  types: ["expense"],
  sort: "oldest",
});
```

The production mutation caught is replacing the draft with partial quick-filter state instead of patching it.

- [ ] **Step 2: Add structural direction tests**

Render Arabic/RTL and English/LTR, open the shared period flow from Transactions, and assert the existing `date-period-option-custom` row uses `row-reverse` for RTL and `row` for LTR. Assert chip containers keep their existing locale-aware physical order through the real `ChipSelector`.

- [ ] **Step 3: Run tests and fix only real regressions**

Run:

```powershell
npm test -- --runInBand src/features/filters/DateRangeSheet.test.tsx src/features/home/HomeScreen.test.tsx src/features/transactions/TransactionFilters.test.tsx src/features/transactions/TransactionListScreen.test.tsx src/state/core-finance-view-state.test.ts
```

Expected: PASS. If a new test fails, change production behavior rather than weakening the assertion.

---

### Task 4: Verification and visual comparison

**Files:**

- Verify only; do not create evidence artifacts unless an existing project command does so.

**Interfaces:**

- Consumes: completed shared-filter implementation.
- Produces: fresh test, type-check/lint, and rendered RTL/LTR evidence.

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- --runInBand src/features/filters/DateRangeSheet.test.tsx src/features/home/HomeScreen.test.tsx src/features/transactions/TransactionFilters.test.tsx src/features/transactions/TransactionListScreen.test.tsx src/state/core-finance-view-state.test.ts
```

- [ ] **Step 2: Run the mobile project's static checks**

Read `package.json` and run its existing type-check/lint command. Do not add a new script.

- [ ] **Step 3: Review the exact diff**

```powershell
git diff --check
git diff -- apps/mobile/src/features/filters apps/mobile/src/features/home/HomeScreen.tsx apps/mobile/src/features/transactions/TransactionFilters.tsx apps/mobile/src/features/transactions/TransactionListScreen.tsx
```

Confirm no query/repository/schema/API changes and no unrelated files are staged.

- [ ] **Step 4: Render Arabic RTL and English LTR**

Use the existing Expo local test path to capture or inspect Home's month sheet, Transactions' month sheet, and Transactions' advanced sheet in both locales. Compare sheet shell, spacing, rows, chips, icon placement, selected dark-teal state, and action placement against the approved Home flow and supplied screenshot.

- [ ] **Step 5: Run final verification fresh**

Repeat the focused test command and static checks after any visual fixes. Completion requires zero failures in the fresh output.
