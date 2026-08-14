import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureGoal } from '@/test-utils/financial-planning-fixtures';

it('records savings movements without creating ledger effects', async () => {
  const service = createSeededFinancialPlanningService();
  const preview = await service.previewGoalMovement({
    goalId: fixtureGoal.id,
    kind: 'contribution',
    amountMinor: 100_00,
    movementDate: '2026-01-20'
  });
  const confirmed = await service.confirmGoalMovement(preview.previewId, 'op-saving-one');
  expect(confirmed.value.movement.linkedTransactionId).toBeNull();
});
