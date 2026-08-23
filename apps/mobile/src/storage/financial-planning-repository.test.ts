import { FinancialPlanningError } from '@/domain/financial-planning';
import { FinancialPlanningRepository } from './financial-planning-repository';
import {
  financialPlanningSeed,
  fixtureBudget,
  fixtureGoal,
  fixtureMovement,
  fixturePlanningConflict,
  fixtureSalaryProfile,
  fixtureSalaryReceipt
} from '@/test-utils/financial-planning-fixtures';

it('stores salary, budget, obligation, payment, goal, draft, and conflict records', () => {
  const repository = new FinancialPlanningRepository(financialPlanningSeed);
  expect(repository.activeSalaryProfile()?.id).toBe(fixtureSalaryProfile.id);
  expect(repository.listSalaryReceipts()).toContainEqual(fixtureSalaryReceipt);
  expect(repository.getBudgetByPeriod(fixtureBudget.periodKey)?.id).toBe(
    fixtureBudget.id
  );
  expect(repository.listObligations().length).toBe(1);
  expect(repository.listPayments().length).toBe(1);
  expect(repository.listGoals()[0].id).toBe(fixtureGoal.id);
});

it('stores multiple named budgets in the same period', () => {
  const repository = new FinancialPlanningRepository();
  const first = repository.saveBudget(budgetInput('Home'), 'budget-home');
  const second = repository.saveBudget(
    budgetInput('Personal'),
    'budget-personal'
  );

  expect(
    repository.listBudgets('2032-08').map((budget) => budget.name)
  ).toEqual(['Home', 'Personal']);
  expect(first.id).not.toBe(second.id);
});

it('rejects stale budget edits and treats an empty period as scoped', () => {
  const repository = new FinancialPlanningRepository();
  const saved = repository.saveBudget(budgetInput('Home'), 'budget-home');

  expect(() =>
    repository.saveBudget(
      { ...budgetInput('Changed'), id: saved.id, expectedVersion: saved.version - 1 },
      'stale-budget-edit'
    )
  ).toThrow(FinancialPlanningError);
  expect(repository.listBudgets('')).toEqual([]);
});

it('rejects duplicate normalized budget names and category ownership', () => {
  const repository = new FinancialPlanningRepository();
  const home = repository.saveBudget(budgetInput('Home'), 'budget-home');
  repository.replaceCategoryBudgets(home.id, [
    {
      id: 'category-budget-home-housing',
      version: 1,
      syncStatus: 'pending',
      createdAt: 1,
      updatedAt: 1,
      budgetId: home.id,
      categoryId: 'housing',
      limitMinor: 1_000_00,
      alertThresholds: [80, 90, 100],
      status: 'active'
    }
  ]);

  expect(() =>
    repository.saveBudget(budgetInput(' home '), 'budget-duplicate')
  ).toThrow(FinancialPlanningError);
  expect(() =>
    repository.assertCategoriesAvailable('2032-08', ['housing'])
  ).toThrow(FinancialPlanningError);
  expect(() =>
    repository.assertCategoriesAvailable('2032-09', ['housing'])
  ).not.toThrow();
});

it('uses operation IDs for idempotent salary and goal movements', () => {
  const repository = new FinancialPlanningRepository(financialPlanningSeed);
  const first = repository.confirmSalaryReceipt(
    {
      salaryProfileId: fixtureSalaryProfile.id,
      transactionId: 'transaction-new-salary',
      expectedOccurrenceDate: '2026-02-28',
      receivedDate: '2026-02-28',
      operationId: 'op-new-salary',
      replacesReceiptId: null
    },
    'op-new-salary'
  );
  const second = repository.confirmSalaryReceipt(
    {
      ...first,
      transactionId: 'different-transaction'
    },
    'op-new-salary'
  );
  expect(second).toEqual(first);

  const movement = repository.saveGoalMovement(
    {
      ...fixtureMovement,
      amountMinor: 100_00,
      operationId: 'op-new-movement'
    },
    'op-new-movement'
  );
  expect(repository.saveGoalMovement(movement, 'op-new-movement')).toEqual(
    movement
  );
});

it('rejects stale versions and duplicate salary receipts', () => {
  const repository = new FinancialPlanningRepository(financialPlanningSeed);
  expect(() =>
    repository.setBudgetStatus(fixtureBudget.id, 99, 'paused', 'op-stale')
  ).toThrow(FinancialPlanningError);
  expect(() =>
    repository.confirmSalaryReceipt(
      {
        salaryProfileId: fixtureSalaryProfile.id,
        transactionId: fixtureSalaryReceipt.transactionId,
        expectedOccurrenceDate: '2026-01-31',
        receivedDate: '2026-01-31',
        operationId: 'op-duplicate',
        replacesReceiptId: null
      },
      'op-duplicate'
    )
  ).toThrow(FinancialPlanningError);
});

it('persists meaningful drafts in repository scope', () => {
  const repository = new FinancialPlanningRepository();
  repository.saveDraft({
    id: 'draft-budget',
    kind: 'budget',
    entityId: null,
    payload: { periodKey: '2026-02' },
    status: 'editing',
    updatedAt: 1
  });
  expect(repository.loadDraft('draft-budget')?.payload).toEqual({
    periodKey: '2026-02'
  });
  repository.discardDraft('draft-budget');
  expect(repository.loadDraft('draft-budget')).toBeNull();
});

it('preserves planning conflict candidates and rejects unsupported keep_both', () => {
  const repository = new FinancialPlanningRepository(financialPlanningSeed);

  expect(repository.requireConflict(fixturePlanningConflict.id)).toMatchObject({
    localSnapshot: fixturePlanningConflict.localSnapshot,
    laterSnapshot: fixturePlanningConflict.laterSnapshot,
    status: 'pending',
    resolution: null
  });
  expect(() =>
    repository.resolveConflict(fixturePlanningConflict.id, 'keep_both' as never)
  ).toThrow(FinancialPlanningError);
  expect(repository.requireConflict(fixturePlanningConflict.id)).toMatchObject({
    status: 'pending',
    resolution: null
  });

  expect(repository.resolveConflict(fixturePlanningConflict.id, 'keep_later')).toEqual(
    fixturePlanningConflict.laterSnapshot
  );
  expect(repository.requireConflict(fixturePlanningConflict.id)).toMatchObject({
    localSnapshot: fixturePlanningConflict.localSnapshot,
    laterSnapshot: fixturePlanningConflict.laterSnapshot,
    status: 'resolved',
    resolution: 'keep_later'
  });
});

function budgetInput(name: string) {
  return {
    name,
    periodKey: '2032-08',
    currencyCode: 'SAR',
    configuredExpenseLimitMinor: 5_000_00,
    incomeTargetMinor: 0,
    savingsTargetMinor: 0,
    rolloverEnabled: false,
    rolloverCreditMinor: 0,
    copiedFromBudgetId: null
  };
}
