import React from 'react';
import { Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { FoundationProviders } from './FoundationProviders';
import { useAppShellStore } from './app-shell';
import { usePreferenceStore } from './preferences';
import { InitialHomeLoadingBoundary } from '@/features/shell/InitialHomeLoadingBoundary';
import {
  useHomeBalanceSummary,
  coreFinanceKeys
} from '@/features/core-finance/core-finance-queries';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';

afterEach(() => jest.restoreAllMocks());

const mockLoad = jest.fn();
const mockSave = jest.fn(async () => undefined);
jest.mock('@/config/demo-mode', () => ({
  isFixtureModeEnabled: () => false,
  isDemoModeEnabled: () => false
}));
jest.mock('@/services/mocks/core-finance-service', () => {
  const actual = jest.requireActual('@/services/mocks/core-finance-service');
  return {
    ...actual,
    coreFinanceService: actual.createSeededCoreFinanceService()
  };
});
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

it('reveals the first Home with its saved negative balance after local hydration, while revalidation is pending', async () => {
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  useAppShellStore.setState({
    hydrated: true,
    session: session('a'),
    logoutQuiescingOwnerId: null,
    privacyLock: {
      enabled: true,
      autoLockDuration: 'immediate',
      appLockStatus: 'unlocked'
    }
  });
  const account = {
    ...fixtureAccounts[0]!,
    currencyCode: 'SAR',
    status: 'active' as const
  };
  const balance = {
    accountId: account.id,
    currencyCode: 'SAR',
    balanceMinor: -1600,
    asOf: 100
  };
  let finishLocal!: (rows: unknown[]) => void;
  mockLoad.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishLocal = resolve;
      })
  );
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue([account]);
  let finishLive!: (rows: (typeof balance)[]) => void;
  jest.spyOn(coreFinanceService, 'listAccountBalances').mockImplementation(
    () =>
      new Promise((resolve) => {
        finishLive = resolve;
      })
  );
  function HomeRead() {
    const read = useHomeBalanceSummary('SAR', null);
    return <Text>{read.data?.totalBalanceMinor ?? '—'}</Text>;
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const view = render(
    <FoundationProviders client={client}>
      <InitialHomeLoadingBoundary isHome>
        <HomeRead />
      </InitialHomeLoadingBoundary>
    </FoundationProviders>
  );
  try {
    fireEvent(
      screen.getByTestId('initial-home-content', {
        includeHiddenElements: true
      }),
      'layout',
      { nativeEvent: { layout: { width: 360, height: 720, x: 0, y: 0 } } }
    );
    expect(screen.queryByText('—')).toBeNull();
    await act(async () =>
      finishLocal([
        {
          key: coreFinanceKeys.homeBalanceSource('a'),
          data: { accounts: [account], balances: [balance] },
          updatedAt: 100
        }
      ])
    );
    expect(await screen.findByText('-1600')).toBeOnTheScreen();
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    expect(
      client.getQueryState(coreFinanceKeys.homeBalanceSource('a'))?.fetchStatus
    ).toBe('fetching');
    expect(
      client.getQueryState(coreFinanceKeys.homeBalanceSource('a'))
        ?.dataUpdatedAt
    ).toBe(100);
    await act(async () => finishLive([{ ...balance, balanceMinor: -1200 }]));
    expect(await screen.findByText('-1200')).toBeOnTheScreen();
  } finally {
    view.unmount();
    client.clear();
  }
});

it('restores saved reads for a verified unexpired SDK session with the privacy lock explicitly disabled', async () => {
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  useAppShellStore.setState({
    hydrated: true,
    session: session('a'),
    logoutQuiescingOwnerId: null,
    privacyLock: {
      enabled: false,
      autoLockDuration: 'immediate',
      appLockStatus: 'unlocked'
    }
  });
  mockLoad.mockResolvedValue([
    { key, data: { label: 'verified-owner-saved' }, updatedAt: 100 }
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  function View() {
    const read = useQuery<{ label: string }>({
      queryKey: key,
      queryFn: () => new Promise(() => {})
    });
    return <Text>{read.data?.label ?? 'waiting'}</Text>;
  }
  const view = render(
    <FoundationProviders client={client}>
      <View />
    </FoundationProviders>
  );
  try {
    expect(await screen.findByText('verified-owner-saved')).toBeOnTheScreen();
  } finally {
    view.unmount();
    client.clear();
  }
});

it.each(['local', 'expired', 'missing-lock', 'locked'] as const)(
  'does not admit a saved read for the rejected %s session/privacy state',
  async (rejected) => {
    usePreferenceStore.setState({
      hydrated: true,
      locale: 'en',
      direction: 'ltr'
    });
    useAppShellStore.setState({
      hydrated: true,
      session: {
        ...session('a'),
        ...(rejected === 'local' ? { restoration: 'local' as const } : {}),
        ...(rejected === 'expired' ? { expiresAt: 1 } : {})
      },
      logoutQuiescingOwnerId: null,
      privacyLock:
        rejected === 'missing-lock'
          ? null
          : {
              enabled: rejected === 'locked',
              autoLockDuration: 'immediate',
              appLockStatus: rejected === 'locked' ? 'locked' : 'unlocked'
            }
    });
    mockLoad.mockResolvedValue([
      { key, data: { label: 'private-saved' }, updatedAt: 100 }
    ]);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } }
    });
    function View() {
      const read = useQuery<{ label: string }>({
        queryKey: key,
        queryFn: () => new Promise(() => {})
      });
      return <Text>{read.data?.label ?? 'no-private-data'}</Text>;
    }
    const view = render(
      <FoundationProviders client={client}>
        <View />
      </FoundationProviders>
    );
    try {
      await act(async () => {});
      expect(screen.queryByText('private-saved')).toBeNull();
      expect(screen.getByText('no-private-data')).toBeOnTheScreen();
      expect(client.getQueryData(key)).toBeUndefined();
    } finally {
      view.unmount();
      client.clear();
    }
  }
);

it.each(['empty', 'unavailable'] as const)(
  'does not wait for the network when the local Home cache is %s',
  async (outcome) => {
    usePreferenceStore.setState({
      hydrated: true,
      locale: 'en',
      direction: 'ltr'
    });
    useAppShellStore.setState({
      hydrated: true,
      session: session('a'),
      logoutQuiescingOwnerId: null,
      privacyLock: {
        enabled: true,
        autoLockDuration: 'immediate',
        appLockStatus: 'unlocked'
      }
    });
    mockLoad.mockImplementation(async () => {
      if (outcome === 'unavailable') throw Error('local cache unavailable');
      return [];
    });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } }
    });
    function View() {
      useQuery({ queryKey: key, queryFn: () => new Promise(() => {}) });
      return <Text>Home controls</Text>;
    }
    const view = render(
      <FoundationProviders client={client}>
        <InitialHomeLoadingBoundary isHome>
          <View />
        </InitialHomeLoadingBoundary>
      </FoundationProviders>
    );
    try {
      fireEvent(
        screen.getByTestId('initial-home-content', {
          includeHiddenElements: true
        }),
        'layout',
        { nativeEvent: { layout: { width: 360, height: 720, x: 0, y: 0 } } }
      );
      expect(await screen.findByText('Home controls')).toBeOnTheScreen();
      expect(screen.queryByTestId('startup-loading')).toBeNull();
      expect(client.getQueryState(key)?.fetchStatus).toBe('fetching');
    } finally {
      view.unmount();
      client.clear();
    }
  }
);

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
  client.getMutationCache().build(client, {
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
