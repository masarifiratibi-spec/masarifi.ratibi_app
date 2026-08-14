import {
  applyPaymentEarliestFirst,
  calculateBudgetProgress,
  deriveSavingsProgress,
  deriveSalaryCycle,
  expectedDateForMonth,
  FinancialPlanningError,
  frozenPositiveRollover,
  money,
  parseLocalDate,
  validateCategoryBudgets
} from './financial-planning';
import {
  fixtureBudget,
  fixtureCategoryBudget,
  fixtureGoal,
  fixtureMovement,
  fixturePayment,
  fixtureSalaryProfile,
  fixtureSalaryReceipt,
  fixtureSalaryTransaction,
  fixtureSchedule,
  planningToday
} from '@/test-utils/financial-planning-fixtures';

it('keeps local dates and integer minor-unit money explicit', () => {
  expect(expectedDateForMonth(2026, 2, 31)).toBe('2026-02-28');
  expect(expectedDateForMonth(2026, 13, 31)).toBe('2027-01-31');
  expect(parseLocalDate('2026-01-31')).toBe('2026-01-31');
  expect(money(0, 'SAR')).toEqual({
    minorUnits: 0,
    currencyCode: 'SAR',
    scale: 2
  });
  expect(() => money(1.5, 'SAR')).toThrow(FinancialPlanningError);
});

it('derives salary cycles from confirmed primary receipts only', () => {
  const cycle = deriveSalaryCycle({
    profile: fixtureSalaryProfile,
    receipts: [fixtureSalaryReceipt],
    transactions: [fixtureSalaryTransaction],
    today: planningToday
  });
  expect(cycle.startReceiptId).toBe(fixtureSalaryReceipt.id);
  expect(cycle.projectedNextSalaryDate).toBe('2026-01-31');
  expect(cycle.income.status).toBe('available');
  expect(cycle.suggestedDaily.status).toBe('available');
});

it('calculates budgets without double-counting transfers or missing rates', () => {
  const progress = calculateBudgetProgress({
    budget: fixtureBudget,
    transactions: [
      { ...fixtureSalaryTransaction, id: 'expense', type: 'expense', amountMinor: 100_00 },
      { ...fixtureSalaryTransaction, id: 'refund', type: 'refund', amountMinor: 25_00 },
      { ...fixtureSalaryTransaction, id: 'transfer', type: 'transfer', amountMinor: 500_00 }
    ],
    today: planningToday
  });
  expect(progress.eligibleSpendMinor).toMatchObject({
    status: 'available',
    value: 75_00
  });
  expect(
    calculateBudgetProgress({
      budget: fixtureBudget,
      transactions: [],
      missingRateTransactionIds: ['foreign'],
      today: planningToday
    }).state
  ).toBe('incomplete');
  expect(frozenPositiveRollover(1_000, 1_500)).toBe(0);
});

it('guards category allocations and allocates payments earliest first', () => {
  expect(() =>
    validateCategoryBudgets(fixtureBudget, [
      { ...fixtureCategoryBudget, limitMinor: 9_000_00 }
    ])
  ).toThrow(FinancialPlanningError);
  expect(
    applyPaymentEarliestFirst({
      amountMinor: 2_500_00,
      schedule: fixtureSchedule,
      payments: [],
      paidDate: planningToday
    })
  ).toEqual([
    { scheduleItemId: 'schedule-car-1', amountMinor: 2_000_00 },
    { scheduleItemId: 'schedule-car-2', amountMinor: 500_00 }
  ]);
});

it('keeps savings movements tracking-only and blocks excess withdrawal', () => {
  const progress = deriveSavingsProgress({
    goal: fixtureGoal,
    movements: [fixtureMovement],
    today: planningToday
  });
  expect(progress.currentMinor).toMatchObject({
    status: 'available',
    value: 5_500_00
  });
  expect(() =>
    deriveSavingsProgress({
      goal: fixtureGoal,
      movements: [{ ...fixtureMovement, kind: 'withdrawal', amountMinor: 9_000_00 }],
      today: planningToday
    })
  ).toThrow(FinancialPlanningError);
});

it('keeps lifecycle changes normalized instead of financial side effects', () => {
  expect(fixturePayment.transactionOwnership).toBe('created');
  expect(fixtureMovement.linkedTransactionId).toBeNull();
});
