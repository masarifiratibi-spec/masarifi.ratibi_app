import { createMockReportsService } from './reports-service';
import type { ReportScheduleInput } from '@/domain/reports';
import { ReportsRepository } from '@/storage/reports-repository';

test('schedule save, pause, and resume preserve versioned state', async () => {
  const service = createMockReportsService();
  const input: ReportScheduleInput = {
    recipientEmail: 'reports@example.com',
    frequency: 'monthly',
    language: 'en',
    currencyCode: 'SAR',
    deliveryDay: 1,
    timeZone: 'Asia/Riyadh',
    includeAssistantSummary: false,
    detailLevel: 'summary'
  };
  const unverified = await service.saveSchedule(input, null, 'save-unverified');
  expect(unverified.value.status).toBe('verification_required');

  await service.verifyRecipient(input.recipientEmail, 'verify');
  const saved = await service.saveSchedule(input, unverified.value.version, 'save');
  expect(saved.value.status).toBe('active');

  const paused = await service.setScheduleStatus('paused', saved.value.version, 'pause');
  expect(paused.value.status).toBe('paused');
  expect(paused.value.nextDeliveryAt).toBeNull();

  const resumed = await service.setScheduleStatus('active', paused.value.version, 'resume');
  expect(resumed.value.status).toBe('active');
  expect(resumed.value.nextDeliveryAt).not.toBeNull();
});

test('verified recipient remains trusted after service restart', async () => {
  const repository = new ReportsRepository();
  const first = createMockReportsService(repository);
  const input: ReportScheduleInput = {
    recipientEmail: 'reports@example.com',
    frequency: 'monthly',
    language: 'en',
    currencyCode: 'SAR',
    deliveryDay: 1,
    timeZone: 'Asia/Riyadh',
    includeAssistantSummary: false,
    detailLevel: 'summary'
  };
  await first.verifyRecipient(input.recipientEmail, 'verify');
  const saved = await first.saveSchedule(input, null, 'save');

  const restarted = createMockReportsService(repository);
  const edited = await restarted.saveSchedule({ ...input, deliveryDay: 2 }, saved.value.version, 'edit');

  expect(edited.value.status).toBe('active');
  expect(edited.value.recipient.status).toBe('verified');
});
