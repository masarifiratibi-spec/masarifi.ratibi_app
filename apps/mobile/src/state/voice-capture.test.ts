import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { useVoiceCaptureStore } from './voice-capture';

beforeEach(() => useVoiceCaptureStore.getState().reset());

function multipleProposalGroup() {
  return fixtureProposalGroup({
    scenario: 'multiple', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
}

it('updates only the selected proposal', () => {
  const group = multipleProposalGroup();
  useVoiceCaptureStore.getState().setGroup(group);
  useVoiceCaptureStore.getState().updateProposal(group.proposals[1].id, {
    amountMinor: 710_000
  });

  expect(useVoiceCaptureStore.getState().group?.proposals.map((proposal) => proposal.amountMinor)).toEqual([
    4_000,
    710_000,
    50_000
  ]);
  expect(useVoiceCaptureStore.getState().group?.proposals.map((proposal) => proposal.status)).toEqual([
    'ready',
    'edited',
    'ready'
  ]);
});

it('removes one proposal without removing its siblings and clears terminal data', () => {
  const group = multipleProposalGroup();
  useVoiceCaptureStore.getState().setGroup(group);
  useVoiceCaptureStore.getState().removeProposal(group.proposals[0].id);
  expect(useVoiceCaptureStore.getState().group?.proposals[0].status).toBe('removed');
  expect(useVoiceCaptureStore.getState().group?.proposals[1].status).toBe('ready');
  expect(useVoiceCaptureStore.getState().group?.proposals[2].status).toBe('ready');
  useVoiceCaptureStore.getState().reset();
  expect(useVoiceCaptureStore.getState().transcript).toBeNull();
  expect(useVoiceCaptureStore.getState().group).toBeNull();
});
