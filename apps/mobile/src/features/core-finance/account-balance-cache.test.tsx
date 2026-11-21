import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Account, AccountBalanceProjection } from '@/domain/core-finance';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { useAppShellStore } from '@/state/app-shell';
import { markOfflineSnapshot, offlineSnapshot } from '@/services/read-snapshot';
import {
  coreFinanceKeys,
  readForQueryOwner,
  useAccountBalances
} from './core-finance-queries';

const account: Account = {
  ...fixtureAccounts[0],
  id: 'owned-account',
  currencyCode: 'SAR',
  status: 'active',
  updatedAt: 100
};
const balance: AccountBalanceProjection = {
  accountId: account.id,
  currencyCode: 'SAR',
  balanceMinor: 12500,
  asOf: 50
};
const previousSession = useAppShellStore.getState().session;
const previousQuiescing = useAppShellStore.getState().logoutQuiescingOwnerId;

beforeEach(() =>
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: 'a' },
    logoutQuiescingOwnerId: null
  })
);
afterEach(() =>
  useAppShellStore.setState({
    session: previousSession,
    logoutQuiescingOwnerId: previousQuiescing
  })
);

function setup(
  overrides: {
    full?: readonly Account[];
    active?: readonly Account[];
    balances?: readonly AccountBalanceProjection[];
    updatedAt?: number;
    owner?: string;
  } = {}
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 60_000 }
    }
  });
  const owner = overrides.owner ?? 'a';
  const sourceUpdatedAt = overrides.updatedAt ?? Date.now() - 100;
  client.setQueryData(
    coreFinanceKeys.accounts(true, owner),
    overrides.full ?? [account],
    { updatedAt: sourceUpdatedAt - 100 }
  );
  client.setQueryData(
    coreFinanceKeys.homeBalanceSource(owner),
    {
      accounts: overrides.active ?? [account],
      balances: overrides.balances ?? [balance]
    },
    { updatedAt: sourceUpdatedAt }
  );
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper, sourceUpdatedAt };
}

it('shows complete available balances immediately with the older original timestamp and offline provenance', () => {
  const balances = markOfflineSnapshot([balance]);
  const view = setup({ balances });
  const hook = renderHook(() => useAccountBalances(true), {
    wrapper: view.wrapper
  });
  try {
    expect(hook.result.current.data).toEqual([balance]);
    expect(hook.result.current.dataUpdatedAt).toBe(view.sourceUpdatedAt - 100);
    expect(offlineSnapshot(hook.result.current.data)).toBe(true);
    expect(hook.result.current.isFetching).toBe(false);
  } finally {
    hook.unmount();
    view.client.clear();
  }
});

it.each([
  ['archived account', { full: [{ ...account, status: 'archived' as const }] }],
  ['closed account', { full: [{ ...account, status: 'closed' as const }] }],
  ['changed metadata', { full: [{ ...account, updatedAt: 101 }] }],
  ['different account', { active: [{ ...account, id: 'another' }] }],
  [
    'duplicate full account',
    {
      full: [account, account],
      active: [account, { ...account, id: 'another' }]
    }
  ],
  ['missing balance', { balances: [] }],
  ['duplicate balance', { balances: [balance, balance] }],
  ['unrelated balance', { balances: [{ ...balance, accountId: 'another' }] }],
  ['different currency', { balances: [{ ...balance, currencyCode: 'USD' }] }],
  [
    'unsafe amount',
    { balances: [{ ...balance, balanceMinor: Number.MAX_SAFE_INTEGER + 1 }] }
  ],
  ['foreign owner', { owner: 'b' }]
] as const)(
  'uses normal fetching instead of promoting a %s',
  (_scenario, overrides) => {
    const view = setup(overrides);
    const hook = renderHook(() => useAccountBalances(true), {
      wrapper: view.wrapper
    });
    try {
      expect(hook.result.current.data).toBeUndefined();
    } finally {
      hook.unmount();
      view.client.clear();
    }
  }
);

it.each(['invalidated', 'fetching', 'failed'] as const)(
  'declines a %s source snapshot',
  async (state) => {
    const view = setup();
    const key = coreFinanceKeys.homeBalanceSource('a');
    if (state === 'invalidated')
      await view.client.invalidateQueries({
        queryKey: key,
        refetchType: 'none'
      });
    else
      view.client
        .getQueryCache()
        .find({ queryKey: key })!
        .setState(
          state === 'fetching'
            ? { fetchStatus: 'fetching' }
            : { status: 'error', error: new Error('unavailable') }
        );
    const hook = renderHook(() => useAccountBalances(true), {
      wrapper: view.wrapper
    });
    try {
      expect(hook.result.current.data).toBeUndefined();
    } finally {
      hook.unmount();
      view.client.clear();
    }
  }
);

it('revalidates expired available balances without extending their original expiry', () => {
  const view = setup({ updatedAt: Date.now() - 61_000 });
  const hook = renderHook(() => useAccountBalances(true), {
    wrapper: view.wrapper
  });
  try {
    expect(hook.result.current.data).toEqual([balance]);
    expect(hook.result.current.dataUpdatedAt).toBe(view.sourceUpdatedAt - 100);
    expect(hook.result.current.isFetching).toBe(true);
  } finally {
    hook.unmount();
    view.client.clear();
  }
});

it('cannot reuse owner A balances when B mounts even before a shared query client is cleared', () => {
  const view = setup();
  const hook = renderHook(() => useAccountBalances(true), {
    wrapper: view.wrapper
  });
  try {
    expect(hook.result.current.data).toEqual([balance]);
    act(() =>
      useAppShellStore.setState({
        session: { ...authenticatedSession, userId: 'b' }
      })
    );
    expect(hook.result.current.data).toBeUndefined();
    expect(
      view.client.getQueryData(coreFinanceKeys.accountBalances(true, 'a'))
    ).toEqual([balance]);
  } finally {
    hook.unmount();
    view.client.clear();
  }
});

it('rejects a late owner A read before it can publish under an owned accounts key', async () => {
  const view = setup();
  let release!: (rows: Account[]) => void;
  const delayed = new Promise<Account[]>((resolve) => {
    release = resolve;
  });
  const key = coreFinanceKeys.accounts(false, 'a');
  const pending = view.client.fetchQuery({
    queryKey: key,
    queryFn: () => readForQueryOwner('a', () => delayed)
  });
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: 'b' }
  });
  release([account]);
  try {
    await expect(pending).rejects.toThrow('Identity changed');
    expect(view.client.getQueryData(key)).toBeUndefined();
    await expect(
      readForQueryOwner('a', async () => {
        throw new Error('Should not read');
      })
    ).rejects.toThrow('Identity changed');
  } finally {
    view.client.clear();
  }
});
