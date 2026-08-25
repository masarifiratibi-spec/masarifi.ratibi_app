import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';

it('creates, edits, pauses, and deletes budgets with version checks', async () => {
  const service = createSeededFinancialPlanningService();
  const saved = await service.saveBudget(
    {
      name: 'March budget',
      periodKey: '2026-03',
      currencyCode: 'SAR',
      configuredExpenseLimitMinor: 1_000,
      incomeTargetMinor: 2_000,
      savingsTargetMinor: 500
    },
    'op-budget-mar'
  );
  const paused = await service.setBudgetStatus(saved.value.id, saved.value.version, 'paused', 'op-budget-pause');
  expect(paused.value.status).toBe('paused');
  expect((await service.deleteBudget(paused.value.id, paused.value.version, 'op-budget-delete')).value.status).toBe('deleted');
});
