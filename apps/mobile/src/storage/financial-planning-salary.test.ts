import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureSalaryProfile, fixtureObligation } from '@/test-utils/financial-planning-fixtures';

it('archives only the reviewed versions, preserves payments and replays the same operation', async () => {
  const service = createSeededFinancialPlanningService();
  const salary = (await service.getSalaryProfile())!;
  await expect(service.archiveSalaryProfile(salary.id, salary.version + 1, 'stale')).rejects.toBeDefined();
  const first = await service.archiveSalaryProfile(salary.id, salary.version, 'archive-salary');
  expect(first.value.status).toBe('archived');
  expect(await service.archiveSalaryProfile(salary.id, salary.version, 'archive-salary')).toEqual(first);
  await expect(service.getSalaryProfile()).resolves.toBeNull();
  const detail = await service.getObligation(fixtureObligation.id);
  const archive = () => service.setObligationStatus(detail.obligation.id, detail.obligation.version, 'archived', 'archive-obligation');
  const archived = await archive();
  expect(archived.value.status).toBe('archived');
  expect(await archive()).toEqual(archived);
  expect((await service.getObligation(fixtureObligation.id)).payments).toEqual(detail.payments);
});

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
