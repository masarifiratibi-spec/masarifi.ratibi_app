# Unified Multiple Budgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one budget experience that opens creation directly when empty and supports several named, category-exclusive budgets in the same month.

**Architecture:** Extend the existing `Budget` payload and planning repository rather than adding a new store or database. Add a period-scoped budget-detail collection to the existing service, filter progress by assigned categories, then make the current overview and form consume that collection while reusing the existing routes and design tokens.

**Tech Stack:** TypeScript, React Native, Expo Router, TanStack Query, SQLite payload repository, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-unified-multiple-budgets-design.md`

## Global Constraints

- Work only in `D:/MY Work/0Part_Time/MASREFY _Final/.worktrees/r01-shared-ui-foundation`.
- Preserve all unrelated dirty-worktree changes; do not commit overlapping user changes.
- Use the Reports page background token resolving exactly to `#F6F7F5`.
- Add no dependency, framework, store, route name, or database.
- Keep income and savings values persisted but remove them from the redesigned form.
- Keep Arabic RTL, English LTR, safe areas, keyboard avoidance, masking, currency precision, and 200% text scaling.
- Follow strict red-green-refactor: every production behavior starts with a failing test that is observed failing for the expected reason.

---

### Task 1: Multiple-budget repository rules

**Files:**
- Modify: `apps/mobile/src/domain/financial-planning.ts`
- Modify: `apps/mobile/src/services/contracts/financial-planning-service.ts`
- Modify: `apps/mobile/src/storage/financial-planning-repository.ts`
- Modify: `apps/mobile/src/storage/financial-planning-repository.test.ts`
- Modify: `apps/mobile/src/test-utils/financial-planning-fixtures.ts`

**Interfaces:**
- Produces: `Budget.name: string | null`.
- Produces: `BudgetInput.name: string` and `BudgetInput.id?: string` so edits target one record instead of the period.
- Produces: `FinancialPlanningRepository.listBudgets(periodKey?: string): Budget[]`.
- Produces: `FinancialPlanningRepository.assertCategoriesAvailable(periodKey: string, categoryIds: readonly string[], excludingBudgetId?: string): void`.

- [ ] **Step 1: Write repository tests that prove two named budgets can coexist in one month**

```ts
it('stores multiple named budgets in the same period', () => {
  const repository = new FinancialPlanningRepository();
  const first = repository.saveBudget(budgetInput('Home', '2026-08'), 'home');
  const second = repository.saveBudget(budgetInput('Personal', '2026-08'), 'personal');

  expect(repository.listBudgets('2026-08').map((budget) => budget.name)).toEqual([
    'Home',
    'Personal'
  ]);
  expect(first.id).not.toBe(second.id);
});
```

- [ ] **Step 2: Add tests for normalized duplicate names and category ownership**

```ts
it('rejects duplicate normalized names and categories within a period', () => {
  const repository = new FinancialPlanningRepository();
  const home = repository.saveBudget(budgetInput('Home', '2026-08'), 'home');
  repository.replaceCategoryBudgets(home.id, [categoryBudget(home.id, 'housing')]);

  expect(() => repository.saveBudget(budgetInput(' home ', '2026-08'), 'duplicate')).toThrow(
    FinancialPlanningError
  );
  expect(() => repository.assertCategoriesAvailable('2026-08', ['housing'])).toThrow(
    FinancialPlanningError
  );
  expect(() => repository.assertCategoriesAvailable('2026-09', ['housing'])).not.toThrow();
});
```

- [ ] **Step 3: Run the repository tests and verify RED**

Run: `npx jest --runInBand src/storage/financial-planning-repository.test.ts`

Expected: FAIL because `Budget.name`, the period-scoped list, and category-ownership validation do not exist and the repository still updates by period.

- [ ] **Step 4: Implement the minimal repository behavior**

