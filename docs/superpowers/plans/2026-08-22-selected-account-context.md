# Selected Account Context (Home + Transactions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose "All Accounts" or one specific account once, and have Home and Transactions show only that account's real ledger data, with all existing filters still working.

**Architecture:** Extend the existing shared zustand store `useCoreFinanceViewState` (src/state/core-finance-view-state.ts) with `selectedAccountId: string | null` plus a pure `applyAccountScope(filters, selectedAccountId)` combinator. Screens derive effective query filters via `applyAccountScope`; `getHomeSummary` and `matchesFilters`/`listTransactions` already honor `filters.accountIds`, so no repository/service changes are needed. A new shared `AccountScopeSheet` (features/accounts) provides the selection UI on both screens.

**Tech Stack:** Expo (React Native), expo-router, zustand v4, @tanstack/react-query v5, jest-expo + @testing-library/react-native.

**Spec:** User-provided brief (pasted 2026-08-22): "Selected account context for Home and Transactions" — see Global Constraints.

## Global Constraints

- Work ONLY inside `.worktrees/r01-shared-ui-foundation` on branch `codex/r01-shared-ui-foundation`.
- **Do NOT commit, push, reset, or clean the worktree.** (Plan omits commit steps deliberately.)
- Real data only: reuse `coreFinanceService` / `CoreFinanceRepository`. No fixtures/hardcoded balances in production code (fixtures allowed in tests only).
- Do not remove existing business logic; do not replace existing filters — combine via `accountIds` intersection semantics.
- Filtering pipeline stays: account scope → date range → type/category/quick filters → sorting → time grouping.
- Preserve domain rules for expenses/income/transfers/refunds/deleted/archived accounts exactly as implemented in `transactionEffectForAccount` and `matchesFilters` (transfers matched by source `accountId` only — existing behavior).
- RTL: mirror layouts with `flexDirection: 'row-reverse'`, logical alignment, `writingDirection` — never `textAlign` alone. Follow existing idioms in HomeSummary/TransactionListScreen.
- Design system only: AppSheet, DesignIcon/AppIcon, tokens (radius/spacing/borders), shared cards. No screen-local styling inventions.
- Tests: every task TDD (failing test first). Run from `apps/mobile`.

---

### Task 1: Store — selected account state + scope combinator

**Files:**
- Modify: `apps/mobile/src/state/core-finance-view-state.ts`
- Test: `apps/mobile/src/state/core-finance-view-state.test.ts`

**Interfaces:**
- Produces: `selectedAccountId: string | null` on `useCoreFinanceViewState`; actions `selectAccount(accountId: string | null): void` and `reconcileSelectedAccount(activeAccountIds: readonly string[]): void`; pure `applyAccountScope(filters: TransactionFilterSet, selectedAccountId: string | null): TransactionFilterSet`.

Semantics:
- `selectedAccountId === null` → All Accounts → `applyAccountScope` returns filters unchanged.
- No `filters.accountIds` → effective `accountIds: [selectedAccountId]`.
- `filters.accountIds` includes selected → effective `accountIds: [selectedAccountId]` (intersection).
- `filters.accountIds` excludes selected → effective `accountIds: [NO_ACCOUNT_MATCHES_ID]` (truthful AND → empty result, filter chip stays visible).
- `reconcileSelectedAccount` clears a selection that is no longer an active account (archived/deleted), no-op for null.

- [ ] **Step 1: Write failing tests** — append to `core-finance-view-state.test.ts`:

```ts
import { applyAccountScope } from './core-finance-view-state';

it('selects and clears the selected account scope', () => {
  useCoreFinanceViewState.getState().selectAccount('account-wallet');
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe('account-wallet');
  useCoreFinanceViewState.getState().selectAccount(null);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(null);
});

it('applyAccountScope returns filters untouched for All Accounts', () => {
  const filters = emptyFilters();
  expect(applyAccountScope(filters, null)).toBe(filters);
});

it('applyAccountScope scopes unfiltered filters to the selected account', () => {
  const scoped = applyAccountScope({ ...emptyFilters(), search: 'coffee' }, 'account-wallet');
  expect(scoped.accountIds).toEqual(['account-wallet']);
  expect(scoped.search).toBe('coffee');
});

it('applyAccountScope intersects with the accountIds filter', () => {
  const scoped = applyAccountScope(
    { ...emptyFilters(), accountIds: ['account-bank', 'account-wallet'] },
    'account-wallet'
  );
  expect(scoped.accountIds).toEqual(['account-wallet']);
});

it('applyAccountScope yields a no-match scope for disjoint account filters', () => {
  const scoped = applyAccountScope(
    { ...emptyFilters(), accountIds: ['account-bank'] },
    'account-wallet'
  );
  expect(scoped.accountIds).toEqual(['account-scope-no-match']);
});

it('reconcileSelectedAccount clears stale selections and keeps valid ones', () => {
  useCoreFinanceViewState.setState({ selectedAccountId: 'account-wallet' });
  useCoreFinanceViewState.getState().reconcileSelectedAccount(['account-bank']);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(null);

  useCoreFinanceViewState.getState().selectAccount('account-bank');
  useCoreFinanceViewState.getState().reconcileSelectedAccount(['account-bank', 'account-wallet']);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe('account-bank');
});
```

