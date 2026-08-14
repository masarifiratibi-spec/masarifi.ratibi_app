import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureObligation } from '@/test-utils/financial-planning-fixtures';

it('confirms one payment record per operation and can undo it', async () => {
  const service = createSeededFinancialPlanningService();
  const preview = await service.previewObligationPayment({
    obligationId: fixtureObligation.id,
    amountMinor: 100_00,
    currencyCode: 'SAR',
    paidDate: '2026-01-20',
    source: 'manual',
    transaction: { kind: 'link', transactionId: 'tx-payment-one' }
  });
  const confirmed = await service.confirmObligationPayment(preview.previewId, { allocations: preview.allocations, intent: 'current' }, 'op-payment-one');
  expect((await service.reverseObligationPayment(confirmed.value.payment.id, 'op-payment-undo')).value.payment.status).toBe('undone');
});
