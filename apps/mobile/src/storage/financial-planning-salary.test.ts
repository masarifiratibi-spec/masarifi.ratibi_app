import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureSalaryProfile } from '@/test-utils/financial-planning-fixtures';

it('confirms, links, and undoes salary receipts idempotently', async () => {
  const service = createSeededFinancialPlanningService();
  const result = await service.confirmSalaryReceipt(
    {
      salaryProfileId: fixtureSalaryProfile.id,
      transactionId: 'salary-extra',
      expectedOccurrenceDate: '2026-02-28',
      receivedDate: '2026-02-28',
      timeZone: 'Asia/Riyadh'
    },
    'op-salary-extra'
  );
  expect(result.value.receipt.transactionId).toBe('salary-extra');
  expect(
    (
      await service.undoSalaryReceipt(
        result.value.receipt.id,
        'op-undo',
        'Asia/Riyadh'
      )
    ).value.receipt.status
  ).toBe('undone');
});