Also reset `selectedAccountId: null` in both existing tests' `setState`/setup where relevant (add `selectedAccountId: null` to the `emptyFilters`-style resets inside `beforeEach` of new tests).

- [ ] **Step 2: Run** `npm test -- core-finance-view-state` → expect FAIL (`applyAccountScope` not exported; `selectAccount` not a function).
- [ ] **Step 3: Implement** in `core-finance-view-state.ts`:

```ts
const NO_ACCOUNT_MATCHES_ID = 'account-scope-no-match';

export function applyAccountScope(
  filters: TransactionFilterSet,
  selectedAccountId: string | null
): TransactionFilterSet {
  if (!selectedAccountId) return filters;
  if (!filters.accountIds.length) {
    return { ...filters, accountIds: [selectedAccountId] };
  }
  return {
    ...filters,
    accountIds: filters.accountIds.includes(selectedAccountId)
      ? [selectedAccountId]
      : [NO_ACCOUNT_MATCHES_ID]
  };
}
```

Add to interface + store: `selectedAccountId: string | null` (init `null`); `selectAccount: (accountId) => set({ selectedAccountId: accountId })`; `reconcileSelectedAccount: (activeAccountIds) => set((state) => state.selectedAccountId && !activeAccountIds.includes(state.selectedAccountId) ? { selectedAccountId: null } : {})`.

- [ ] **Step 4: Run tests** → PASS.

### Task 2: Localization keys

**Files:**
- Modify: `apps/mobile/src/localization/messages/en.ts` (home block ~line 443-468)
- Modify: `apps/mobile/src/localization/messages/ar.ts` (home block ~line 432-456)

- [ ] **Step 1: Add keys** to both catalogs (typed — both files must match):

| key | en | ar |
|---|---|---|
| `coreFinance.home.spent` | `Spent this period` | `المصروف خلال الفترة` |
| `coreFinance.home.accountEmpty` | `No activity in this account yet` | `لا توجد حركات في هذا الحساب بعد` |
| `coreFinance.home.accountScope.title` | `Choose account` | `اختر الحساب` |
| `coreFinance.ledger.accountEmpty` | `No transactions in this account yet` | `لا توجد معاملات في هذا الحساب بعد` |

(`ledger.accountEmpty` goes next to `coreFinance.ledger.empty` in each file. Reuse existing `coreFinance.home.allAccounts` and `coreFinance.accountType.*` labels.)

- [ ] **Step 2: Verify** `npm test -- localization i18n` (or full suite later) — catalog types match.

### Task 3: Shared `AccountScopeSheet`

