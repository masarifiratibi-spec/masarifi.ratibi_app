import { create } from 'zustand';

import type { LocalDate } from '@/domain/financial-planning';
import type { ReportPeriodKind, ReportReturnContext } from '@/domain/reports';

interface ReportsViewState {
  selectedKind: ReportPeriodKind;
  anchorDate: LocalDate;
  scrollOffset: number;
  returnContext: ReportReturnContext | null;
  setPeriod: (kind: ReportPeriodKind, anchorDate: LocalDate) => void;
  setScrollOffset: (scrollOffset: number) => void;
  setReturnContext: (context: ReportReturnContext | null) => void;
}

export const useReportsViewState = create<ReportsViewState>((set) => ({
  selectedKind: 'monthly',
  anchorDate: new Date().toISOString().slice(0, 10) as LocalDate,
  scrollOffset: 0,
  returnContext: null,
  setPeriod: (selectedKind, anchorDate) => set({ selectedKind, anchorDate }),
  setScrollOffset: (scrollOffset) => set({ scrollOffset }),
  setReturnContext: (returnContext) => set({ returnContext })
}));
