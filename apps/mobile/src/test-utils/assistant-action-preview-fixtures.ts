import type { AssistantActionPreview } from '@/domain/assistant';
export const sampleId = '99100000-0000-4000-8000-000000000001';
export const sampleTransaction = {
  id: sampleId,
  version: 2,
  deletedAt: null,
  status: 'confirmed',
  kind: 'expense',
  amountMinor: 1250,
  currency: 'SAR',
  sourceAccountId: sampleId,
  categoryId: null,
  title: 'Sample expense',
  merchant: null,
  paymentMethod: null,
  note: null,
  occurredAt: '2026-10-07T09:00:00.000Z'
};
export const samples = [
  {
    kind: 'create_transaction',
    effect: {
      amountMinor: '-1250',
      currency: 'SAR',
      accountId: sampleId,
      categoryId: null,
      date: '2026-10-07',
      merchant: null,
      note: null
    },
    context: { timezone: 'Asia/Riyadh' }
  },
  {
    kind: 'update_transaction',
    effect: {
      transactionId: sampleId,
      expectedVersion: 2,
      reason: 'Sample correction',
      amountMinor: 1300,
      note: 'Sample edit'
    },
    context: { target: sampleTransaction }
  },
  {
    kind: 'update_budget',
    effect: {
      budgetId: sampleId,
      expectedVersion: 2,
      patch: { status: 'deleted', totalMinor: '30000' }
    },
    context: {
      target: {
        id: sampleId,
        version: 2,
        deletedAt: null,
        name: 'Sample budget',
        currencyCode: 'SAR',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        totalMinor: '25000',
        incomeTargetMinor: '0',
        savingsTargetMinor: '0',
        rolloverEnabled: false,
        rolloverMinor: '0',
        status: 'active'
      }
    }
  },
  {
    kind: 'create_goal',
    effect: {
      name: 'Sample goal',
      targetMinor: '50000',
      currencyCode: 'KWD',
      openingTrackedMinor: '1250'
    },
    context: {}
  },
  {
    kind: 'record_obligation_payment',
    effect: {
      obligationId: sampleId,
      transactionId: sampleId,
      expectedVersion: 2,
      paymentMethod: null,
      paymentCase: 'full',
      allocationIntent: 'current',
      source: 'platform_assisted',
      allocations: [{ scheduleItemId: sampleId, amountMinor: '1250' }]
    },
    context: {
      target: {
        id: sampleId,
        version: 2,
        deletedAt: null,
        status: 'active',
        name: 'Sample obligation',
        currencyCode: 'SAR',
        direction: 'payable'
      },
      transaction: sampleTransaction,
      schedule: [
        {
          id: sampleId,
          obligationId: sampleId,
          dueAt: '2026-10-07T00:00:00.000Z',
          amountMinor: '2500',
          paidMinor: '1250',
          status: 'partial'
        }
      ]
    }
  },
  {
    kind: 'resolve_tracking_review',
    effect: {
      reviewId: sampleId,
      expectedVersion: 2,
      decision: 'edit_accept',
      edit: { currency: 'USD' }
    },
    context: {
      target: {
        id: sampleId,
        version: 2,
        status: 'pending',
        proposedValues: {
          kind: 'expense',
          amountMinor: 1250,
          currency: 'SAR',
          accountId: sampleId,
          categoryId: null,
          occurredAt: '2026-10-07T09:00:00.000Z',
          title: 'Sample imported expense',
          merchant: null,
          paymentMethod: null,
          note: null
        }
      }
    }
  }
] as const;

export function livePreview(
  sample: (typeof samples)[number]
): AssistantActionPreview {
  return {
    kind: sample.kind,
    effect: sample.effect,
    id: sampleId,
    responseId: sampleId,
    input: sample.kind === 'create_goal'
      ? { amountMinor: Number(sample.effect.targetMinor), currency: sample.effect.currencyCode }
      : sample.kind === 'create_transaction'
        ? { amountMinor: Number(sample.effect.amountMinor), currency: sample.effect.currency }
        : {},
    affectedDestination: { kind: 'transactions' },
    sourceVersions: [{ id: 'EVIDENCE-1', version: 2 }],
    confirmationAllowed: true,
    status: 'ready',
    version: 3,
    operationId: null,
    expiresAt: Date.UTC(2027, 0, 1),
    resultReference: null,
    safeFailure: null
  } as AssistantActionPreview;
}