```ts
export interface Budget extends RecordMetadata {
  name: string | null;
  periodKey: string;
}

listBudgets(periodKey?: string): Budget[] {
  return this.budgets
    .filter((budget) => !periodKey || budget.periodKey === periodKey)
    .map(copy);
}
```

For new records, locate by `input.id` only. Reject a non-null normalized-name match in the same period, excluding `input.id`, and keep operation-ID idempotency before validation. In `assertCategoriesAvailable`, resolve category budgets to their owning non-deleted budget and throw `FinancialPlanningError('duplicate')` on any same-period conflict.

- [ ] **Step 5: Normalize legacy names during hydration without rewriting payloads**

```ts
this.budgets = budgets.map((budget) => ({
  ...budget,
  name: typeof budget.name === 'string' && budget.name.trim() ? budget.name.trim() : null
}));
```

- [ ] **Step 6: Run the repository tests and verify GREEN**

Run: `npx jest --runInBand src/storage/financial-planning-repository.test.ts`

Expected: PASS with no console warnings.

---

### Task 2: Category-filtered progress and period collection service

**Files:**
- Modify: `apps/mobile/src/domain/financial-planning.ts`
- Modify: `apps/mobile/src/domain/financial-planning-budget.test.ts`
- Modify: `apps/mobile/src/services/contracts/financial-planning-service.ts`
- Modify: `apps/mobile/src/services/mocks/financial-planning-service.ts`
- Modify: `apps/mobile/src/services/mocks/financial-planning-service.test.ts`

**Interfaces:**
- Consumes: `Budget.name`, `listBudgets(periodKey)`, and `assertCategoriesAvailable` from Task 1.
- Produces: `calculateBudgetProgress({ budget, transactions, categoryIds, today, missingRateTransactionIds? })`.
- Produces: `FinancialPlanningService.listBudgets(periodKey: string): Promise<BudgetDetail[]>`.

- [ ] **Step 1: Write a failing domain test for category-filtered spend**

```ts
it('counts only transactions assigned to the budget categories', () => {
  const progress = calculateBudgetProgress({
    budget: fixtureBudget,
    transactions: [
      makeTransaction({ id: 'housing', categoryId: 'housing', amountMinor: 400_00 }),
      makeTransaction({ id: 'food', categoryId: 'food', amountMinor: 900_00 })
    ],
    categoryIds: ['housing'],
    today: planningToday
  });

  expect(progress.eligibleSpendMinor).toMatchObject({ status: 'available', value: 400_00 });
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npx jest --runInBand src/domain/financial-planning-budget.test.ts`

Expected: FAIL because `categoryIds` is not accepted and both expenses are counted.

- [ ] **Step 3: Filter before projecting transaction effects**

```ts
const categoryIds = input.categoryIds ? new Set(input.categoryIds) : null;
const eligibleTransactions = categoryIds
  ? input.transactions.filter((transaction) =>
      transaction.categoryId ? categoryIds.has(transaction.categoryId) : false
    )
  : input.transactions;
const projections = projectTransactionEffects(eligibleTransactions, null);
```

- [ ] **Step 4: Write failing service tests for list, deterministic legacy read, and category conflict**

```ts
it('lists every budget detail for a period and keeps the singular read deterministic', async () => {
  const service = createSeededFinancialPlanningService();
  await service.saveBudget(namedBudgetInput('Home', '2032-08', ['housing']), 'home');
  await service.saveBudget(namedBudgetInput('Personal', '2032-08', ['food']), 'personal');

  const list = await service.listBudgets('2032-08');
  expect(list.map((detail) => detail.budget.name)).toEqual(['Home', 'Personal']);
  expect((await service.getBudget('2032-08'))?.budget.name).toBe('Personal');
});
```

- [ ] **Step 5: Run the service test and verify RED**

Run: `npx jest --runInBand src/services/mocks/financial-planning-service.test.ts`

Expected: FAIL because `listBudgets` and named saves are not implemented.

