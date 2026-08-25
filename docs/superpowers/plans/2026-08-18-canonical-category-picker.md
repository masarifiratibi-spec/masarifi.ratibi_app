# Canonical Category Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one full-screen Category picker for normal single-category selection and migrate all existing normal consumers while leaving Transactions filters compact.

**Architecture:** A module-local selection-session registry bridges Expo Router without hardcoded return routes or serialized form state. `/category-picker` renders the canonical screen using existing category queries/presentation; filter surfaces keep a renamed compact picker.

**Tech Stack:** Expo Router, React Native, TypeScript, TanStack Query, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-canonical-category-picker-design.md`

## Global Constraints

- Do not change Category IDs, system/custom rules, persistence, API contracts, category creation, or transaction/category business logic.
- Normal single-category selection uses `/category-picker`; Transactions Quick Filter and full filters remain compact.
- Reuse `CategoryIcon`, `useCategories`, `projectCategory`, and `matchesCategorySearch`.
- Preserve origin form state and return immediately after selection.
- Support Arabic RTL, English LTR, small phones, web, long labels, and 200% text.
- The worktree is heavily dirty: do not commit, stage, or rewrite unrelated changes; run scoped diff checks after every task.

---

### Task 1: Selection Session Contract

**Files:**
- Create: `apps/mobile/src/features/categories/category-selection-session.ts`
- Create: `apps/mobile/src/features/categories/category-selection-session.test.ts`

**Interfaces:**
- Produces: `openCategorySelection(options): string`, `getCategorySelectionSession(requestId)`, `completeCategorySelection(requestId, categoryId)`, and `cancelCategorySelection(requestId)`.
- `openCategorySelection` accepts `{ selectedId?, excludedIds?, allowClear?, onSelect(categoryId) }`, stores a single-use callback, pushes `/category-picker`, and returns the request ID.

- [ ] **Step 1: Write the failing behavior tests**

```ts
it('opens the canonical route and completes a request once', () => {
  const onSelect = jest.fn();
  const requestId = openCategorySelection({ selectedId: 'food', onSelect });
  expect(router.push).toHaveBeenCalledWith({ pathname: '/category-picker', params: { requestId } });
  expect(completeCategorySelection(requestId, 'shopping')).toBe(true);
  expect(completeCategorySelection(requestId, 'health')).toBe(false);
  expect(onSelect).toHaveBeenCalledWith('shopping');
});

