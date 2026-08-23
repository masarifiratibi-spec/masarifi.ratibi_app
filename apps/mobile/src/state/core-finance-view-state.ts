import { create } from 'zustand';

import {
  emptyTransactionFilters,
  type TransactionFilterSet
} from '@/domain/core-finance';

const NO_ACCOUNT_MATCHES_ID = 'account-scope-no-match';

/**
 * Combines the shared account scope with transaction filters.
 * - `null` (All Accounts) leaves the filters untouched.
 * - A selected account without an accountIds filter narrows to that account.
 * - With an accountIds filter the scope intersects; a disjoint filter set
 *   resolves to a sentinel id that matches no account (truthful AND).
 */
export function applyAccountScope(
  filters: TransactionFilterSet,
  selectedAccountKey: string | null
): TransactionFilterSet {
  if (!selectedAccountKey) return filters;
  if (!filters.accountIds.length) {
    return { ...filters, accountIds: [selectedAccountKey] };
  }
  return {
    ...filters,
    accountIds: filters.accountIds.includes(selectedAccountKey)
      ? [selectedAccountKey]
      : [NO_ACCOUNT_MATCHES_ID]
  };
}

interface CoreFinanceViewState {
  filters: TransactionFilterSet;
  draftFilters: TransactionFilterSet;
  selectedAccountId: string | null;
  beginFilterSession: () => void;
  editFilters: (patch: Partial<TransactionFilterSet>) => void;
  cancelFilterSession: () => void;
  resetDraftFilters: () => void;
  applyFilters: () => void;
  removeFilter: (key: keyof TransactionFilterSet) => void;
  clearFilters: () => void;
  selectAccount: (accountKey: string | null) => void;
  reconcileSelectedAccount: (activeAccountKeys: readonly string[]) => void;
}

export const useCoreFinanceViewState = create<CoreFinanceViewState>((set) => ({
  filters: emptyTransactionFilters,
  draftFilters: emptyTransactionFilters,
  selectedAccountId: null,
  beginFilterSession: () =>
    set((state) => ({ draftFilters: { ...state.filters } })),
  editFilters: (patch) =>
    set((state) => ({ draftFilters: { ...state.draftFilters, ...patch } })),
  cancelFilterSession: () =>
    set((state) => ({ draftFilters: { ...state.filters } })),
  resetDraftFilters: () => set({ draftFilters: emptyTransactionFilters }),
  applyFilters: () => set((state) => ({ filters: state.draftFilters })),
  removeFilter: (key) =>
    set((state) => {
      const patch =
        key === 'periodStart' || key === 'periodEnd'
          ? { periodStart: null, periodEnd: null }
          : key === 'minMinor' || key === 'maxMinor'
            ? {
                [key]: null,
                ...(state.filters[
                  key === 'minMinor' ? 'maxMinor' : 'minMinor'
                ] === null
                  ? { amountCurrencyCode: null }
                  : {})
              }
          : { [key]: emptyTransactionFilters[key] };
      return {
        filters: { ...state.filters, ...patch },
        draftFilters: { ...state.draftFilters, ...patch }
      };
    }),
  clearFilters: () =>
    set({
      filters: emptyTransactionFilters,
      draftFilters: emptyTransactionFilters
    }),
  selectAccount: (accountKey) => set({ selectedAccountId: accountKey }),
  reconcileSelectedAccount: (activeAccountKeys) =>
    set((state) =>
      state.selectedAccountId &&
      !activeAccountKeys.includes(state.selectedAccountId)
        ? { selectedAccountId: null }
        : {}
    )
}));
