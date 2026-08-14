import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureObligation } from '@/test-utils/financial-planning-fixtures';

it('lists details and lifecycle history for obligations', async () => {
  const service = createSeededFinancialPlanningService();
  const detail = await service.getObligation(fixtureObligation.id);
  expect(detail.schedule.length).toBeGreaterThan(0);
  const paused = await service.setObligationStatus(fixtureObligation.id, fixtureObligation.version, 'paused', 'op-obligation-pause');
  expect(paused.value.status).toBe('paused');
});
