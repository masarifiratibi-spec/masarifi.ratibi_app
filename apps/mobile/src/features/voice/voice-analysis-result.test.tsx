import { voiceBatchResultSchema } from '@/services/live/voice-batch-api-service';

const receipt = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  batchId: '22222222-2222-4222-8222-222222222222',
  status: 'completed',
  transactionIds: [],
  addedCount: 0,
  ledgerVersion: 0,
  analysis: {
    mode: 'analysis_only',
    persisted: false,
    expiresAt: '2099-10-05T00:00:00.000Z',
    events: [
      {
        ordinal: 0,
        kind: 'expense',
        amountMinor: 2500,
        currency: 'SAR',
        accountId: '33333333-3333-4333-8333-333333333333',
        categoryId: null,
        title: 'Breakfast',
        merchant: null,
        occurredAt: '2026-10-05T09:00:00.000Z'
      }
    ]
  }
};

it('accepts an explicit unsaved analysis result without inventing transaction IDs', () => {
  expect(voiceBatchResultSchema.parse(receipt)).toEqual(receipt);
});
it('rejects a financial receipt masquerading as nonposting analysis', () => {
  expect(
    voiceBatchResultSchema.safeParse({
      ...receipt,
      transactionIds: [receipt.sessionId],
      addedCount: 1
    }).success
  ).toBe(false);
  expect(
    voiceBatchResultSchema.safeParse({
      ...receipt,
      analysis: { ...receipt.analysis, persisted: true }
    }).success
  ).toBe(false);
});
