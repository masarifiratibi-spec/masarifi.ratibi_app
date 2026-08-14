import { calculateBudgetProgress } from '@/domain/financial-planning';
import { fixtureBudget, fixtureSalaryTransaction, planningToday } from '@/test-utils/financial-planning-fixtures';

it('calculates large planning fixtures within a local interaction budget', () => {
  const transactions = Array.from({ length: 1_000 }, (_, index) => ({
    ...fixtureSalaryTransaction,
    id: `expense-${index}`,
    type: 'expense' as const,
    amountMinor: 100
  }));
  const started = Date.now();
  expect(
    calculateBudgetProgress({ budget: fixtureBudget, transactions, today: planningToday })
      .eligibleSpendMinor
  ).toMatchObject({ status: 'available', value: 100_000 });
  expect(Date.now() - started).toBeLessThan(300);
});
