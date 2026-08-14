import type { ReportOutputPreviewInput } from '@/services/contracts/reports-service';
import { createMockReportsService } from './reports-service';

const previewInput = {
  kind: 'monthly' as const,
  anchorDate: '2026-08-09',
  currencyCode: 'SAR',
  timeZone: 'Asia/Riyadh',
  language: 'en' as const,
  detailLevel: 'summary' as const
} satisfies ReportOutputPreviewInput;

test('output operations are idempotent by operation id', async () => {
  const service = createMockReportsService();
  const preview = await service.previewOutput(previewInput);
  const first = await service.requestOutput(
    { kind: 'send_now', previewId: preview.previewId },
    'same-op'
  );
  const replay = await service.requestOutput(
    { kind: 'send_now', previewId: preview.previewId },
    'same-op'
  );

  expect(replay.value.id).toBe(first.value.id);

  await expect(
    service.requestOutput(
      { kind: 'retry', previousAttemptId: first.value.id },
      'retry-op'
    )
  ).rejects.toThrow('duplicate_request');
});

test('a failed output retries once with the original immutable snapshot', async () => {
  const service = createMockReportsService(undefined, {
    outputFailures: { 'failed-op': 'temporary' }
  });
  const preview = await service.previewOutput(previewInput);
  const failed = await service.requestOutput(
    { kind: 'send_now', previewId: preview.previewId },
    'failed-op'
  );

  expect(failed.value.status).toBe('failed');
  expect(failed.value.failureCategory).toBe('temporary');

  const retry = await service.requestOutput(
    { kind: 'retry', previousAttemptId: failed.value.id },
    'retry-op'
  );
  expect(retry.value.status).toBe('sent');
  expect(retry.value.retryOfAttemptId).toBe(failed.value.id);
  expect(retry.value.snapshot).toEqual(failed.value.snapshot);

  await expect(
    service.requestOutput(
      { kind: 'retry', previousAttemptId: failed.value.id },
      'second-retry-op'
    )
  ).rejects.toThrow('duplicate_request');
});

test('a late scheduled result records paused completion without reactivating the schedule', async () => {
  const service = createMockReportsService(undefined, { outputDelayMs: 20 });
  await service.verifyRecipient('reports@example.com', 'verify-op');
  const saved = await service.saveSchedule(
    {
      recipientEmail: 'reports@example.com',
      frequency: 'monthly',
      language: 'en',
      currencyCode: 'SAR',
      deliveryDay: 1,
      timeZone: 'Asia/Riyadh',
      includeAssistantSummary: false,
      detailLevel: 'summary'
    },
    null,
    'schedule-op'
  );
  await service.previewOutput(previewInput);

  const pending = service.requestOutput(
    {
      kind: 'scheduled',
      scheduleId: saved.value.id,
      scheduledFor: saved.value.nextDeliveryAt!
    },
    'late-op'
  );
  await service.setScheduleStatus('paused', saved.value.version, 'pause-op');

  const completed = await pending;
  expect(completed.value.scheduleStatusAtCompletion).toBe('paused');
  expect((await service.getSchedule())?.status).toBe('paused');
});
