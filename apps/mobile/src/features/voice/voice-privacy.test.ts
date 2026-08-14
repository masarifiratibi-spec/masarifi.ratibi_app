import { fixtureProposalGroup, fixtureTranscript } from '@/services/mocks/voice-fixtures';
import { useVoiceCaptureStore } from '@/state/voice-capture';

it('clears temporary audio, transcript, and proposals at a terminal reset', () => {
  const store = useVoiceCaptureStore.getState();
  store.patch({
    audioReference: 'private://secret.m4a',
    transcript: fixtureTranscript('clear_en'),
    group: fixtureProposalGroup({
      scenario: 'clear_en', sessionId: store.id, recordedAt: Date.now(), timezoneOffsetMinutes: 0
    })
  });
  store.reset();
  expect(useVoiceCaptureStore.getState()).toMatchObject({
    audioReference: null, transcript: null, group: null
  });
});
