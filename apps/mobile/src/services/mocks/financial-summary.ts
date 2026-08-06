/**
 * Deterministic financial summary fixtures.
 *
 * Each fixture exercises one acceptance scenario from User Story 1: populated,
 * empty, and partial data. Deterministic values keep panel tests stable and
 * prove the position panel communicates clarity in each state.
 */

import type { FinancialSummary } from '@/services/contracts/foundation-service';

function currency(
  amount: number,
  code: string,
  converted: number | null = null
) {
  return {
    currencyCode: code,
    originalAmount: amount,
    convertedAmount: converted,
    conversionAsOf: converted !== null ? Date.parse('2026-03-15') : null,
    isEstimated: converted !== null
  };
}

export const populatedSummary: FinancialSummary = {
  balance: currency(12450.75, 'SAR'),
  recentSpending: currency(3210.5, 'SAR'),
  nextObligation: {
    labelKey: 'obligation.rent',
    amount: currency(2500, 'SAR'),
    dueLabelKey: 'due.in3days'
  },
  reviewItemCount: 2,
  dataComplete: true,
  nextActionKey: 'position.empty.action'
};

export const emptySummary: FinancialSummary = {
  balance: currency(0, 'SAR'),
  recentSpending: currency(0, 'SAR'),
  nextObligation: null,
  reviewItemCount: 0,
  dataComplete: true,
  nextActionKey: 'position.empty.action'
};

export const partialSummary: FinancialSummary = {
  balance: currency(8200, 'SAR'),
  recentSpending: currency(0, 'SAR'),
  nextObligation: null,
  reviewItemCount: 1,
  dataComplete: false,
  nextActionKey: 'position.partial.action'
};

export const summaries = {
  populated: populatedSummary,
  empty: emptySummary,
  partial: partialSummary
};
