import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePreferenceStore } from '@/state/preferences';
import { useHomeTodayActivity } from './useHomeTodayActivity';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
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
