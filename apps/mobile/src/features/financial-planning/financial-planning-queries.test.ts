import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { useAppShellStore } from '@/state/app-shell';
import {
  financialPlanningKeys,
  invalidatePlanningScopes,
  usePlanningMutation
} from './financial-planning-queries';

it('invalidates receipt review after linking or undoing a salary receipt', async () => {
  const client = new QueryClient();
  const key = financialPlanningKeys.salaryReview('income-id');
  client.setQueryData(key, { status: 'linked' });
  await invalidatePlanningScopes(client, ['planning.salary.overview']);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});

it.each([false, true])('checks current financial state after an uncertain mutation without resubmitting; owner changed=%s', async (ownerChanged) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  const previousSession = useAppShellStore.getState().session;
  const session = { status: 'authenticated' as const, userId: 'owner-a', method: 'phone' as const, issuedAt: 1, expiresAt: 9999999999999, restoration: 'restored' as const };
  useAppShellStore.setState({ session });
  const balanceKey = ['core-finance', 'account-balances', false];
  let serverBalance = 100000;
  let writes = 0;
  const options = { queryKey: balanceKey, queryFn: async () => serverBalance };
  await client.fetchQuery(options);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => undefined);
  const hook = renderHook(() => usePlanningMutation(async () => {
    writes++;
    serverBalance = 90000;
    if (ownerChanged) useAppShellStore.setState({ session: { ...session, userId: 'owner-b' } });
    throw new Error('Response lost after commit');
  }), { wrapper: ({ children }) => React.createElement(QueryClientProvider, { client }, children) });
  try {
    await act(async () => {
      await expect(hook.result.current.mutateAsync(undefined)).rejects.toThrow('Response lost after commit');
    });
    expect(writes).toBe(1);
    expect(client.getQueryData(balanceKey)).toBe(ownerChanged ? 100000 : 90000);
  } finally {
    hook.unmount();
    unsubscribe();
    client.clear();
    useAppShellStore.setState({ session: previousSession });
  }
});

it('replaces an initial pre-payment read instead of accepting its late result', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  let release!: (value: number) => void;
  let reads = 0;
  const key = financialPlanningKeys.obligation('o');
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () => {
      reads++;
      return reads === 1
        ? new Promise<number>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(2);
    }
  });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await Promise.resolve();
    const invalidation = invalidatePlanningScopes(client, [
      'planning.obligation.o'
    ]);
    release(1);
    await invalidation;
    expect(client.getQueryData(key)).toBe(2);
    expect(reads).toBe(2);
  } finally {
    unsubscribe();
    client.clear();
  }
});

it('refreshes the cached account balance and original transaction after payment Undo', async () => {
  const client = new QueryClient();
  const balanceKey = ['core-finance', 'account-balances', false];
  const transactionKey = ['core-finance', 'transaction', 'original-expense'];
  client.setQueryData(balanceKey, { balanceMinor: 163600 });
  client.setQueryData(transactionKey, { status: 'confirmed' });
  try {
    await invalidatePlanningScopes(client, [
      'accounts.balances',
      'transactions.detail.original-expense'
    ]);
    expect(client.getQueryState(balanceKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(transactionKey)?.isInvalidated).toBe(true);
  } finally {
    client.clear();
  }
});
