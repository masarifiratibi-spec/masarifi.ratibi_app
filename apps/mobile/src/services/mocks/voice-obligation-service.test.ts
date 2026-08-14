import { previewVoiceObligationEffect } from './voice-obligation-service';

it('previews a bounded obligation payment without mutating a ledger', () => {
  expect(previewVoiceObligationEffect({
    obligationId: 'car', amountMinor: 250_000, paidBeforeMinor: 500_000, totalMinor: 1_000_000
  })).toEqual({
    obligationId: 'car', paidBeforeMinor: 500_000, paidAfterMinor: 750_000, remainingAfterMinor: 250_000
  });
});
