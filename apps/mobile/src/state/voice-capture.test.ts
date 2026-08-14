import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { useVoiceCaptureStore } from './voice-capture';

beforeEach(() => useVoiceCaptureStore.getState().reset());

it('keeps proposal edits independent and clears terminal data', () => {
  const group = fixtureProposalGroup({
    scenario: 'multiple', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  useVoiceCaptureStore.getState().setGroup(group);
  useVoiceCaptureStore.getState().removeProposal(group.proposals[0].id);
  expect(useVoiceCaptureStore.getState().group?.proposals[0].status).toBe('removed');
  expect(useVoiceCaptureStore.getState().group?.proposals[1].status).toBe('ready');
  useVoiceCaptureStore.getState().reset();
  expect(useVoiceCaptureStore.getState().transcript).toBeNull();
  expect(useVoiceCaptureStore.getState().group).toBeNull();
});