- [ ] **Step 6: Implement collection reads and pre-save validation**

Read transactions once per request, build each `BudgetDetail` with its assigned category IDs, and sort by `createdAt` then `id`. Before `repository.saveBudget`, trim the required name and call `assertCategoriesAvailable` using the incoming category IDs and editing ID. Preserve legacy singular `getBudget` by choosing the most recently updated result deterministically.

- [ ] **Step 7: Run domain and service tests and verify GREEN**

Run: `npx jest --runInBand src/domain/financial-planning-budget.test.ts src/services/mocks/financial-planning-service.test.ts`

Expected: PASS with no console warnings.

---

### Task 3: Aggregate active budgets in Reports

**Files:**
- Modify: `apps/mobile/src/domain/reports.ts`
- Modify: `apps/mobile/src/domain/reports-trends.test.ts`
- Modify: `apps/mobile/src/services/mocks/financial-planning-service.ts`
- Modify: `apps/mobile/src/features/reports/ReportsScreen.tsx`
- Modify: `apps/mobile/src/features/reports/ReportsJourney.test.tsx`

**Interfaces:**
- Consumes: named budgets and category budgets from Tasks 1–2.
- Produces: `PlanningReportingSnapshot.categoryBudgets: CategoryBudget[]`.
- Produces: monthly `budget_performance` based on all active period budgets and their unique categories.

- [ ] **Step 1: Write a failing report test with two active and one paused budget**

```ts
it('aggregates active monthly budgets without counting unrelated categories', () => {
  const report = generateReport(reportInput({
    budgets: [homeBudget, personalBudget, pausedBudget],
    categoryBudgets: [homeHousing, personalFood, pausedTravel],
    transactions: [housingExpense, foodExpense, travelExpense, unrelatedExpense]
  }));

  expect(report.insights.find((item) => item.kind === 'budget_performance')?.value).toMatchObject({
    status: 'available',
    value: { minorUnits: 1_700_00 }
  });
});
```

- [ ] **Step 2: Run the report test and verify RED**

Run: `npx jest --runInBand src/domain/reports-trends.test.ts`

Expected: FAIL because the report takes the first budget and subtracts every expense.

- [ ] **Step 3: Add category budgets to the reporting snapshot and compute the aggregate**

```ts
const activeBudgets = planning?.budgets.filter(
  (budget) => budget.periodKey === period.startDate.slice(0, 7) && budget.status === 'active'
) ?? [];
const activeIds = new Set(activeBudgets.map((budget) => budget.id));
const categoryIds = new Set(
  planning?.categoryBudgets
    .filter((item) => activeIds.has(item.budgetId) && item.status === 'active')
    .map((item) => item.categoryId) ?? []
);
```

Sum effective limits, derive eligible expense from current-period projected entries whose category is in `categoryIds`, and return remaining. Preserve all other report insights and card geometry.

Pass the resulting `budget_performance` value into the existing `BudgetCard`. Replace only its static “set budget” copy when active budgets exist; keep the same card, icon container, typography, spacing, color, and `/budgets` destination.

- [ ] **Step 4: Run report tests and verify GREEN**

Run: `npx jest --runInBand src/domain/reports-trends.test.ts src/features/reports/ReportsJourney.test.tsx`

Expected: PASS with no unexpected warnings.

---

### Task 4: Unified query, direct-empty form, and multiple-budget collection

**Files:**
- Modify: `apps/mobile/src/features/financial-planning/financial-planning-queries.ts`
- Modify: `apps/mobile/src/features/budgets/budget-queries.ts`
- Modify: `apps/mobile/src/features/budgets/BudgetOverviewScreen.tsx`
- Modify: `apps/mobile/src/features/budgets/BudgetJourney.test.tsx`
- Modify: `apps/mobile/src/features/financial-planning/PlanningScaffold.tsx`

