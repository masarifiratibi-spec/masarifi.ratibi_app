import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VoiceCaptureProvider } from './VoiceCaptureRuntime';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { useAppShellStore } from '@/state/app-shell';
import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('@/services/voice-analyzer-service', () => ({
  voiceAnalyzerService: {
    metadata: { kind: 'live' },
    recoverPending: jest.fn(async () => null),
    recoverBatches: jest.fn(async () => ({
      results: [],
      pendingIds: [],
      uncertain: false,
      localFailure: false
    })),
    pausePending: jest.fn(),
    pauseBatches: jest.fn(),
    queueBatch: jest.fn()
  }
}));
jest.mock('@/services/platform/voice-recorder-service', () => ({
  voiceRecorderService: {
    getPermission: jest.fn(async () => 'not_requested'),
    requestPermission: jest.fn(),
    cancel: jest.fn(async () => undefined)
  }
}));
test('benchmark voice provider stays dormant on authenticated mount and unmount', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'benchmark-owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: Date.now() + 60000,
      restoration: 'restored'
    }
  });
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <VoiceCaptureProvider>{null}</VoiceCaptureProvider>
      </QueryClientProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    expect(voiceAnalyzerService.recoverPending).not.toHaveBeenCalled();
    expect(voiceAnalyzerService.recoverBatches).not.toHaveBeenCalled();
    expect(voiceAnalyzerService.pausePending).not.toHaveBeenCalled();
    expect(voiceAnalyzerService.pauseBatches).not.toHaveBeenCalled();
    expect(voiceRecorderService.getPermission).not.toHaveBeenCalled();
    expect(voiceRecorderService.requestPermission).not.toHaveBeenCalled();
    expect(voiceRecorderService.cancel).not.toHaveBeenCalled();
  } finally {
    restoreEnvironment();
    client.clear();
    useAppShellStore.setState({ session: null });
  }
});
