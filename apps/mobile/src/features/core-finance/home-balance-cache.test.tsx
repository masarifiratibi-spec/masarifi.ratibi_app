import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import {
  invalidateCoreFinanceScopes,
  useHomeBalanceSummary
} from './core-finance-queries';

const accounts = [
  {
    ...fixtureAccounts[0],
    id: 'sar-account',
    currencyCode: 'SAR',
    status: 'active' as const
  },
  {
    ...fixtureAccounts[1],
    id: 'egp-account',
    currencyCode: 'EGP',
    status: 'active' as const
  }
];
const balances = [
  {
    accountId: 'sar-account',
    currencyCode: 'SAR',
    balanceMinor: 12500,
    asOf: 1
  },
  { accountId: 'egp-account', currencyCode: 'EGP', balanceMinor: 100, asOf: 1 }
];

function setup(accountId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity }
    }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ selected }: { selected: string | null }) =>
      useHomeBalanceSummary('SAR', selected),
    { wrapper, initialProps: { selected: accountId } }
  );
  return { ...view, client };
}

beforeEach(() => {
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue(accounts);
  jest
    .spyOn(coreFinanceService, 'listAccountBalances')
    .mockResolvedValue(balances);
});
afterEach(() => jest.restoreAllMocks());

it('never presents the previous account balance when the newly selected authoritative balance is missing', async () => {
  jest
    .mocked(coreFinanceService.listAccountBalances)
    .mockResolvedValue([balances[0]]);
  const view = setup('sar-account');
  try {
    await waitFor(() =>
      expect(view.result.current.data?.totalBalanceMinor).toBe(12500)
    );
    view.rerender({ selected: 'egp-account' });
    expect(view.result.current.isError).toBe(true);
    expect(view.result.current.data).toBeUndefined();
  } finally {
    view.unmount();
    view.client.clear();
  }
});

it('switches immediately from cached all-account balances to each native-currency account without new reads', async () => {
  const view = setup();
  try {
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toMatchObject({
      currencyCode: 'SAR',
      totalBalanceMinor: 12500,
      excludedAccountIds: ['egp-account']
    });
    view.rerender({ selected: 'egp-account' });
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.data).toMatchObject({
      currencyCode: 'EGP',
      totalBalanceMinor: 100,
      activeAccountCount: 1,
      excludedAccountIds: []
    });
    view.rerender({ selected: 'sar-account' });
    expect(view.result.current.data).toMatchObject({
      currencyCode: 'SAR',
      totalBalanceMinor: 12500,
      activeAccountCount: 1
    });
    view.rerender({ selected: null });
    expect(view.result.current.data?.excludedAccountIds).toEqual([
      'egp-account'
    ]);
    expect(coreFinanceService.listAccounts).toHaveBeenCalledTimes(1);
    expect(coreFinanceService.listAccountBalances).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    view.client.clear();
  }
});

it('keeps the selected cached balance visible while a receipt refreshes the shared source once', async () => {
  const view = setup();
  let release!: (value: typeof balances) => void;
  try {
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    view.rerender({ selected: 'egp-account' });
    await waitFor(() =>
      expect(view.result.current.data?.currencyCode).toBe('EGP')
    );
    jest.mocked(coreFinanceService.listAccountBalances).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    let refresh!: Promise<void>;
    act(() => {
      refresh = invalidateCoreFinanceScopes(view.client, [
        'home.summary',
        'accounts.balances'
      ]);
    });
    await waitFor(() => expect(view.result.current.isFetching).toBe(true));
    expect(view.result.current.data).toMatchObject({
      currencyCode: 'EGP',
      totalBalanceMinor: 100
    });
    await act(async () => {
      release([{ ...balances[1], balanceMinor: 200 }, balances[0]]);
      await refresh;
    });
    await waitFor(() =>
      expect(view.result.current.data?.totalBalanceMinor).toBe(200)
    );
    expect(coreFinanceService.listAccountBalances).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    view.client.clear();
  }
});

it('reuses the selected snapshot immediately on remount and revalidates in the background', async () => {
  const view = setup();
  try {
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    view.unmount();
    jest
      .mocked(coreFinanceService.listAccountBalances)
      .mockImplementation(() => new Promise(() => {}));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={view.client}>{children}</QueryClientProvider>
    );
    const next = renderHook(() => useHomeBalanceSummary('SAR', 'egp-account'), {
      wrapper
    });
    try {
      expect(next.result.current.data).toMatchObject({
        currencyCode: 'EGP',
        totalBalanceMinor: 100
      });
      expect(next.result.current.isLoading).toBe(false);
      await waitFor(() => expect(next.result.current.isFetching).toBe(true));
      expect(coreFinanceService.listAccountBalances).toHaveBeenCalledTimes(2);
    } finally {
      next.unmount();
    }
  } finally {
    view.client.clear();
  }
});