**Files:**
- Create: `apps/mobile/src/features/accounts/AccountScopeSheet.tsx`
- Delete: `apps/mobile/src/features/home/HomeAccountsSheet.tsx` (only consumer is HomeSummary; all its actions move over verbatim)
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx` (import swap only — full HomeSummary changes are Task 4; do the import swap here to keep the tree compiling)
- Test: `apps/mobile/src/features/accounts/AccountScopeSheet.test.tsx`

**Interfaces:**
- Consumes: `useCoreFinanceViewState` (`selectedAccountId`, `selectAccount`), `AccountPicker` (features/transactions), `AppSheet`, Task 2 keys.
- Produces: `AccountScopeSheet({ visible, onDismiss }: { visible: boolean; onDismiss: () => void })`.

Content (single file, helpers moved from HomeAccountsSheet): AppSheet `appearance="menu"` `title=coreFinance.home.accountScope.title`, testID `account-scope-sheet`:
1. "All accounts" option row — icon `accounts`, selected when `selectedAccountId === null`, check icon when selected; `onPress → selectAccount(null); onDismiss()`.
2. `AccountPicker` single-select (`selectedId={selectedAccountId ?? undefined}`) — `onSelect → selectAccount(account.id); onDismiss()`. (AccountPicker already lists active accounts only.)
3. Existing actions moved verbatim: Add account (`/accounts/new`), Manage accounts (`/accounts`), How balances work (expanding explanation), Cancel.

- [ ] **Step 1: Failing test** (patterns from HomeScreen.test.tsx — `renderWithProviders`, seed accounts/balances queries with `renderWithQueryData`):

```tsx
it('offers All Accounts and picks a specific account into the shared store', async () => {
  const { userEvent } = renderWithQueryData(<AccountScopeSheet visible onDismiss={jest.fn()} />, [
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.accountBalances(true), []]
  ]);
  expect(screen.getByText(translate('coreFinance.home.allAccounts'))).toBeTruthy();
  const walletRow = screen.getAllByTestId('account-row')[1]; // fixture order: bank, wallet, usd, archived
  await userEvent.press(walletRow);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe('account-wallet');
});
```

Plus: selecting "All accounts" clears the store; archived account never rendered; manage/add actions present.

- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement** — move `SheetAction`/`BalanceExplanation`/`CancelButton` from HomeAccountsSheet; add `ScopeOption` (SheetAction + `selected` state + `check` icon, direction-aware row). Update HomeSummary import; delete HomeAccountsSheet.tsx. Grep first for other references before deleting.
- [ ] **Step 4: Run new test + existing home tests** → PASS.

### Task 4: Home respects the account scope

**Files:**
- Modify: `apps/mobile/src/features/home/HomeScreen.tsx` (QueriedHomeScreen + seam)
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx`
- Test: `apps/mobile/src/features/home/HomeScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 store API + `applyAccountScope`; Task 3 `AccountScopeSheet`.
- Produces: `HomeSummary` gains prop `selectedAccount?: Account | null` (presentational).

HomeScreen:
- Read `selectedAccountId` from store; `const scopedFilters = useMemo(() => applyAccountScope(periodFilters(period), selectedAccountId), [period, selectedAccountId])`; pass to `useHomeSummary('SAR', scopedFilters)`.
- Reconcile: `useEffect(() => { if (accounts.data) reconcileSelectedAccount(activeIds); }, [accounts.data, activeIds])` where `activeIds = accounts.data.filter(a => a.status === 'active').map(a => a.id)`.
- Seam path (injected `accounts`/`summary`): derive `selectedAccount = accounts?.find(({id}) => id === selectedAccountId) ?? null` and pass down.
- Queried path: same derivation from `accounts.data`.

HomeSummary (prop `selectedAccount`):
- **Hero**: All Accounts → unchanged (total balance). Specific account → label `coreFinance.home.spent`, value `summary.periodExpenseMinor / 100` (same formatter/masking/state), support line unchanged (estimated/recorded). Accessibility labels follow the same conditional key.
- **Account card** (now the selector trigger, keeps testID `home-account-card`): All Accounts → current text + count + total; specific account → title = account name, subtitle = `coreFinance.accountType.${type}`, right value = `summary.components.find(c => c.accountId === selectedAccount.id)?.convertedMinor / 100` formatted (masked; hide when component missing e.g. FX-excluded). Append trailing `chevronDown` DesignIcon (decorative) in both modes; keep direction-aware `flexDirection`/`alignItems` idioms.
- **Empty state**: when specific account and both activity sections empty → `coreFinance.home.accountEmpty` instead of `coreFinance.ledger.empty`.
- Sheet: `AccountScopeSheet` replaces `HomeAccountsSheet`.

- [ ] **Step 1: Failing tests** (extend HomeScreen.test.tsx; follow existing fixture/summary style):
  1. All Accounts default: hero shows total (existing tests already cover — keep green).
  2. Scoped hero: `useCoreFinanceViewState.setState({ selectedAccountId: 'account-wallet' })`; render seam with accounts=fixtureAccounts and summary `{...summary, periodExpenseMinor: 20000, components: [{accountId:'account-wallet', originalMinor: 50000, currencyCode:'SAR', convertedMinor: 50000, rate: 1, asOf: 1}], recentTransactions: [makeTransaction(3, {accountId:'account-wallet'})]}` → expect hero text = formatter output of 200, card title 'Al Masarifi Wallet' (fixture name — verify exact name), and only wallet rows in activity sections.
  3. Account with no transactions: summary with `recentTransactions: []` → expect `coreFinance.home.accountEmpty` text, and no other-account amounts.
  4. Switching accounts: rerender with `selectedAccountId: 'account-bank'` and new summary → hero/card update (no stale wallet name).
  5. RTL: with `direction: 'rtl'`, `home-account-card` has `flexDirection: 'row-reverse'` and chevron renders; LTR mirror `row`.
- [ ] **Step 2: Run** → new tests FAIL.
- [ ] **Step 3: Implement** HomeScreen + HomeSummary changes above.
- [ ] **Step 4: Run home tests** → PASS (incl. existing HomeAccessibility/HomeRoute).

### Task 5: Transactions respects the account scope

**Files:**
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Test: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 (`applyAccountScope`, `selectedAccountId`, `reconcileSelectedAccount`), Task 3 `AccountScopeSheet`.

Changes:
- `const selectedAccountId = useCoreFinanceViewState((s) => s.selectedAccountId)`; `const scopedFilters = useMemo(() => applyAccountScope(filters, selectedAccountId), [filters, selectedAccountId])`; `useInfiniteTransactions(scopedFilters)`. Store `filters` stays untouched (chips/quick scopes keep working; query key changes force fresh data).
- Reconcile effect (same as Home, guarded by `accounts.data`).
- **Account scope chip** `transaction-account-scope` above MonthlySummary: pressable pill styled like `transaction-period-control` (card bg, subtle border, `physicalLtr`, direction-aware row): `accounts` icon + label (`selectedAccount?.name ?? coreFinance.home.allAccounts`) + `chevronDown`; opens `AccountScopeSheet`. Render **only when ≥2 active accounts** (one-account simplicity).
- **MonthlySummary**: accept `selectedAccountId` prop; query becomes `useHomeSummary(baseCurrencyCode, applyAccountScope(periodFilters(period), selectedAccountId))`.
- **Empty state**: `filters.search ? filteredEmpty : selectedAccountId ? ledger.accountEmpty : ledger.empty`.
- Time grouping untouched — `buildTransactionSections` runs on the scoped result.

- [ ] **Step 1: Failing tests** (extend existing file; seeds must use scoped keys):
  1. All Accounts (existing tests cover; keep green).
  2. Specific account: seed `coreFinanceKeys.transactionPages(applyAccountScope(emptyTransactionFilters, 'account-wallet'))` with only wallet transactions (`makeTransaction(5, {accountId:'account-wallet'})` etc.), store `selectedAccountId='account-wallet'`, accounts/categories seeds, scoped summary seed → only wallet rows render; chip label = wallet name.
  3. Scope + date: store filters `{periodStart, periodEnd}` + selection → seed `applyAccountScope({...}, 'account-wallet')` key → scoped+dated rows only.
  4. Scope + type: filters `{types:['expense']}` + selection → combined key seed.
  5. Account with no transactions: scoped seed with `items: []` → `ledger.accountEmpty` text.
  6. Stale prevention: `selectedAccountId='account-missing'` with accounts loaded → reconciled to null; list uses unscoped key.
  7. Chip hidden with 1 active account (accounts seed = single active).
  8. RTL: chip `flexDirection: 'row-reverse'` with `direction:'rtl'`; LTR `row`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** above.
- [ ] **Step 4: Run transactions tests** → PASS.

### Task 6: Full verification

- [ ] `npm test` (full suite) — all green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run lint` — clean (if script exists).

### Task 7: Android device validation (RTL + LTR)

- [ ] `adb devices` — confirm device; `adb reverse tcp:8081 tcp:8081`.
- [ ] Start Metro in `apps/mobile`; launch app on device.
- [ ] Home: All Accounts ↔ Account A ↔ Account B ↔ empty account; repeated switching; summaries + recent transactions update immediately; hero switches total↔spent.
- [ ] Transactions: scope persists from Home; date filter + scope; type/category quick filter + scope; groups (Today/Yesterday/Last Week/Earlier) from scoped data only; empty account message.
- [ ] Switch app language ar↔en; verify selector layout mirrors (icon/chevron order, alignment), amounts stable LTR.
- [ ] Capture screenshots (adb exec-out screencap) for the report.

## Final report

Cover: previous data flow; new architecture; where state lives; files changed; tests; device validation results; remaining risks.
