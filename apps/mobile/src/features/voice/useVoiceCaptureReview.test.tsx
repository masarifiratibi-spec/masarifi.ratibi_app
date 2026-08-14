import { proposalErrors } from '@/domain/voice-capture';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';

it('preserves a proposal while the user resolves uncertainty', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'low_confidence', sessionId: 'review', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  expect(proposalErrors(proposal)).toEqual(['amount']);
  proposal.assessments = proposal.assessments.map((item) =>
    item.status === 'confirm' ? { ...item, confirmed: true } : item
  );
  expect(proposalErrors(proposal)).toEqual([]);
});
