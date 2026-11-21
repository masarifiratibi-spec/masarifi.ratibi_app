import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { assistantKeys, useAssistantInsights } from './assistant-queries';

const mockTransport = jest.fn(
  async (..._args: unknown[]) =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ items: [] })
    }) as Response
);

jest.mock('@/services/assistant-service', () => {
  const { createLiveAssistantApiService } = jest.requireActual(
    '@/services/live/assistant-api-service'
  );
  return {
    assistantService: createLiveAssistantApiService({
      baseUrl: 'https://inert.invalid',
      identity: async () => ({
        userId: 'insights-owner',
        token: 'fixture-token',
        assertCurrent: async () => undefined
      }),
      request: (...args: unknown[]) => mockTransport(...args)
    })
  };
});

test('personal insights wait for consent and load when the consent query becomes enabled', async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity }
    }
  });
  client.setQueryData(assistantKeys.consent(), {
    status: 'disabled',
    version: 1
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useAssistantInsights(), { wrapper });
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockTransport).not.toHaveBeenCalled();
    act(() => {
      client.setQueryData(assistantKeys.consent(), {
        status: 'enabled',
        version: 2
      });
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toEqual([]);
    expect(mockTransport).toHaveBeenCalledTimes(1);
  } finally {
    hook.unmount();
    client.clear();
  }
});