**Interfaces:**
- Consumes: `financialPlanningService.listBudgets(periodKey)` from Task 2.
- Produces: `useBudgets(periodKey: string)`.
- Produces: `PlanningScreen.backgroundColor?: string` for a budget-only background override.
- Consumes: `BudgetForm({ embedded?: boolean, onSaved?: () => void })` from Task 5.

- [ ] **Step 1: Write failing UI tests for direct empty creation and populated collection**

```tsx
it('shows creation directly instead of the empty planning state', async () => {
  renderWithProviders(<BudgetOverviewScreen />);
  expect(await screen.findByLabelText('Budget name')).toBeTruthy();
  expect(screen.queryByText('No planning records yet')).toBeNull();
});

it('renders every budget in the selected month', async () => {
  await saveBudget('Home', 'housing');
  await saveBudget('Personal', 'food');
  renderWithProviders(<BudgetOverviewScreen />);
  expect(await screen.findByText('Home')).toBeTruthy();
  expect(screen.getByText('Personal')).toBeTruthy();
});
```

- [ ] **Step 2: Run the journey test and verify RED**

Run: `npx jest --runInBand src/features/budgets/BudgetJourney.test.tsx`

Expected: FAIL because the overview uses the singular query and renders `PlanningState state="empty"`.

- [ ] **Step 3: Add the collection query and exact background override**

```ts
budgetList: (periodKey: string) => ['planning', 'budgets', periodKey] as const

export function useBudgets(periodKey: string) {
  return useQuery({
    queryKey: financialPlanningKeys.budgetList(periodKey),
    queryFn: () => financialPlanningService.listBudgets(periodKey)
  });
}
```

Allow `PlanningScreen` to pass `style={{ backgroundColor }}` only when the caller supplies it. The budget screens pass `colorTokens.neutral.warmSurface`; other planning screens remain unchanged.

Map `planning.budget` mutation scopes to both the legacy detail key and the new `['planning', 'budgets']` prefix so create, edit, allocation, pause/resume, and delete refresh the collection.

- [ ] **Step 4: Render the direct form or mapped budget cards**

The empty branch renders `<BudgetForm embedded onSaved={() => void query.refetch()} />`. The populated branch maps every `BudgetDetail` to a white card using the existing report tokens, currency formatter, masking state, progress value, and category count. Keep transactions, allocation, edit, pause/resume, and delete controls inside each card so the former single-budget actions remain reachable. Keep one “Add budget” action to `/budgets/new`.

- [ ] **Step 5: Run the journey test and verify GREEN**

Run: `npx jest --runInBand src/features/budgets/BudgetJourney.test.tsx`

Expected: PASS with no unexpected warnings.

---

### Task 5: Redesign the budget form around expense-owned fields

**Files:**
- Modify: `apps/mobile/src/features/budgets/BudgetForm.tsx`
- Modify: `apps/mobile/src/features/budgets/BudgetJourney.test.tsx`
- Modify: `apps/mobile/src/localization/messages/ar.ts`
- Modify: `apps/mobile/src/localization/messages/en.ts`
- Modify: `apps/mobile/app/budgets/new.tsx`

**Interfaces:**
- Produces: `BudgetForm({ budgetId?: string, embedded?: boolean, onSaved?: () => void })`.
- Consumes: `useBudgets(periodKey)` and `BudgetInput.name`.

- [ ] **Step 1: Write failing form tests for required name, removed global targets, and second save**

```tsx
it('creates a named expense budget without income or savings fields', async () => {
  renderWithProviders(<BudgetForm />);
  expect(screen.queryByLabelText('Income target')).toBeNull();
  expect(screen.queryByLabelText('Savings target')).toBeNull();
  fireEvent.changeText(await screen.findByLabelText('Budget name'), 'Home');
  fireEvent.changeText(screen.getByLabelText('Expense limit'), '5000');
  fireEvent.press(screen.getByText('Save'));
  expect(await screen.findByText('Saved')).toBeTruthy();
});
```

