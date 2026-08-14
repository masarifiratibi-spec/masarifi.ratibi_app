import { buildFinancialReport, resolveReportPeriod } from './reports';
import { makeTransaction, fixtureCategories } from '@/test-utils/core-finance-fixtures';

test('confirmed records count once while review and conflict items mark partial data', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: fixtureCategories,
    transactions: [
      makeTransaction(1, { amountMinor: 1000, occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' }),
      makeTransaction(2, { amountMinor: 2000, occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'required' }),
      makeTransaction(3, { amountMinor: 3000, occurredAt: Date.UTC(2026, 7, 8), syncStatus: 'conflict' })
    ]
  });

  expect(report.summary.expense.value?.minorUnits).toBe(1000);
  expect(report.dataState).toBe('partial');
});
