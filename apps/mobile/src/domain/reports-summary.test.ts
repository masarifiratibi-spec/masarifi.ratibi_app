import { buildFinancialReport, resolveReportPeriod } from './reports';
import { makeTransaction, fixtureCategories } from '@/test-utils/core-finance-fixtures';

test('summary derives income, expense, net cash flow, and savings rate', () => {
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
      makeTransaction(11, { type: 'income', amountMinor: 10_000, occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' }),
      makeTransaction(1, { type: 'expense', amountMinor: 4_000, occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' })
    ]
  });

  expect(report.summary.income.value?.minorUnits).toBe(10_000);
  expect(report.summary.expense.value?.minorUnits).toBe(4_000);
  expect(report.summary.netCashFlow.value?.minorUnits).toBe(6_000);
  expect(report.summary.savingsRateBasisPoints.value).toBe(6000);
  expect(report.summary.comparisons[0].currentRange).toBe('2026-08-01 - 2026-08-09');
  expect(report.summary.comparisons[0].previousRange).toBe('2026-07-01 - 2026-07-09');
});

test('foreign-currency effects use one captured rate and retain original money', () => {
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
    exchangeRates: [{
      baseCurrencyCode: 'SAR',
      quoteCurrencyCode: 'USD',
      rate: 3.75,
      asOf: Date.UTC(2026, 7, 8),
      status: 'available'
    }],
    transactions: [
      makeTransaction(1, {
        type: 'expense',
        amountMinor: 100,
        currencyCode: 'USD',
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      })
    ]
  });

  expect(report.summary.expense).toMatchObject({
    status: 'estimated',
    value: { minorUnits: 375, currencyCode: 'SAR' },
    originalValues: [{ minorUnits: 100, currencyCode: 'USD' }]
  });
  expect(report.summary.netCashFlow.value?.minorUnits).toBe(-375);
});

test('missing conversion rates keep a labeled incomplete subtotal', () => {
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
    exchangeRates: [],
    transactions: [
      makeTransaction(1, { type: 'expense', amountMinor: 400, occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' }),
      makeTransaction(2, { type: 'expense', amountMinor: 100, currencyCode: 'USD', occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' })
    ]
  });

  expect(report.summary.expense).toMatchObject({
    status: 'incomplete',
    value: { minorUnits: 400, currencyCode: 'SAR' },
    reasons: ['missing_rate']
  });
  expect(report.summary.savingsRateBasisPoints).toEqual({
    status: 'unavailable',
    value: null,
    reason: 'missing_rate'
  });
});
