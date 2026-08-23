import { buildFinancialReport, resolveReportPeriod } from './reports';
import {
  makeTransaction,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';

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
      makeTransaction(11, {
        type: 'income',
        amountMinor: 10_000,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      }),
      makeTransaction(1, {
        type: 'expense',
        amountMinor: 4_000,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      })
    ]
  });

  expect(report.summary.income.value?.minorUnits).toBe(10_000);
  expect(report.summary.expense.value?.minorUnits).toBe(4_000);
  expect(report.summary.netCashFlow.value?.minorUnits).toBe(6_000);
  expect(report.summary.savingsRateBasisPoints.value).toBe(6000);
  expect(report.summary.comparisons[0].currentRange).toBe(
    '2026-08-01 - 2026-08-09'
  );
  expect(report.summary.comparisons[0].previousRange).toBe(
    '2026-07-01 - 2026-07-09'
  );
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
    exchangeRates: [
      {
        baseCurrencyCode: 'SAR',
        quoteCurrencyCode: 'USD',
        rate: 3.75,
        asOf: Date.UTC(2026, 7, 8),
        status: 'available'
      }
    ],
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
      makeTransaction(1, {
        type: 'expense',
        amountMinor: 400,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      }),
      makeTransaction(2, {
        type: 'expense',
        amountMinor: 100,
        currencyCode: 'USD',
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      })
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

test('summary reuses canonical refund, reversal, transfer, and pending effects', () => {
  const occurredAt = Date.UTC(2026, 7, 8);
  const originalExpense = makeTransaction(1, {
    id: 'expense',
    amountMinor: 100,
    occurredAt,
    reviewStatus: 'none'
  });
  const originalIncome = makeTransaction(2, {
    id: 'income',
    type: 'income',
    amountMinor: 200,
    occurredAt,
    reviewStatus: 'none'
  });
  const report = buildFinancialReport({
    period: resolveReportPeriod({
      kind: 'monthly',
      anchorDate: '2026-08-09',
      timeZone: 'Asia/Riyadh',
      now: Date.UTC(2026, 7, 9, 12)
    }),
    currencyCode: 'SAR',
    categories: fixtureCategories,
    transactions: [
      originalExpense,
      originalIncome,
      makeTransaction(3, {
        id: 'refund',
        type: 'refund',
        amountMinor: 40,
        originalTransactionId: originalExpense.id,
        occurredAt,
        reviewStatus: 'none'
      }),
      makeTransaction(4, {
        id: 'reversal',
        type: 'reversal',
        amountMinor: 200,
        originalTransactionId: originalIncome.id,
        occurredAt,
        reviewStatus: 'none'
      }),
      makeTransaction(5, {
        type: 'transfer',
        destinationAccountId: 'account-wallet',
        feeMinor: 5,
        occurredAt,
        reviewStatus: 'none'
      }),
      makeTransaction(6, {
        amountMinor: 500,
        status: 'pending',
        occurredAt,
        reviewStatus: 'none'
      }),
      makeTransaction(7, {
        id: 'duplicate-reversal',
        type: 'reversal',
        amountMinor: 200,
        originalTransactionId: originalIncome.id,
        occurredAt: occurredAt + 1,
        reviewStatus: 'none'
      })
    ]
  });

  expect(report.summary.income.value?.minorUnits).toBe(0);
  expect(report.summary.expense.value?.minorUnits).toBe(60);
  expect(report.summary.netCashFlow.value?.minorUnits).toBe(-60);
});
