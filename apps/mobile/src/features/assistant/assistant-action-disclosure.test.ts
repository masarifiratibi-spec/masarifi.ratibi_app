import { buildAssistantActionDisclosure } from '@/domain/assistant-action-disclosure';
import {
  livePreview,
  samples,
  sampleTransaction
} from '@/test-utils/assistant-action-preview-fixtures';
it.each(samples)(
  'discloses every complete $kind effect with an accurate scope',
  (sample) => {
    const result = buildAssistantActionDisclosure(
      livePreview(sample),
      sample.context,
      'en'
    );
    expect(result.complete).toBe(true);
    expect(result.fields.length).toBeGreaterThan(5);
    expect(result.scopeKey).toMatch(/^assistant.actionPreview.scope\./);
  }
);

it('shows budget before/after values and explicitly discloses deletion', () => {
  const sample = samples[2];
  const result = buildAssistantActionDisclosure(
    livePreview(sample),
    sample.context,
    'en'
  );
  expect(result.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'status',
        before: 'active',
        value: 'deleted'
      }),
      expect.objectContaining({
        key: 'totalMinor',
        before: '250.00\u00a0SAR',
        value: '300.00\u00a0SAR'
      })
    ])
  );
});

it('shows tracking currency changes with both monetary units and inherited effects', () => {
  const sample = samples[5];
  expect(
    buildAssistantActionDisclosure(livePreview(sample), sample.context, 'en')
      .fields
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'amountMinor',
        before: '12.50\u00a0SAR',
        value: '12.50\u00a0USD'
      }),
      expect.objectContaining({ key: 'currency', before: 'SAR', value: 'USD' }),
      expect.objectContaining({
        key: 'title',
        value: 'Sample imported expense'
      })
    ])
  );
});

it('discloses the absolute tracking amount and fields actually persisted for transfers', () => {
  const sample = samples[5];
  const context = {
    target: {
      ...sample.context.target,
      proposedValues: {
        ...sample.context.target.proposedValues,
        kind: 'transfer',
        amountMinor: -1250,
        destinationAccountId: sampleTransaction.id,
        categoryId: sampleTransaction.id,
        merchant: 'Sample omitted merchant',
        paymentMethod: 'Sample omitted method'
      }
    }
  };
  const preview = {
    ...livePreview(sample),
    effect: { ...sample.effect, decision: 'accept', edit: {} }
  };
  const result = buildAssistantActionDisclosure(preview, context, 'en');
  expect(result.complete).toBe(true);
  expect(result.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'amountMinor', value: '12.50\u00a0SAR' }),
      expect.objectContaining({
        key: 'categoryId',
        before: sampleTransaction.id,
        value: null
      }),
      expect.objectContaining({
        key: 'merchant',
        before: 'Sample omitted merchant',
        value: null
      }),
      expect.objectContaining({
        key: 'paymentMethod',
        before: 'Sample omitted method',
        value: null
      }),
      expect.objectContaining({ key: 'feeMinor', value: '0.00\u00a0SAR' })
    ])
  );
});

it.each([
  undefined,
  { target: { ...sampleTransaction, version: 3 } },
  { target: { ...sampleTransaction, currency: undefined } },
  { target: { ...sampleTransaction, deletedAt: '2026-10-07T00:00:00Z' } }
])('blocks incomplete, stale or deleted update context', (context) => {
  expect(
    buildAssistantActionDisclosure(livePreview(samples[1]), context ?? {}, 'en')
      .complete
  ).toBe(false);
});

it('requires original timezone for transaction creation and does not substitute current settings', () => {
  expect(
    buildAssistantActionDisclosure(livePreview(samples[0]), {}, 'en').complete
  ).toBe(false);
});

it('blocks allocations with missing schedules, wrong currency or an inconsistent sum', () => {
  const sample = samples[4];
  for (const context of [
    { ...sample.context, schedule: [] },
    {
      ...sample.context,
      transaction: { ...sampleTransaction, currency: 'USD' }
    },
    {
      ...sample.context,
      transaction: { ...sampleTransaction, amountMinor: 1300 }
    }
  ])
    expect(
      buildAssistantActionDisclosure(livePreview(sample), context, 'en')
        .complete
    ).toBe(false);
});

it('computes partial allocation status from the due instant instead of a stale schedule label', () => {
  const sample = samples[4];
  const context = {
    ...sample.context,
    schedule: sample.context.schedule.map((row) => ({
      ...row,
      amountMinor: '3000',
      dueAt: '2000-01-01T00:00:00.000Z',
      status: 'due'
    }))
  };
  const disclosure = buildAssistantActionDisclosure(
    livePreview(sample),
    context,
    'en'
  );
  expect(disclosure.complete).toBe(true);
  expect(disclosure.fields).toContainEqual(
    expect.objectContaining({
      key: `allocation.${sampleTransaction.id}.status`,
      before: 'due',
      value: 'overdue'
    })
  );
});

it('discloses rejection without inventing a transaction and fails closed on unknown fields', () => {
  const sample = samples[5];
  const rejected = {
    ...livePreview(sample),
    effect: { ...sample.effect, decision: 'reject', edit: {} }
  };
  expect(
    buildAssistantActionDisclosure(rejected, sample.context, 'ar')
  ).toMatchObject({
    complete: true,
    scopeKey: 'assistant.actionPreview.scope.rejectReview'
  });
  expect(
    buildAssistantActionDisclosure(
      {
        ...livePreview(samples[3]),
        effect: { ...samples[3].effect, hidden: 'write' }
      },
      {},
      'en'
    ).complete
  ).toBe(false);
});
