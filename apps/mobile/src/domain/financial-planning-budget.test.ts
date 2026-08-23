import { calculateBudgetProgress, frozenPositiveRollover } from './financial-planning';
import { fixtureBudget, fixtureSalaryTransaction, planningToday } from '@/test-utils/financial-planning-fixtures';

it('covers budget eligibility, thresholds, rollover, zero values, and missing FX', () => {
  expect(
    calculateBudgetProgress({
      budget: fixtureBudget,
      transactions: [{ ...fixtureSalaryTransaction, type: 'expense', amountMinor: 5_500_00 }],
      today: planningToday
    }).state
  ).toBe('exceeded');
  expect(frozenPositiveRollover(1_000_00, 750_00)).toBe(250_00);
  expect(
    calculateBudgetProgress({
      budget: { ...fixtureBudget, configuredExpenseLimitMinor: 0, rolloverCreditMinor: 0 },
      transactions: [],
      today: planningToday
    }).percentage.status
  ).toBe('unavailable');
});

it('counts only transactions assigned to the budget categories', () => {
  const progress = calculateBudgetProgress({
    budget: fixtureBudget,
    transactions: [
      {
        ...fixtureSalaryTransaction,
        id: 'expense-housing',
        type: 'expense',
        categoryId: 'housing',
        amountMinor: 400_00
      },
      {
        ...fixtureSalaryTransaction,
        id: 'expense-food',
        type: 'expense',
        categoryId: 'food',
        amountMinor: 900_00
      }
    ],
    categoryIds: ['housing'],
    today: planningToday
  });

  expect(progress.eligibleSpendMinor).toMatchObject({
    status: 'available',
    value: 400_00
  });
});
