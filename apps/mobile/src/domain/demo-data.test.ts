import { createDemoTransactions } from './core-finance-seeds';
import { createDemoFinancialPlanningSeed } from './financial-planning-seeds';
import { createClientDemoData } from './demo-data';

const now = Date.UTC(2027, 1, 15, 12);

it('builds coherent demo finance and planning data for the current month', () => {
  const transactions = createDemoTransactions(now);
  const planning = createDemoFinancialPlanningSeed(now, 'Asia/Riyadh');

  expect(transactions).toHaveLength(9);
  expect(
    transactions.every(
      (transaction) =>
        new Date(transaction.occurredAt).toISOString().slice(0, 7) === '2027-02'
    )
  ).toBe(true);
  expect(planning.budgets).toEqual([
    expect.objectContaining({ id: 'demo-budget-current', periodKey: '2027-02' })
  ]);
  expect(planning.salaryReceipts).toEqual([
    expect.objectContaining({ transactionId: 'demo-transaction-1' })
  ]);
  expect(planning.categoryBudgets).toHaveLength(3);
  expect(planning.obligations).toHaveLength(1);
  expect(planning.scheduleItems.length).toBeGreaterThan(1);
  expect(planning.savingsGoals).toHaveLength(1);
  expect(planning.goalMovements).toHaveLength(1);
  expect(createClientDemoData(now).tracking.senders).toHaveLength(1);
});