it('cancels without changing the origin', () => {
  const onSelect = jest.fn();
  const requestId = openCategorySelection({ onSelect });
  cancelCategorySelection(requestId);
  expect(completeCategorySelection(requestId, 'food')).toBe(false);
  expect(onSelect).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/categories/category-selection-session.test.ts`

Expected: FAIL because the session module does not exist.

- [ ] **Step 3: Implement the minimal single-use registry**

```ts
const sessions = new Map<string, CategorySelectionSession>();
let nextRequestId = 0;

export function openCategorySelection(options: CategorySelectionOptions) {
  const requestId = `category-${++nextRequestId}`;
  sessions.set(requestId, { ...options, excludedIds: options.excludedIds ?? [] });
  router.push({ pathname: '/category-picker', params: { requestId } });
  return requestId;
}
```

Completion and cancellation delete before invoking the callback so repeated taps cannot apply twice.

- [ ] **Step 4: Run GREEN and scoped diff check**

Run the focused Jest command, then `git diff --check -- apps/mobile/src/features/categories/category-selection-session.ts apps/mobile/src/features/categories/category-selection-session.test.ts`.

---

### Task 2: Canonical Full-Screen UI

**Files:**
- Create: `apps/mobile/app/category-picker.tsx`
- Create: `apps/mobile/src/features/categories/CategorySelectionScreen.tsx`
- Create: `apps/mobile/src/features/categories/CategorySelectionScreen.test.tsx`
- Modify: `apps/mobile/src/localization/messages/ar.ts`
- Modify: `apps/mobile/src/localization/messages/en.ts`

**Interfaces:**
- Consumes: the Task 1 selection session and existing `useCategories(true)` query.
- Produces: a full-screen `CategorySelectionScreen` with `requestId` and route-level Back/select behavior.

- [ ] **Step 1: Write failing screen tests**

Tests render real categories and assert literal user behavior:

```tsx
expect(screen.getByRole('header', { name: 'Category' })).toBeTruthy();
expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
expect(screen.getByText('Most Used')).toBeTruthy();
expect(screen.getByText('Others')).toBeTruthy();
expect(screen.getByText('Food')).toHaveAccessibilityState({ selected: true });
expect(screen.queryByText('System category')).toBeNull();
```

Add tests for search, favorite/non-favorite de-duplication, exclusions, empty Most Used, Back cancellation, single selection return, RTL/LTR row order, and 200% text row growth.

- [ ] **Step 2: Run RED**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/categories/CategorySelectionScreen.test.tsx`

Expected: FAIL because the screen and route do not exist.

- [ ] **Step 3: Implement the route and screen**

The route reads `requestId` from `useLocalSearchParams`. The screen:

```tsx
const favorites = filtered.filter(({ category }) => category.isFavorite);
const others = filtered.filter(({ category }) => !category.isFavorite);
const sections = [
  favorites.length ? { key: 'most-used', title: translate('coreFinance.categories.mostUsed'), data: favorites } : null,
  others.length ? { key: 'others', title: translate('coreFinance.categories.other'), data: others } : null
].filter(isPresent);
```

Render a fixed custom header, search field, and `SectionList`. Each section is one rounded grouped surface with hairline dividers. Each row renders only `CategoryIcon`, localized label, and a shared `check` icon when selected. Add an optional clear row only when `allowClear` is true.

Add exact picker copy:

```ts
'coreFinance.categoryPicker.title': 'Category'
'coreFinance.categoryPicker.search': 'Search categories...'
```

and Arabic `الفئة` / `ابحث عن الفئات...`.

- [ ] **Step 4: Run GREEN, typecheck the route, and diff-check**

Run the focused screen/session suites, `npm run typecheck`, and `git diff --check` limited to Task 2 files.

---

### Task 3: Migrate Normal Selection Consumers

**Files:**
- Modify: `apps/mobile/src/features/transactions/TransactionForm.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionForm.test.tsx`
- Modify: `apps/mobile/src/features/budgets/BudgetForm.tsx`
- Modify: `apps/mobile/src/features/budgets/BudgetJourney.test.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceReview.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceReview.test.tsx`
- Modify: `apps/mobile/src/features/categories/CategoryForm.tsx`
- Modify: `apps/mobile/src/features/categories/CategoryForm.test.tsx`
- Modify: `apps/mobile/src/features/categories/CategoryDetailScreen.tsx`
- Modify: `apps/mobile/src/features/categories/CategoryDetailScreen.test.tsx`
- Delete: `apps/mobile/app/modals/category-picker.tsx`
- Update route tests that reference the deleted modal route.

**Interfaces:**
- Consumes: `openCategorySelection`.
- Produces: every normal consumer opens the same canonical route and applies only the returned category ID.

- [ ] **Step 1: Add failing consumer tests**

Mock only the navigation helper boundary and assert consumer-visible state after invoking its captured callback. Cover:

- Add saves its existing manual draft before opening.
- Edit retains amount/title/account/notes/date while changing category.
- Budget preserves all limits and excludes salary/other-income/transfers.
- Voice preserves the assessment-resolution update.
- Parent allows clear and excludes the category being edited.
- Merge target excludes the source category.

- [ ] **Step 2: Run RED for the five owner suites**

Run the five focused test files with `--runInBand`; expect failures showing modal/sheet ownership still exists.

- [ ] **Step 3: Replace each normal modal with `openCategorySelection`**

Representative pattern:

```ts
openCategorySelection({
  selectedId: resolvedCategoryId,
  onSelect: setCategoryId
});
```

Add Transaction awaits its existing `saveManualDraft()` before opening. Parent selection uses `allowClear: true`; clear returns `null`. Remove only category picker sheets and their local open-state branches; keep Account picker sheets unchanged.

- [ ] **Step 4: Run GREEN, typecheck, and scoped diff-check**

Run all changed-owner suites, `npm run typecheck`, and a scoped `git diff --check`.

---

### Task 4: Separate Compact Transaction Filters and Verify

**Files:**
- Create: `apps/mobile/src/features/transactions/CategoryFilterPicker.tsx`
- Create or rename test owner: `apps/mobile/src/features/transactions/CategoryFilterPicker.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionFilters.tsx`
- Modify: corresponding Transactions tests
- Delete: `apps/mobile/src/features/transactions/CategoryPicker.tsx`
- Delete or replace: `apps/mobile/src/features/transactions/CategoryPicker.test.tsx`

**Interfaces:**
- Produces: `CategoryFilterPicker` used only by filter surfaces; no normal consumer imports it.

- [ ] **Step 1: Write failing ownership tests**

Assert both filter surfaces render their compact picker, support multi-select, and never call `router.push('/category-picker')`. Add an import-boundary check that normal consumer files do not import `CategoryFilterPicker`.

- [ ] **Step 2: Run RED**

Run Transactions list/filter/category focused suites; expect failure because the filter-specific owner does not exist.

- [ ] **Step 3: Move existing compact logic without behavior changes**

Rename the component and imports, retaining active filtering, multi-selection, existing search, and filter sheets. Remove the old general-purpose owner after all imports are migrated.

- [ ] **Step 4: Run focused and static verification**

Run changed-owner Jest suites, `npm run typecheck`, `npm run lint`, the core-finance boundary check, and `git diff --check` on all scoped files.

- [ ] **Step 5: Run full mobile verification**

Run `node node_modules/jest/bin/jest.js --runInBand` and confirm zero failing suites/tests.

- [ ] **Step 6: Visual validation**

Keep the existing Expo preview, navigate to `/category-picker` through a real consumer, and validate:

- Arabic RTL at 390px
- English LTR at 390px
- Arabic RTL at 320px
- focused 200% text tests

Correct only reference mismatches in header centering, search height, section spacing, grouped radius, dividers, icon/check size, background, and density. Re-run focused tests and static checks after any correction.
