import { FinancialPlanningError } from '@/domain/financial-planning';
import { createSeededFinancialPlanningService } from './financial-planning-service';
import { fixtureBudget, fixtureCategoryBudget, fixtureGoal, fixtureObligation } from './financial-planning-fixtures';

it('returns deterministic overview, empty-like reads, and scoped mutation results', async () => {
  const service = createSeededFinancialPlanningService();
  const overview = await service.getPlanningOverview({
    currencyCode: 'SAR',
    today: '2026-01-15'
  });
  expect(overview.dataState).toBe('ready');
  expect(overview.savings.length).toBe(1);

  const budget = await service.getBudget(fixtureBudget.periodKey);
  expect(budget?.budget.id).toBe(fixtureBudget.id);
  const copiedDraft = await service.createBudgetDraftFromPrevious('2026-02');
  expect(copiedDraft.payload).toMatchObject({
    copiedFromBudgetId: fixtureBudget.id,
    configuredExpenseLimitMinor: fixtureBudget.configuredExpenseLimitMinor
  });

  const saved = await service.saveBudget(
    {
      periodKey: '2026-02',
      currencyCode: 'SAR',
      configuredExpenseLimitMinor: 10_00,
      incomeTargetMinor: 20_00,
      savingsTargetMinor: 5_00,
      categories: [{ ...fixtureCategoryBudget, limitMinor: 5_00 }]
    },
    'op-budget-feb'
  );
  expect(saved.affectedScopes).toContain('planning.overview');
  expect((await service.getBudgetById(saved.value.id)).categories[0].budgetId).toBe(saved.value.id);
});

it('keeps previews side-effect free and confirms with operation IDs', async () => {
  const service = createSeededFinancialPlanningService();
  const before = await service.getObligation(fixtureObligation.id);
  const preview = await service.previewObligationPayment({
    obligationId: fixtureObligation.id,
    amountMinor: 250_00,
    currencyCode: 'SAR',
    paidDate: '2026-01-20',
    source: 'manual',
    transaction: { kind: 'link', transactionId: 'transaction-existing' }
  });
  expect((await service.getObligation(fixtureObligation.id)).payments).toEqual(
    before.payments
  );
  const confirmed = await service.confirmObligationPayment(
    preview.previewId,
    { allocations: preview.allocations, intent: 'current' },
    'op-confirm-payment'
  );
  expect(confirmed.value.payment.transactionOwnership).toBe('linked_existing');
  await expect(
    service.confirmObligationPayment('missing-preview', {
      allocations: [],
      intent: 'current'
    }, 'op-stale')
  ).rejects.toThrow(FinancialPlanningError);
});

it('keeps savings movements tracking-only', async () => {
  const service = createSeededFinancialPlanningService();
  const preview = await service.previewGoalMovement({
    goalId: fixtureGoal.id,
    kind: 'contribution',
    amountMinor: 250_00,
    movementDate: '2026-01-20'
  });
  const confirmed = await service.confirmGoalMovement(
    preview.previewId,
    'op-goal-contribution'
  );
  expect(confirmed.value.movement.linkedTransactionId).toBeNull();
  expect(confirmed.affectedScopes).toContain(`planning.goal.${fixtureGoal.id}`);
});

it('keeps assistant goal operation IDs idempotent and owner versions enforced', async () => {
  const service = createSeededFinancialPlanningService();
  const input = {
    title: 'Assistant emergency goal',
    targetMinor: 300_00,
    currencyCode: 'SAR',
    targetDate: '2026-12-31' as const,
    openingTrackedMinor: 0
  };

  const first = await service.createGoal(input, 'assistant-goal-op-1');
  const replay = await service.createGoal({ ...input, targetMinor: 999_00 }, 'assistant-goal-op-1');
  expect(replay.value).toEqual(first.value);
  expect((await service.listGoals({})).filter((goal) => goal.id === first.value.id)).toHaveLength(1);

  await service.updateGoal(first.value.id, first.value.version, { ...input, title: 'Owner reviewed goal' }, 'assistant-goal-update-1');
  await expect(
    service.updateGoal(first.value.id, first.value.version, { ...input, title: 'Stale assistant edit' }, 'assistant-goal-stale')
  ).rejects.toThrow(FinancialPlanningError);
});
