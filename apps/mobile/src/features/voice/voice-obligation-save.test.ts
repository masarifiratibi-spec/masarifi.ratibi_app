import { proposalToTransactionInput } from '@/domain/voice-capture';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { previewVoiceObligationEffect } from '@/services/mocks/voice-obligation-service';

it('requires the obligation link before producing its confirmed effect', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'obligation', sessionId: 'o', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  expect(proposal.recurringSuggestion?.confirmed).toBe(false);
  proposal.obligationId = 'car-installment';
  proposal.recurringSuggestion = { ...proposal.recurringSuggestion!, confirmed: true };
  expect(proposalToTransactionInput(proposal).obligationId).toBe('car-installment');
  expect(previewVoiceObligationEffect({
    obligationId: 'car-installment', amountMinor: proposal.amountMinor!, totalMinor: 1_000_000
  }).paidAfterMinor).toBe(proposal.amountMinor);
});
