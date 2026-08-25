import { fixtureProposalGroup, fixtureTranscript } from '@/services/mocks/voice-fixtures';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { resetRuntimeUserData } from '@/storage/runtime-user-data-reset';
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

it('clears retained voice data and temporary recording resources during a runtime reset', async () => {
  const cancel = jest.spyOn(voiceRecorderService, 'cancel').mockResolvedValue();
  const remove = jest.spyOn(voiceRecorderService, 'remove').mockResolvedValue();
  const store = useVoiceCaptureStore.getState();
  store.patch({
    state: 'proposal_review',
    recordingId: 'recording-private',
    audioReference: 'private://secret.m4a',
    transcript: fixtureTranscript('clear_en'),
    group: fixtureProposalGroup({
      scenario: 'clear_en', sessionId: store.id, recordedAt: Date.now(), timezoneOffsetMinutes: 0
    })
  });

  await resetRuntimeUserData();

  expect(cancel).toHaveBeenCalledWith('recording-private');
  expect(remove).toHaveBeenCalledWith('private://secret.m4a');
  expect(useVoiceCaptureStore.getState()).toMatchObject({
    state: 'idle', recordingId: null, audioReference: null, transcript: null, group: null
  });
});
