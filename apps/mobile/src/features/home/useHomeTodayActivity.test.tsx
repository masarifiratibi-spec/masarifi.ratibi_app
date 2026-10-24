import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient
} from '@tanstack/react-query';
import { usePreferenceStore } from '@/state/preferences';
import { useHomeTodayActivity } from './useHomeTodayActivity';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

let mockFocus: (() => void) | undefined;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback;
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));

jest.mock('@/services/mocks/core-finance-service', () => {
  const actual = jest.requireActual<
    typeof import('@/services/mocks/core-finance-service')
  >('@/services/mocks/core-finance-service');
  const { CoreFinanceRepository } = jest.requireActual<
    typeof import('@/storage/core-finance-repository')
  >('@/storage/core-finance-repository');
  const { fixtureAccounts, fixtureCategories, makeTransaction } =
    jest.requireActual<typeof import('@/test-utils/core-finance-fixtures')>(
      '@/test-utils/core-finance-fixtures'
    );
  return {
    ...actual,
    coreFinanceService: actual.createMockCoreFinanceService(
      new CoreFinanceRepository({
        accounts: fixtureAccounts,
        categories: fixtureCategories,
        transactions: [
          makeTransaction(1, {
            occurredAt: Date.parse('2026-10-08T20:00:00Z'),
            status: 'posted',
            reviewStatus: 'none',
            syncStatus: 'synced'
          }),
          makeTransaction(2, {
            occurredAt: Date.parse('2026-10-08T21:00:00Z'),
            status: 'posted',
            reviewStatus: 'none',
            syncStatus: 'synced'
          }),
          makeTransaction(3, {
            accountId: 'account-wallet',
            occurredAt: Date.parse('2026-10-08T21:00:00Z'),
            status: 'posted',
            reviewStatus: 'none',
            syncStatus: 'synced'
          })
        ]
      })
    )
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } }
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

it('shows only the selected account from the complete cached day while its scoped read is pending', async () => {
  jest.setSystemTime(Date.parse('2026-10-08T21:15:00Z'));
  const read = jest.spyOn(coreFinanceService, 'getHomeTodayActivity');
  const view = renderHook(
    ({ accountId }: { accountId: string | null }) =>
      useHomeTodayActivity(accountId),
    { wrapper: Wrapper, initialProps: { accountId: null } }
  );
  try {
    await waitFor(() => expect(view.result.current.data).toHaveLength(2));
    read.mockImplementation(() => new Promise(() => {}));
    view.rerender({ accountId: 'account-wallet' });
    expect(view.result.current.data?.map((row) => row.transaction.id)).toEqual([
      'transaction-3'
    ]);
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.isFetching).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][0].accountIds).toEqual(['account-wallet']);
  } finally {
    view.unmount();
  }
});

it('does not seed a newly selected account from an invalidated complete-day snapshot', async () => {
  jest.setSystemTime(Date.parse('2026-10-08T21:15:00Z'));
  const read = jest.spyOn(coreFinanceService, 'getHomeTodayActivity');
  const view = renderHook(
    ({ accountId }: { accountId: string | null }) => ({
      activity: useHomeTodayActivity(accountId),
      client: useQueryClient()
    }),
    { wrapper: Wrapper, initialProps: { accountId: null } }
  );
  try {
    await waitFor(() =>
      expect(view.result.current.activity.data).toHaveLength(2)
    );
    await act(async () =>
      view.result.current.client.invalidateQueries({
        queryKey: ['core-finance', 'transactions'],
        refetchType: 'none'
      })
    );
    read.mockImplementation(() => new Promise(() => {}));
    view.rerender({ accountId: 'account-wallet' });
    expect(view.result.current.activity.data).toBeUndefined();
    expect(view.result.current.activity.isLoading).toBe(true);
  } finally {
    view.unmount();
  }
});

