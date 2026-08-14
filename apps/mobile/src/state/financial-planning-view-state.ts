import { create } from 'zustand';

export interface FinancialPlanningViewState {
  selectedBudgetPeriod: string;
  obligationFilter: 'all' | 'payable' | 'receivable';
  savingsFilter: 'all' | 'active' | 'paused' | 'completed' | 'archived';
  setSelectedBudgetPeriod: (period: string) => void;
  setObligationFilter: (filter: FinancialPlanningViewState['obligationFilter']) => void;
  setSavingsFilter: (filter: FinancialPlanningViewState['savingsFilter']) => void;
}

export const useFinancialPlanningViewStore =
  create<FinancialPlanningViewState>((set) => ({
    selectedBudgetPeriod: new Date().toISOString().slice(0, 7),
    obligationFilter: 'all',
    savingsFilter: 'all',
    setSelectedBudgetPeriod: (selectedBudgetPeriod) =>
      set({ selectedBudgetPeriod }),
    setObligationFilter: (obligationFilter) => set({ obligationFilter }),
    setSavingsFilter: (savingsFilter) => set({ savingsFilter })
  }));
