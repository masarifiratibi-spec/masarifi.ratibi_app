import { create } from 'zustand';

import {
  emptyTransactionFilters,
  type TransactionFilterSet
} from '@/domain/core-finance';

interface CoreFinanceViewState {
  filters: TransactionFilterSet;
  draftFilters: TransactionFilterSet;
  editFilters: (patch: Partial<TransactionFilterSet>) => void;
  applyFilters: () => void;
  removeFilter: (key: keyof TransactionFilterSet) => void;
  clearFilters: () => void;
}

export const useCoreFinanceViewState = create<CoreFinanceViewState>((set) => ({
  filters: emptyTransactionFilters,
  draftFilters: emptyTransactionFilters,
  editFilters: (patch) =>
    set((state) => ({ draftFilters: { ...state.draftFilters, ...patch } })),
  applyFilters: () => set((state) => ({ filters: state.draftFilters })),
  removeFilter: (key) =>
    set((state) => {
      const value = emptyTransactionFilters[key];
      return {
        filters: { ...state.filters, [key]: value },
        draftFilters: { ...state.draftFilters, [key]: value }
      };
    }),
  clearFilters: () =>
    set({
      filters: emptyTransactionFilters,
      draftFilters: emptyTransactionFilters
    })
}));
