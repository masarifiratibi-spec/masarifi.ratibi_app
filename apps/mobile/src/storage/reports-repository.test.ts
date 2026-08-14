import { buildSchedule } from '@/domain/reports';
import { ReportsRepository } from './reports-repository';

test('repository enforces singleton expected-version schedule updates', async () => {
  const repository = new ReportsRepository();
  const schedule = buildSchedule({
    recipientEmail: 'reports@example.com',
    frequency: 'monthly',
    language: 'en',
    currencyCode: 'SAR',
    deliveryDay: 1,
    timeZone: 'Asia/Riyadh',
    includeAssistantSummary: false,
    detailLevel: 'summary'
  }, null, 1);

  await repository.saveSchedule(schedule, null);
  await expect(repository.saveSchedule({ ...schedule, version: 2 }, null)).rejects.toThrow('conflict');
});

test('schedule edits preserve delivery history', async () => {
  const repository = new ReportsRepository();
  const schedule = buildSchedule({
    recipientEmail: 'reports@example.com',
    frequency: 'monthly',
    language: 'en',
    currencyCode: 'SAR',
    deliveryDay: 1,
    timeZone: 'Asia/Riyadh',
    includeAssistantSummary: false,
    detailLevel: 'summary'
  }, null, 1);
  await repository.saveSchedule({ ...schedule, lastSuccessfulAttemptId: 'attempt-1' }, null);

  const edited = await repository.saveSchedule({ ...schedule, version: 2, lastSuccessfulAttemptId: null }, 1);

  expect(edited.lastSuccessfulAttemptId).toBe('attempt-1');
});
