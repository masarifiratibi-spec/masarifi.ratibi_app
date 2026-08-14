import { buildFinancialReport, resolveReportPeriod } from './reports';
import { completeReportFixture, reportFixtureCategories } from '@/test-utils/report-fixtures';
import { makeTransaction } from '@/test-utils/core-finance-fixtures';
import { financialPlanningSeed, fixtureSalaryTransaction } from '@/test-utils/financial-planning-fixtures';

test('trend-ready reports keep month breakdown membership', () => {
  const period = resolveReportPeriod({
    kind: 'three_months',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: completeReportFixture
  });

  expect(report.breakdowns.find((item) => item.dimension === 'month')?.items.length).toBeGreaterThan(0);
});

test('reports compose planning-owned budget, obligation, savings, and salary breakdowns', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-01-15',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 0, 15, 12)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [fixtureSalaryTransaction],
    planning: {
      salaryReceipts: financialPlanningSeed.salaryReceipts,
      budgets: financialPlanningSeed.budgets,
      obligations: financialPlanningSeed.obligations,
      obligationPayments: financialPlanningSeed.payments,
      savingsGoals: financialPlanningSeed.savingsGoals,
      goalMovements: financialPlanningSeed.goalMovements,
      dataState: 'complete',
      completenessReasons: []
    }
  });

  expect(report.breakdowns.map((breakdown) => breakdown.dimension)).toEqual(
    expect.arrayContaining(['budget', 'obligation', 'savings', 'salary'])
  );
  expect(
    report.insights.find((insight) => insight.kind === 'budget_performance')?.value.value
  ).toMatchObject({
    minorUnits: financialPlanningSeed.budgets[0].configuredExpenseLimitMinor
  });
});

test.each([
  ['monthly', ['budget_performance', 'month_comparison']],
  ['three_months', ['average_monthly_expense', 'spending_volatility', 'recurring_payments']],
  ['half_year', ['highest_spending_month', 'lowest_spending_month', 'subscription_impact']],
  ['annual', ['salary_overview', 'debt_progress', 'savings_achievement', 'annual_mock_summary']]
] as const)('%s reports expose their required insight set', (kind, expectedKinds) => {
  const period = resolveReportPeriod({
    kind,
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [
      makeTransaction(1, { type: 'expense', occurredAt: Date.UTC(2026, 5, 8), reviewStatus: 'none' }),
      makeTransaction(2, { type: 'recurring_payment', occurredAt: Date.UTC(2026, 6, 8), reviewStatus: 'none' }),
      makeTransaction(3, { type: 'income', occurredAt: Date.UTC(2026, 7, 8), reviewStatus: 'none' })
    ]
  });

  expect(report.insights.map((insight) => insight.kind)).toEqual(
    expect.arrayContaining([...expectedKinds])
  );
});
