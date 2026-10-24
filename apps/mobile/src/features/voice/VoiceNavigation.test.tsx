import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAppShellStore } from '@/state/app-shell';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { VoiceCaptureProvider, useVoiceRuntime } from './VoiceCaptureRuntime';

let mockPathname = '/home';
const mockPathListeners = new Set<() => void>();
jest.mock('expo-router', () => ({
  usePathname: () => {
    const React = jest.requireActual('react');
    return React.useSyncExternalStore(
      (listener: () => void) => {
        mockPathListeners.add(listener);
        return () => mockPathListeners.delete(listener);
      },
      () => mockPathname
    );
  }
}));

beforeEach(() => {
  mockPathname = '/home';
  useAppShellStore.setState({ session: null });
  useVoiceCaptureStore.getState().reset();
  jest.spyOn(voiceRecorderService, 'cancel').mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
  useVoiceCaptureStore.getState().reset();
});

function navigate(pathname: string) {
  act(() => {
    mockPathname = pathname;
    mockPathListeners.forEach((listener) => listener());
  });
}

function renderRuntime() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  return renderHook(() => useVoiceRuntime(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <VoiceCaptureProvider>{children}</VoiceCaptureProvider>
      </QueryClientProvider>
    )
  });
}

it('does not broadcast a new Voice runtime for idle tab navigation, but still publishes capture state', () => {
  const { result, unmount } = renderRuntime();
  try {
    const runtime = result.current;
    navigate('/transactions');
    expect(result.current).toBe(runtime);
    expect(voiceRecorderService.cancel).not.toHaveBeenCalled();
    act(() =>
      useVoiceCaptureStore
        .getState()
        .patch({ state: 'failed', errorCode: 'permission_denied' })
    );
    expect(result.current.session.errorCode).toBe('permission_denied');
    expect(result.current).not.toBe(runtime);
  } finally {
    unmount();
  }
});

it.each(['recording', 'preparing'] as const)(
  'still interrupts %s when leaving the route',
  async (state) => {
    const { result, unmount } = renderRuntime();
    try {
      act(() =>
        useVoiceCaptureStore
          .getState()
          .patch({ state, recordingId: 'isolated-recording' })
      );
      navigate('/transactions');
      await waitFor(() =>
        expect(result.current.session).toMatchObject({
          state: 'failed',
          errorCode: 'recording_interrupted',
          recordingId: null
        })
      );
      expect(voiceRecorderService.cancel).toHaveBeenCalledWith(
        'isolated-recording'
      );
    } finally {
      unmount();
    }
  }
);

it('retains review state across route changes', () => {
  const { result, unmount } = renderRuntime();
  try {
    act(() =>
      useVoiceCaptureStore.getState().patch({ state: 'proposal_review' })
    );
    navigate('/transactions');
    expect(result.current.session.state).toBe('proposal_review');
    expect(voiceRecorderService.cancel).not.toHaveBeenCalled();
  } finally {
    unmount();
  }
});