- [ ] **Step 2: Add a failing category-conflict presentation test**

Create an existing “Home” budget with `housing`, render a second form for the same month, and assert the localized owner line `Housing — Home` is visible and the category picker excludes `housing`.

- [ ] **Step 3: Run the journey test and verify RED**

Run: `npx jest --runInBand src/features/budgets/BudgetJourney.test.tsx`

Expected: FAIL because the form has no name, still shows income/savings fields, and does not know category ownership.

- [ ] **Step 4: Implement the minimal redesigned form**

Add `name` to local and draft state, prefill legacy edits with the localized monthly-budget fallback, pass `id: budgetId || undefined` on save, submit preserved existing income/savings values or zero for new records, and keep currency-aware amount parsing. Query same-month budgets to exclude owned categories except those of the edited budget. Render the owner summary with existing `StyledText` variants.

Use the existing fields, picker, switch, and action components inside white grouped cards. Pass the exact warm background when not embedded. On successful standalone creation call `router.replace('/budgets')`; embedded creation calls `onSaved` and stays on the unified route.

- [ ] **Step 5: Keep prior-budget copying deterministic**

Use the previous period’s list. If one prior budget exists, copy it directly. If several exist, show their names using the existing `AppSheet` and copy only after the user chooses one. Copy name as an editable value, expense/category limits, rollover, and `copiedFromBudgetId`; never save automatically.

- [ ] **Step 6: Run the journey test and verify GREEN**

Run: `npx jest --runInBand src/features/budgets/BudgetJourney.test.tsx`

Expected: PASS with no unexpected warnings.

---

### Task 6: Cross-feature verification and clean review

**Files:**
- Review only: all files modified in Tasks 1–5.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verified feature evidence; no new production interface.

- [ ] **Step 1: Run focused behavioral suites**

Run:

```powershell
npx jest --runInBand src/storage/financial-planning-repository.test.ts src/domain/financial-planning-budget.test.ts src/services/mocks/financial-planning-service.test.ts src/domain/reports-trends.test.ts src/features/reports/ReportsJourney.test.tsx src/features/budgets/BudgetJourney.test.tsx
```

Expected: all suites and tests pass with zero unexpected console warnings.

- [ ] **Step 2: Run static gates**

Run:

```powershell
npm run typecheck
npm run lint
npm run check:financial-planning
npm run check:reports
npm run check:design-system
```

Expected: every command exits zero.

- [ ] **Step 3: Run whitespace and scoped-diff checks**

Run from the worktree root:

```powershell
git diff --check
git diff -- apps/mobile/src/domain/financial-planning.ts apps/mobile/src/services/contracts/financial-planning-service.ts apps/mobile/src/storage/financial-planning-repository.ts apps/mobile/src/services/mocks/financial-planning-service.ts apps/mobile/src/features/budgets apps/mobile/src/features/financial-planning/financial-planning-queries.ts apps/mobile/src/features/financial-planning/PlanningScaffold.tsx apps/mobile/src/domain/reports.ts apps/mobile/src/localization/messages/ar.ts apps/mobile/src/localization/messages/en.ts
```

Expected: no whitespace errors and no unrelated visual or architectural change introduced by this implementation.

- [ ] **Step 4: Review tests and production code**

Confirm every test names a real regression, asserts behavior rather than mocks or style internals, and would fail if the corresponding validation/filter/route branch were removed. Confirm the implementation reuses existing services, tokens, formatters, category selection, cards, and sheets without a new abstraction or dependency.

- [ ] **Step 5: Record manual visual evidence if the runtime is available**

Capture `/budgets` with no current-month records, `/budgets` with two records, `/budgets/new`, Arabic RTL, and English LTR. Verify the page background resolves to `#F6F7F5`, cards and action colors match Reports, and there is no intermediate empty screen.
