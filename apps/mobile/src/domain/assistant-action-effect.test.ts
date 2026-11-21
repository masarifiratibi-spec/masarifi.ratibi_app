import { hasCompleteAssistantEffect } from './assistant-action-effect';

const id = '99100000-0000-4000-8000-000000000001';
const effects: [string, Record<string, unknown>][] = [
  [
    'transaction.create',
    {
      amountMinor: '1250',
      currency: 'SAR',
      accountId: id,
      categoryId: null,
      date: '2026-10-07',
      merchant: null,
      note: null
    }
  ],
  [
    'transaction.update',
    {
      transactionId: id,
      expectedVersion: 2,
      reason: 'Sample correction',
      amountMinor: 1250
    }
  ],
  [
    'budget.update',
    { budgetId: id, expectedVersion: 2, patch: { totalMinor: '25000' } }
  ],
  [
    'savings_goal.create',
    { name: 'Sample goal', targetMinor: '50000', currencyCode: 'SAR' }
  ],
  [
    'obligation.payment.record',
    {
      obligationId: id,
      transactionId: id,
      expectedVersion: 2,
      paymentMethod: null,
      paymentCase: 'partial',
      allocationIntent: 'current',
      source: 'platform_assisted',
      allocations: [{ scheduleItemId: id, amountMinor: '1250' }]
    }
  ],
  [
    'tracking.review.resolve',
    {
      reviewId: id,
      decision: 'edit_accept',
      expectedVersion: 2,
      edit: { currency: 'USD' }
    }
  ]
];

it.each(effects)(
  'accepts complete %s effects and rejects omitted or hidden extra fields',
  (type, effect) => {
    expect(hasCompleteAssistantEffect(type, effect)).toBe(true);
    expect(hasCompleteAssistantEffect(type, {})).toBe(false);
    expect(
      hasCompleteAssistantEffect(type, { ...effect, hiddenEffect: 'sample' })
    ).toBe(false);
  }
);

it('rejects unsafe amounts and meaningless update effects', () => {
  expect(
    hasCompleteAssistantEffect('savings_goal.create', {
      name: 'Sample',
      targetMinor: '9007199254740993',
      currencyCode: 'SAR'
    })
  ).toBe(false);
  expect(
    hasCompleteAssistantEffect('transaction.update', {
      transactionId: id,
      expectedVersion: 2,
      reason: 'Sample'
    })
  ).toBe(false);
  expect(
    hasCompleteAssistantEffect('budget.update', {
      budgetId: id,
      expectedVersion: 2,
      patch: {}
    })
  ).toBe(false);
});
