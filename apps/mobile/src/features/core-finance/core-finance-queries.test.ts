import {
  coreFinanceKeys,
  scopeToKey,
  invalidateCoreFinanceScopes
} from './core-finance-queries';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { emptyTransactionFilters } from '@/domain/core-finance';

it('invalidates shared history before a mounted trend reads it again', async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity }
    }
  });
  const history = ['reports', 'history', 'owner'];
  const trend = ['reports', 'net-worth', 'month'];
  client.setQueryData(history, 1);
  const observer = new QueryObserver(client, {
    queryKey: trend,
    queryFn: () =>
      client.fetchQuery({
        queryKey: history,
        queryFn: async () => 2,
        staleTime: Infinity
      })
  });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch();
    expect(client.getQueryData(trend)).toBe(1);
    await invalidateCoreFinanceScopes(client, ['reports.live']);
    expect(client.getQueryData(trend)).toBe(2);
  } finally {
    unsubscribe();
    client.clear();
  }
});

it('marks planning snapshots stale after ledger activity without touching drafts', async () => {
  const client = new QueryClient();
  const snapshot = [
    'planning',
    'snapshot',
    'owner',
    '2026-10-17',
    'Asia/Riyadh'
  ];
  const draft = ['planning', 'draft', 'salary'];
  client.setQueryData(snapshot, { balance: 1 });
  client.setQueryData(draft, { amount: '123' });
  try {
    await invalidateCoreFinanceScopes(client, [
      'transactions.list',
      'home.summary'
    ]);
    expect(client.getQueryState(snapshot)?.isInvalidated).toBe(true);
    expect(client.getQueryState(draft)?.isInvalidated).toBe(false);
  } finally {
    client.clear();
  }
});

it('creates stable isolated query keys', () => {
  expect(coreFinanceKeys.home('SAR')).toEqual(['core-finance', 'home', 'SAR']);
  const periodFilters = {
    ...emptyTransactionFilters,
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 8, 1) - 1
  };
  expect(coreFinanceKeys.home('SAR', periodFilters)).toEqual([
    'core-finance',
    'home',
    'SAR',
    periodFilters
  ]);
  expect(coreFinanceKeys.transactions(emptyTransactionFilters)).toEqual([
    'core-finance',
    'transactions',
    emptyTransactionFilters
  ]);
  expect(coreFinanceKeys.account('a1')).not.toEqual(coreFinanceKeys.accounts());
  expect(coreFinanceKeys.accountBalances(true)).toEqual([
    'core-finance',
    'account-balances',
    true
  ]);
  expect(coreFinanceKeys.transactionPages(emptyTransactionFilters)).toEqual([
    'core-finance',
    'transactions',
    'pages',
    emptyTransactionFilters
  ]);
});

it.each([
  ['home.summary', ['core-finance', 'home']],
  ['accounts.list', ['core-finance', 'accounts']],
  ['accounts.balances', ['core-finance', 'account-balances']],
  ['accounts.detail.a1', ['core-finance', 'account', 'a1']],
  ['transactions.detail.t1', ['core-finance', 'transaction', 't1']],
  ['categories.list', ['core-finance', 'categories']],
  ['conflicts.detail.c1', ['core-finance']]
] as const)('maps %s to the narrow invalidation root', (scope, expected) => {
  expect(scopeToKey(scope)).toEqual(expected);
});

it('builds selector and conflict detail keys without durable data in Zustand', () => {
  expect(coreFinanceKeys.categories(true)).toEqual([
    'core-finance',
    'categories',
    true
  ]);
  expect(coreFinanceKeys.conflict('c1')).toEqual([
    'core-finance',
    'conflict',
    'c1'
  ]);
});

it('refreshes mounted net-worth after a financial receipt without invalidating immutable report attempts', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });
  let netWorth = 0;
  const key = ['reports', 'net-worth', 'month', 'SAR'];
  client.setQueryData(key, 0);
  client.setQueryData(['reports', 'attempt', 'immutable-1'], 'retained');
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => netWorth
  });
  const stop = observer.subscribe(() => undefined);
  try {
    netWorth = -2500;
    await invalidateCoreFinanceScopes(client, ['reports.live'], true);
    expect(client.getQueryData(key)).toBe(-2500);
    expect(
      client.getQueryState(['reports', 'attempt', 'immutable-1'])?.isInvalidated
    ).toBe(false);
  } finally {
    stop();
    client.clear();
  }
});
