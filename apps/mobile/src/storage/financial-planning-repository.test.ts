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
