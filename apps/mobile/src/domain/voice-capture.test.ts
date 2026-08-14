import {
  assessment,
  fieldStatusForConfidence,
  proposalErrors,
  resolveSpokenDate
} from './voice-capture';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';

it('maps clarified confidence boundaries', () => {
  expect(fieldStatusForConfidence(90)).toBe('clear');
  expect(fieldStatusForConfidence(89)).toBe('confirm');
  expect(fieldStatusForConfidence(60)).toBe('confirm');
  expect(fieldStatusForConfidence(59)).toBe('missing');
  expect(fieldStatusForConfidence(100, true)).toBe('conflict');
});

it('requires explicit confirmation and missing required values', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'clear_en',
    sessionId: 's1',
    recordedAt: Date.UTC(2026, 7, 9, 10),
    timezoneOffsetMinutes: -180
  }).proposals[0];
  proposal.assessments.push(assessment('merchant', 70));
  expect(proposalErrors(proposal)).toContain('merchant');
  proposal.assessments.at(-1)!.confirmed = true;
  expect(proposalErrors(proposal)).not.toContain('merchant');
});

it('resolves yesterday from recording timezone', () => {
  const result = resolveSpokenDate('yesterday', Date.UTC(2026, 7, 9, 1), -180);
  expect(new Date(result.value).getUTCDate()).toBe(8);
  expect(result.requiresConfirmation).toBe(false);
});
