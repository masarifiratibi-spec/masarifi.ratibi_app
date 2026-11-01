import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { FoundationProviders } from './FoundationProviders';
import { useAppShellStore } from './app-shell';
import { usePreferenceStore } from './preferences';

const mockLoad = jest.fn();
const mockSave = jest.fn(async () => undefined);
jest.mock('@/config/demo-mode', () => ({
  isFixtureModeEnabled: () => false,
  isDemoModeEnabled: () => false
}));
jest.mock('@/storage/query-read-cache', () => ({
  createQueryReadCache: (current: unknown) => ({
    current,
    load: mockLoad,
    save: mockSave
  })
}));
jest.mock('expo-router', () => ({ usePathname: () => '/salary' }));

const key = ['planning', 'salary', '2026-10-29', 'Asia/Riyadh'];
const session = (userId: string) => ({
  status: 'authenticated' as const,
  userId,
  method: 'google' as const,
  restoration: 'restored' as const,
  issuedAt: 1,
  expiresAt: 9999999999999
});

it('wires owner-local hydration into the actual provider while the network is pending, then clears it synchronously on owner change', async () => {
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'ar',
    direction: 'rtl'
  });
  useAppShellStore.setState({
    hydrated: true,
    session: session('a'),
    privacyLock: {
      enabled: true,
      autoLockDuration: 'immediate',
      appLockStatus: 'unlocked'
    },
    logoutQuiescingOwnerId: null
  });
  mockLoad.mockImplementation(async (scope: { ownerId: string }) =>
    scope.ownerId === 'a'
      ? [{ key, data: { label: 'saved-owner-a' }, updatedAt: 100 }]
      : []
  );
  let release!: (value: { label: string }) => void;
  const network = jest.fn(
    () =>
      new Promise<{ label: string }>((resolve) => {
        release = resolve;
      })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  function View() {
    const query = useQuery({ queryKey: key, queryFn: network });
    return <Text>{query.data?.label ?? 'loading'}</Text>;
  }
  const result = render(
    <FoundationProviders client={client}>
      <View />
    </FoundationProviders>
  );
  try {
    expect(await screen.findByText('saved-owner-a')).toBeTruthy();
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(100);
    expect(network).toHaveBeenCalledTimes(1);
    await act(async () => {
      release({ label: 'server-owner-a' });
    });
    expect(await screen.findByText('server-owner-a')).toBeTruthy();
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        { ownerId: 'a', locale: 'ar' },
        expect.objectContaining({ data: { label: 'server-owner-a' } })
      )
    );
    act(() => {
      useAppShellStore.setState({ session: session('b') });
    });
    expect(client.getQueryData(key)).toBeUndefined();
    await waitFor(() =>
      expect(mockLoad).toHaveBeenCalledWith({ ownerId: 'b', locale: 'ar' })
    );
  } finally {
    result.unmount();
    client.clear();
  }
});

it('withdraws cached read models while the existing privacy gate is locked, preserving mutation state', async () => {
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  useAppShellStore.setState({
    hydrated: true,
    session: session('a'),
    privacyLock: {
      enabled: true,
      autoLockDuration: 'immediate',
      appLockStatus: 'unlocked'
    },
    logoutQuiescingOwnerId: null
  });
  mockLoad.mockClear();
  mockLoad.mockResolvedValue([
    { key, data: { label: 'owner-a-saved' }, updatedAt: 100 }
  ]);
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity },
      mutations: { gcTime: Infinity }
    }
  });
  client
    .getMutationCache()
    .build(client, {
      mutationKey: ['preserved'],
      mutationFn: async () => undefined
    });
  const view = render(
    <FoundationProviders client={client}>
      <Text>App</Text>
    </FoundationProviders>
  );
  try {
    await waitFor(() =>
      expect(client.getQueryData(key)).toEqual({ label: 'owner-a-saved' })
    );
    act(() => {
      useAppShellStore.setState({
        privacyLock: {
          enabled: true,
          autoLockDuration: 'immediate',
          appLockStatus: 'locked'
        }
      });
    });
    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(1);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    act(() => {
      useAppShellStore.setState({
        privacyLock: {
          enabled: true,
          autoLockDuration: 'immediate',
          appLockStatus: 'unlocked'
        }
      });
    });
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(client.getQueryData(key)).toEqual({ label: 'owner-a-saved' })
    );
  } finally {
    view.unmount();
    client.clear();
  }
});
