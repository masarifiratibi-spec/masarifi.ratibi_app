import { deriveSalaryCycle } from './financial-planning';
import { fixtureSalaryProfile, fixtureSalaryReceipt, fixtureSalaryTransaction, planningToday } from '@/test-utils/financial-planning-fixtures';

it('covers salary receipt states and incomplete comparisons', () => {
  const cycle = deriveSalaryCycle({
    profile: fixtureSalaryProfile,
    receipts: [fixtureSalaryReceipt],
    transactions: [fixtureSalaryTransaction],
    today: planningToday
  });
  expect(cycle.salaryState).toBe('early');
  expect(cycle.previousCycleComparison.status).toBe('unavailable');
});
