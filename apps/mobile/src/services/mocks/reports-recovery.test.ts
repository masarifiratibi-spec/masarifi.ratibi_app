import { createMockReportsService } from './reports-service';

test('draft recovery keeps schedule edits until discard', async () => {
  const service = createMockReportsService();
  await service.saveScheduleDraft({
    id: 'report_schedule',
    baseVersion: null,
    status: 'editing',
    updatedAt: 1,
    payload: {
      recipientEmail: 'draft@example.com',
      frequency: 'annual',
      language: 'en',
      currencyCode: 'SAR',
      deliveryDay: 1,
      timeZone: 'Asia/Riyadh',
      includeAssistantSummary: false,
      detailLevel: 'summary'
    }
  });

  expect((await service.loadScheduleDraft())?.payload.recipientEmail).toBe('draft@example.com');
  await service.discardScheduleDraft();
  expect(await service.loadScheduleDraft()).toBeNull();
});
