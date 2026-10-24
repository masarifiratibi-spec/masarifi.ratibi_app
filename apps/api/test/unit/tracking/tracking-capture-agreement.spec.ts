import { captureEffectsAgree } from '../../../src/tracking/tracking-capture-agreement';

it.each(['refund', 'reversal'])(
  'does not reuse a %s for a different original transaction',
  (kind) => {
    const saved = {
      kind,
      amountMinor: 100,
      currency: 'AED',
      sourceAccountId: 'bank',
      originalTransactionId: 'purchase-a',
    };
    const observed = {
      kind: 'refund',
      amountMinor: 100,
      currency: 'AED',
      accountId: 'bank',
      originalTransactionId: 'purchase-b',
      classification: { subtype: kind, direction: 'incoming' },
    };
    expect(captureEffectsAgree(saved, observed)).toBe(false);
    expect(captureEffectsAgree(saved, { ...observed, originalTransactionId: 'purchase-a' })).toBe(
      true,
    );
  },
);
