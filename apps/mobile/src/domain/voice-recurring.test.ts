import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';

it('keeps an obligation suggestion unconfirmed until user choice', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'obligation', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  expect(proposal.recurringSuggestion).toMatchObject({
    kind: 'existing_obligation', cadence: 'monthly', confirmed: false
  });
  expect(proposal.obligationId).toBeNull();
});
