import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VoiceCaptureProvider } from './VoiceCaptureRuntime';
import { useVoiceCapture } from './useVoiceCapture';
import { voiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import {
  fixtureProposalGroup,
  fixtureTranscript
} from '@/services/mocks/voice-fixtures';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { resetRuntimeUserData } from '@/storage/runtime-user-data-reset';
import { useVoiceCaptureStore } from '@/state/voice-capture';

it('clears temporary audio, transcript, and proposals at a terminal reset', () => {
  const store = useVoiceCaptureStore.getState();
  store.patch({
    audioReference: 'private://secret.m4a',
    transcript: fixtureTranscript('clear_en'),
    group: fixtureProposalGroup({
      scenario: 'clear_en',
      sessionId: store.id,
      recordedAt: Date.now(),
      timezoneOffsetMinutes: 0
    })
  });
  store.reset();
  expect(useVoiceCaptureStore.getState()).toMatchObject({
    audioReference: null,
    transcript: null,
    group: null
  });
});

it('clears runtime-owned recording resources and private review data on user reset', async () => {
  jest
    .spyOn(voiceRecorderService, 'getPermission')
    .mockResolvedValue('granted');
  jest
    .spyOn(voiceRecorderService, 'start')
    .mockResolvedValue({ id: 'recording-private', startedAt: Date.now() });
  jest.spyOn(voiceRecorderService, 'stop').mockResolvedValue({
    uri: 'private://secret.m4a',
    durationMs: 1000,
    contentType: 'audio/m4a',
    recordedAt: Date.now()
  });
  const cancel = jest.spyOn(voiceRecorderService, 'cancel').mockResolvedValue();
  const remove = jest.spyOn(voiceRecorderService, 'remove').mockResolvedValue();
  let release!: (value: ReturnType<typeof fixtureTranscript>) => void;
  jest.spyOn(voiceAnalyzerService, 'transcribe').mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  const { result, unmount } = renderHook(() => useVoiceCapture(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <VoiceCaptureProvider>{children}</VoiceCaptureProvider>
      </QueryClientProvider>
    )
  });
  await waitFor(() => expect(result.current.session.state).toBe('ready'));
  await act(async () => result.current.start());
  let stopping!: Promise<void>;
  act(() => {
    stopping = result.current.stop();
  });
  await waitFor(() => expect(release).toBeDefined());
  await act(async () => resetRuntimeUserData());
  release(fixtureTranscript('clear_en'));
  await act(async () => stopping);
  expect(cancel).toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith('private://secret.m4a');
  expect(useVoiceCaptureStore.getState()).toMatchObject({
    recordingId: null,
    audioReference: null,
    transcript: null,
    group: null
  });
  unmount();
  client.clear();
  jest.restoreAllMocks();
});