it.each(['focus', 'foreground'] as const)(
  'refreshes on same-day %s without a redundant date-state render',
  async (trigger) => {
    let foreground!: (state: AppStateStatus) => void;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        foreground = listener;
        return { remove: jest.fn() };
      });
    const read = jest.spyOn(coreFinanceService, 'getHomeTodayActivity');
    let renders = 0;
    const view = renderHook(
      () => {
        renders++;
        return useHomeTodayActivity(null).data;
      },
      { wrapper: Wrapper }
    );
    try {
      await waitFor(() => expect(view.result.current).toHaveLength(1));
      const beforeRenders = renders;
      const beforeReads = read.mock.calls.length;
      jest.setSystemTime(Date.now() + 1000);
      await act(async () => {
        if (trigger === 'focus') mockFocus?.();
        else foreground('active');
      });
      expect(read).toHaveBeenCalledTimes(beforeReads + 1);
      expect(renders).toBe(beforeRenders);
      expect(view.result.current?.[0].transaction.id).toBe('transaction-1');
    } finally {
      view.unmount();
    }
  }
);

it('joins repeated foreground refreshes instead of cancelling and restarting cached reads', async () => {
  let foreground!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove: jest.fn() };
    });
  const original = coreFinanceService.getHomeTodayActivity;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = jest.spyOn(coreFinanceService, 'getHomeTodayActivity');
  const view = renderHook(() => useHomeTodayActivity(null), {
    wrapper: Wrapper
  });
  try {
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    spy.mockImplementation(async (...args) => {
      await pending;
      return original(...args);
    });
    const initial = spy.mock.calls.length;
    act(() => {
      foreground('active');
      foreground('active');
    });
    expect(spy.mock.calls.length - initial).toBe(1);
  } finally {
    await act(async () => release());
    view.unmount();
  }
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse('2026-10-08T20:59:50Z'));
  usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('changes the activity query at local midnight while Home stays mounted', async () => {
  const { result } = renderHook(() => useHomeTodayActivity(null), {
    wrapper: Wrapper
  });
  await waitFor(() =>
    expect(
      result.current.data?.map(({ transaction }) => transaction.id)
    ).toEqual(['transaction-1'])
  );
  await act(async () => {
    jest.advanceTimersByTime(Date.parse('2026-10-08T21:00:00Z') - Date.now());
  });
  await waitFor(() =>
    expect(
      result.current.data?.map(({ transaction }) => transaction.id).sort()
    ).toEqual(['transaction-2', 'transaction-3'])
  );
});

it('recomputes the local day after background/foreground and never retains yesterday rows', async () => {
  let foreground: ((state: AppStateStatus) => void) | undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove: jest.fn() };
    });
  const { result } = renderHook(() => useHomeTodayActivity(null), {
    wrapper: Wrapper
  });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  jest.setSystemTime(Date.parse('2026-10-09T01:00:00Z'));
  act(() => {
    foreground?.('active');
  });
  await waitFor(() =>
    expect(
      result.current.data?.map(({ transaction }) => transaction.id).sort()
    ).toEqual(['transaction-2', 'transaction-3'])
  );
});

it('isolates account selection and timezone changes from previously displayed daily data', async () => {
  jest.setSystemTime(Date.parse('2026-10-08T21:15:00Z'));
  usePreferenceStore.setState({ timeZone: 'UTC' });
  const { result, rerender } = renderHook(
    ({ accountId }: { accountId: string | null }) =>
      useHomeTodayActivity(accountId),
    {
      wrapper: Wrapper,
      initialProps: { accountId: null }
    }
  );
  await waitFor(() => expect(result.current.data).toHaveLength(3));
  act(() => usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' }));
  await waitFor(() => expect(result.current.data).toHaveLength(2));
  rerender({ accountId: 'account-wallet' });
  await waitFor(() =>
    expect(
      result.current.data?.map(({ transaction }) => transaction.id)
    ).toEqual(['transaction-3'])
  );
});
