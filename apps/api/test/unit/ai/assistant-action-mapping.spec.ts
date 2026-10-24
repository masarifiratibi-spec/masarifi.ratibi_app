import { AiService } from '../../../src/ai/ai.service';

it('maps an assistant transaction to platform assistance on the owner local date', async () => {
  const previewId = '99000000-0000-4000-8000-000000000011';
  const resourceId = '99000000-0000-4000-8000-000000000012';
  const accountId = '99000000-0000-4000-8000-000000000013';
  const repository = {
    operationId: () => 'operation',
    getPreviewTimezone: () => Promise.resolve('Asia/Riyadh'),
    claimAction: jest.fn(() =>
      Promise.resolve({
        actionType: 'transaction.create',
        payload: {
          amountMinor: '1250',
          currency: 'SAR',
          accountId,
          categoryId: null,
          date: '2026-10-07',
          merchant: null,
          note: null,
        },
        decisionToken: 'fence',
      }),
    ),
    completeAction: jest.fn(() => Promise.resolve({})),
  };
  const ledger = { createTransaction: jest.fn(() => Promise.resolve({ id: resourceId })) };
  const tools = { getOwnerTimezone: () => Promise.reject(new Error('OWNER_TIMEZONE_CHANGED')) };
  const service = new AiService(
    repository as never,
    {} as never,
    ledger as never,
    {} as never,
    {} as never,
    tools as never,
    {} as never,
  );
  await service.confirmPreview(
    { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 },
    previewId,
    { expectedVersion: 3 },
    'assistant-confirm-test-key',
  );
  expect(ledger.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({
      idempotencyKey: `ai-action:${previewId}:v3`,
      body: expect.objectContaining({
        source: 'platform_assisted',
        externalRef: 'assistant:operation',
        occurredAt: '2026-10-07T09:00:00.000Z',
      }) as unknown,
    }),
  );
  expect(repository.completeAction).toHaveBeenCalledWith(
    expect.anything(),
    previewId,
    'fence',
    resourceId,
  );
});
