import { buildFinancialReport, resolveReportPeriod } from './reports';
import {
  completeReportFixture,
  reportFixtureCategories
} from '@/test-utils/report-fixtures';
import { makeTransaction } from '@/test-utils/core-finance-fixtures';
import {
  financialPlanningSeed,
  fixtureSalaryTransaction
} from '@/test-utils/financial-planning-fixtures';

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

  expect(
    report.breakdowns.find((item) => item.dimension === 'month')?.items.length
  ).toBeGreaterThan(0);
});

test('month breakdown membership uses the report timezone', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-07-31',
    timeZone: 'America/New_York',
    now: Date.parse('2026-08-01T02:00:00.000Z')
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [
      makeTransaction(1, {
        occurredAt: Date.parse('2026-08-01T01:30:00.000Z'),
        reviewStatus: 'none'
      })
    ]
  });

  expect(
    report.breakdowns.find((breakdown) => breakdown.dimension === 'month')
      ?.items[0].id
  ).toBe('2026-07');
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
      categoryBudgets: financialPlanningSeed.categoryBudgets,
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
    report.insights.find((insight) => insight.kind === 'budget_performance')
      ?.value.value
  ).toMatchObject({
    minorUnits:
      financialPlanningSeed.budgets[0].configuredExpenseLimitMinor +
      financialPlanningSeed.budgets[0].rolloverCreditMinor
  });
});

test('monthly budget performance aggregates active budgets by assigned category', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const home = {
    ...financialPlanningSeed.budgets[0],
    id: 'budget-home',
    name: 'Home',
    periodKey: '2026-08',
    configuredExpenseLimitMinor: 1_000_00,
    rolloverCreditMinor: 0
  };
  const personal = {
    ...home,
    id: 'budget-personal',
    name: 'Personal'
  };
  const paused = {
    ...home,
    id: 'budget-paused',
    name: 'Travel',
    status: 'paused' as const
  };
  const categoryBudget = (
    budgetId: string,
    categoryId: string,
    id: string
  ) => ({
    ...financialPlanningSeed.categoryBudgets[0],
    id,
    budgetId,
    categoryId
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [
      makeTransaction(101, {
        type: 'expense',
        categoryId: 'housing',
        amountMinor: 200_00,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      }),
      makeTransaction(102, {
        type: 'expense',
        categoryId: 'food',
        amountMinor: 300_00,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      }),
      makeTransaction(103, {
        type: 'expense',
        categoryId: 'travel',
        amountMinor: 400_00,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      }),
      makeTransaction(104, {
        type: 'expense',
        categoryId: 'shopping',
        amountMinor: 500_00,
        occurredAt: Date.UTC(2026, 7, 8),
        reviewStatus: 'none'
      })
    ],
    planning: {
      salaryReceipts: [],
      budgets: [home, personal, paused],
      categoryBudgets: [
        categoryBudget(home.id, 'housing', 'category-home'),
        categoryBudget(personal.id, 'food', 'category-personal'),
        categoryBudget(paused.id, 'travel', 'category-paused')
      ],
      obligations: [],
      obligationPayments: [],
      savingsGoals: [],
      goalMovements: [],
      dataState: 'complete',
      completenessReasons: []
    }
  });

  expect(
    report.insights.find((insight) => insight.kind === 'budget_performance')
      ?.value.value
  ).toMatchObject({ minorUnits: 1_500_00 });
});

test('monthly budget performance converts foreign budget limits', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const usdBudget = {
    ...financialPlanningSeed.budgets[0],
    id: 'budget-usd',
    name: 'USD budget',
    periodKey: '2026-08',
    currencyCode: 'USD',
    configuredExpenseLimitMinor: 100_00,
    rolloverCreditMinor: 0
  };
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [],
    exchangeRates: [
      {
        baseCurrencyCode: 'SAR',
        quoteCurrencyCode: 'USD',
        rate: 3.75,
        asOf: Date.UTC(2026, 7, 9),
        status: 'available'
      }
    ],
    planning: {
      salaryReceipts: [],
      budgets: [usdBudget],
      categoryBudgets: [],
      obligations: [],
      obligationPayments: [],
      savingsGoals: [],
      goalMovements: [],
      dataState: 'complete',
      completenessReasons: []
    }
  });

  expect(
    report.insights.find((insight) => insight.kind === 'budget_performance')
      ?.value.value
  ).toMatchObject({ minorUnits: 375_00, currencyCode: 'SAR' });

  expect(
    buildFinancialReport({
      period,
      currencyCode: 'SAR',
      categories: reportFixtureCategories,
      transactions: [],
      planning: {
        salaryReceipts: [],
        budgets: [usdBudget],
        categoryBudgets: [],
        obligations: [],
        obligationPayments: [],
        savingsGoals: [],
        goalMovements: [],
        dataState: 'complete',
        completenessReasons: []
      }
    }).insights.find((insight) => insight.kind === 'budget_performance')?.value
      .status
  ).toBe('incomplete');
});

test.each([
  ['monthly', ['budget_performance', 'month_comparison']],
  [
    'three_months',
    ['average_monthly_expense', 'spending_volatility', 'recurring_payments']
  ],
  [
    'half_year',
    ['highest_spending_month', 'lowest_spending_month', 'subscription_impact']
  ],
  [
    'annual',
    [
      'salary_overview',
      'debt_progress',
      'savings_achievement',
      'annual_mock_summary'
    ]
  ]
] as const)(
  '%s reports expose their required insight set',
  (kind, expectedKinds) => {
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
        makeTransaction(1, {
          type: 'expense',
          occurredAt: Date.UTC(2026, 5, 8),
          reviewStatus: 'none'
        }),
        makeTransaction(2, {
          type: 'recurring_payment',
          occurredAt: Date.UTC(2026, 6, 8),
          reviewStatus: 'none'
        }),
        makeTransaction(3, {
          type: 'income',
          occurredAt: Date.UTC(2026, 7, 8),
          reviewStatus: 'none'
        })
      ]
    });

    expect(report.insights.map((insight) => insight.kind)).toEqual(
      expect.arrayContaining([...expectedKinds])
    );
  }
);
