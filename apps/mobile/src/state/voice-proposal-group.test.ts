import { VOICE_MAX_PROPOSALS } from '@/domain/voice-capture';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { useVoiceCaptureStore } from './voice-capture';

beforeEach(() => useVoiceCaptureStore.getState().reset());

it('limits a review group to ten independently selectable proposals', () => {
  const fixture = fixtureProposalGroup({
    scenario: 'multiple',
    sessionId: 'group-limit',
    recordedAt: Date.now(),
    timezoneOffsetMinutes: 0
  });
  useVoiceCaptureStore.getState().setGroup({
    ...fixture,
    proposals: Array.from({ length: VOICE_MAX_PROPOSALS + 2 }, (_, index) => ({
      ...fixture.proposals[index % fixture.proposals.length],
      id: `proposal-${index}`
    }))
  });

  expect(useVoiceCaptureStore.getState().group?.proposals).toHaveLength(VOICE_MAX_PROPOSALS);
  useVoiceCaptureStore.getState().selectAll(false);
  expect(useVoiceCaptureStore.getState().group?.proposals.every((item) => !item.selected)).toBe(true);
});
