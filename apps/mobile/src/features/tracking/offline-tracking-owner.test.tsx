import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppShellStore } from '@/state/app-shell';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { useTrackingHistory } from './useAutomaticTracking';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

it('refuses an old-owner response even when its query remains in memory during account switching', async () => {
  const previous = useAppShellStore.getState().session;
  const session = {
    userId: 'owner-a',
    method: 'google' as const,
    status: 'authenticated' as const,
    restoration: 'restored' as const,
    issuedAt: 1,
    expiresAt: 9999999999999
  };
  const page = (id: string) => ({
    items: [{ id }],
    nextCursor: null,
    total: 1
  });
  let finish!: (value: unknown) => void;
  const read = jest
    .spyOn(automaticTrackingService, 'listHistory')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        })
    )
    .mockResolvedValue(page('b') as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  useAppShellStore.setState({ session });
  const view = renderHook(useTrackingHistory, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  });
  try {
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    act(() =>
      useAppShellStore.setState({ session: { ...session, userId: 'owner-b' } })
    );
    await waitFor(() =>
      expect(view.result.current.data?.items[0]?.id).toBe('b')
    );
    await act(async () => finish(page('a')));
    await waitFor(() =>
      expect(
        client.getQueryState(
          automaticTrackingReadKey(automaticTrackingKeys.history(), 'owner-a')
        )?.error
      ).toMatchObject({ code: 'permission_required' })
    );
    expect(view.result.current.data?.items[0]?.id).toBe('b');
  } finally {
    view.unmount();
    client.clear();
    read.mockRestore();
    useAppShellStore.setState({ session: previous });
  }
});
