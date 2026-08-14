import { assessment, proposalErrors } from './voice-capture';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';

it('blocks missing account and accepts confirmed uncertain fields', () => {
  const missing = fixtureProposalGroup({
    scenario: 'missing_account', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  expect(proposalErrors(missing)).toContain('account');

  const clear = fixtureProposalGroup({
    scenario: 'clear_en', sessionId: 's2', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  clear.assessments.push({ ...assessment('merchant', 70), confirmed: true });
  expect(proposalErrors(clear)).toEqual([]);
});
