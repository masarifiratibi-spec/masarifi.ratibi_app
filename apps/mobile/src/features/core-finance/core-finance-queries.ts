import {
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { inheritReadProvenance } from '@/services/read-snapshot';
import { assertReadActive } from '@/services/live/read-context';

import {
  emptyTransactionFilters,
  type Account,
  type AccountBalanceProjection,
  type Category,
  type HomeSummary,
  type Transaction,
  type TransactionFilterSet
} from '@/domain/core-finance';
import type {
  HomeTodayActivity,
  TransactionPage
} from '@/services/contracts/core-finance-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { summarizeHomeBalances } from '@/domain/home-balance';
import { useAppShellStore } from '@/state/app-shell';

const currentQueryOwner = () =>
  useAppShellStore.getState().session?.userId ?? null;

export async function readForQueryOwner<T>(
  owner: string | null,
  read: () => Promise<T>
) {
  if (currentQueryOwner() !== owner) throw new Error('Identity changed');
  const snapshot = await read();
  if (currentQueryOwner() !== owner) throw new Error('Identity changed');
  return snapshot;
}

export const coreFinanceKeys = {
  home: (currency: string, filters?: TransactionFilterSet) =>
    filters
      ? (['core-finance', 'home', currency, filters] as const)
      : (['core-finance', 'home', currency] as const),
  accounts: (archived = false, owner = currentQueryOwner()) =>
    ['core-finance', 'accounts', archived, { ownerId: owner }] as const,
  homeBalanceSource: (owner = currentQueryOwner()) =>
    ['core-finance', 'home', 'balance-source', { ownerId: owner }] as const,
  accountBalances: (archived = false, owner = currentQueryOwner()) =>
    ['core-finance', 'account-balances', archived, { ownerId: owner }] as const,
  account: (id: string) => ['core-finance', 'account', id] as const,
  transactions: (filters: TransactionFilterSet = emptyTransactionFilters) =>
    ['core-finance', 'transactions', filters] as const,
  transactionPages: (filters: TransactionFilterSet = emptyTransactionFilters) =>
    ['core-finance', 'transactions', 'pages', filters] as const,
  transaction: (id: string) => ['core-finance', 'transaction', id] as const,
  refundable: (id: string, excludedRefundId?: string) =>
    [
      'core-finance',
      'transactions',
      'refundable',
      id,
      excludedRefundId ?? null
    ] as const,
  categories: (archived = false) =>
    ['core-finance', 'categories', archived] as const,
  conflict: (id: string) => ['core-finance', 'conflict', id] as const
};

export function useHomeSummary(
  currency: string,
  filters?: TransactionFilterSet
) {
  return useQuery({
    queryKey: coreFinanceKeys.home(currency, filters),
    queryFn: ({ signal }) =>
      coreFinanceService.getHomeSummary(currency, filters, { signal })
  });
}

export function useHomeBalanceSummary(
  currency: string,
  accountId: string | null
) {
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const select = useCallback(
    ({
      accounts,
      balances
    }: {
      accounts: Account[];
      balances: AccountBalanceProjection[];
    }) => {
      const selectedCurrency = accountId
        ? accounts.find((account) => account.id === accountId)?.currencyCode
        : undefined;
      return {
        accountId,
        currency,
        summary: inheritReadProvenance(
          summarizeHomeBalances(
            accounts,
            balances,
            selectedCurrency ?? currency,
            accountId
          ),
          [accounts, balances]
        )
      };
    },
    [currency, accountId]
  );
  const query = useQuery({
    // Selection is a projection of the same authoritative balances, not a new read.
    queryKey: coreFinanceKeys.homeBalanceSource(owner),
    queryFn: ({ signal }) =>
      readForQueryOwner(owner, async () => {
        const [accounts, balances] = await Promise.all([
          coreFinanceService.listAccounts(false, { signal }),
          coreFinanceService.listAccountBalances(false, { signal })
        ]);
        return { accounts, balances };
      }),
    select,
    staleTime: 0
  });
  // A failed select retains its previous result; it must never cross account scopes.
  const scoped =
    query.data?.accountId === accountId && query.data.currency === currency
      ? query.data
      : undefined;
  return {
    ...query,
    data: scoped?.summary,
    dataUpdatedAt: scoped ? query.dataUpdatedAt : 0
  };
}

export function useAccounts(includeArchived = false, enabled = true) {
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const client = useQueryClient();
  const allAccounts = () => {
    if (includeArchived) return;
    const state = client.getQueryState<Account[]>(
      coreFinanceKeys.accounts(true, owner)
    );
    return state?.status === 'success' &&
      !state.isInvalidated &&
      state.fetchStatus === 'idle'
      ? state
      : undefined;
  };
  return useQuery({
    queryKey: coreFinanceKeys.accounts(includeArchived, owner),
    queryFn: ({ signal }) =>
      readForQueryOwner(owner, () =>
        coreFinanceService.listAccounts(includeArchived, { signal })
      ),
    initialData: () =>
      allAccounts()?.data?.filter((account) => account.status === 'active'),
    initialDataUpdatedAt: () => allAccounts()?.dataUpdatedAt,
    enabled
  });
}

export function useAccountBalances(includeArchived = false) {
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const client = useQueryClient();
  const seed = includeArchived ? cachedHomeBalances(client, owner) : undefined;
  return useQuery({
    queryKey: coreFinanceKeys.accountBalances(includeArchived, owner),
    queryFn: ({ signal }) =>
      readForQueryOwner(owner, () =>
        coreFinanceService.listAccountBalances(includeArchived, { signal })
      ),
    initialData: seed?.data,
    initialDataUpdatedAt: seed?.dataUpdatedAt
  });
}

type HomeBalanceSource = {
  accounts: Account[];
  balances: AccountBalanceProjection[];
};

function settledQuery<T>(client: QueryClient, key: QueryKey) {
  const state = client.getQueryState<T>(key);
  if (
    !state ||
    state.status !== 'success' ||
    state.isInvalidated ||
    state.fetchStatus !== 'idle' ||
    state.data === undefined ||
    !Number.isFinite(state.dataUpdatedAt) ||
    state.dataUpdatedAt <= 0 ||
    state.dataUpdatedAt > Date.now()
  )
    return;
  return { data: state.data, dataUpdatedAt: state.dataUpdatedAt };
}

function sameActiveAccounts(full: Account[], active: Account[]) {
  if (
    !Array.isArray(full) ||
    !Array.isArray(active) ||
    active.some((account) => !account)
  )
    return false;
  const byId = new Map(active.map((account) => [account.id, account]));
  if (
    full.length !== active.length ||
    byId.size !== full.length ||
    new Set(full.map((account) => account?.id)).size !== full.length
  )
    return false;
  return full.every((account) => {
    const source = account && byId.get(account.id);
    return (
      source &&
      account.status === 'active' &&
      source.status === account.status &&
      source.currencyCode === account.currencyCode &&
      source.updatedAt === account.updatedAt &&
      Number.isFinite(account.updatedAt)
    );
  });
}

function completeBalances({ accounts, balances }: HomeBalanceSource) {
  if (!Array.isArray(balances) || balances.some((balance) => !balance))
    return false;
  const byId = new Map(balances.map((balance) => [balance.accountId, balance]));
  if (balances.length !== accounts.length || byId.size !== accounts.length)
    return false;
  return accounts.every((account) => {
    const balance = byId.get(account.id);
    return (
      balance?.currencyCode === account.currencyCode &&
      Number.isSafeInteger(balance.balanceMinor) &&
      (balance.asOf === null || Number.isFinite(balance.asOf))
    );
  });
}

function cachedHomeBalances(client: QueryClient, owner: string | null) {
  const shell = useAppShellStore.getState();
  if (
    !owner ||
    shell.session?.status !== 'authenticated' ||
    shell.logoutQuiescingOwnerId
  )
    return;
  const full = settledQuery<Account[]>(
    client,
    coreFinanceKeys.accounts(true, owner)
  );
  const source = settledQuery<HomeBalanceSource>(
    client,
    coreFinanceKeys.homeBalanceSource(owner)
  );
  if (
    !full ||
    !source?.data ||
    !sameActiveAccounts(full.data, source.data.accounts) ||
    !completeBalances(source.data)
  )
    return;
  return {
    data: source.data.balances,
    dataUpdatedAt: Math.min(full.dataUpdatedAt, source.dataUpdatedAt)
  };
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: coreFinanceKeys.account(id),
    queryFn: () => coreFinanceService.getAccount(id),
    enabled: Boolean(id)
  });
}

export function useTransactions(
  filters: TransactionFilterSet = emptyTransactionFilters,
  enabled = true
) {
  return useQuery({
    queryKey: coreFinanceKeys.transactions(filters),
    queryFn: ({ signal }) =>
      coreFinanceService.listTransactions(filters, null, undefined, signal),
    enabled
  });
}

export function useInfiniteTransactions(
  filters: TransactionFilterSet = emptyTransactionFilters
) {
  return useInfiniteQuery({
    queryKey: coreFinanceKeys.transactionPages(filters),
    queryFn: ({ pageParam, signal }) =>
      coreFinanceService.listTransactions(
        filters,
        pageParam,
        undefined,
        signal
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
}

export function useTransaction(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: coreFinanceKeys.transaction(id),
    queryFn: () => coreFinanceService.getTransaction(id),
    initialData: () => cachedTransaction(client, id)?.data,
    initialDataUpdatedAt: () => cachedTransaction(client, id)?.updatedAt,
    enabled: Boolean(id)
  });
}

function* cachedTransactionRows(
  key: readonly unknown[],
  snapshot: unknown
): Iterable<Transaction> {
  const [, resource, variant] = key;
  if (resource === 'home')
    yield* (snapshot as Partial<HomeSummary>).recentTransactions ?? [];
  else if (resource === 'transactions' && variant === 'home-today') {
    for (const row of snapshot as HomeTodayActivity[]) yield row.transaction;
  } else if (resource === 'transactions' && variant === 'pages') {
    for (const page of (snapshot as { pages: TransactionPage[] }).pages)
      yield* page.items;
  } else if (resource === 'transactions' && typeof variant === 'object')
    yield* (snapshot as TransactionPage).items;
}

function cachedTransaction(client: QueryClient, id: string) {
  if (!id) return;
  let cached: { data: Transaction; updatedAt: number } | undefined;
  for (const query of client
    .getQueryCache()
    .findAll({ queryKey: ['core-finance'] })) {
    if (query.state.data === undefined) continue;
    for (const item of cachedTransactionRows(
      query.queryKey,
      query.state.data
    )) {
      if (item.id !== id) continue;
      // A refresh may replace this version; another list must not pin it either.
      if (
        query.state.status !== 'success' ||
        query.state.isInvalidated ||
        query.state.fetchStatus !== 'idle'
      )
        return;
      if (
        !cached ||
        item.version > cached.data.version ||
        (item.version === cached.data.version &&
          query.state.dataUpdatedAt > cached.updatedAt)
      )
        cached = {
          data: item,
          updatedAt: query.state.dataUpdatedAt
        };
    }
  }
  // Special postings require detail projection; never promote a pending snapshot.
  if (!cached) return;
  const item = cached.data;
  if (
    !['expense', 'income', 'transfer'].includes(item.type) ||
    item.status !== 'posted' ||
    item.syncStatus !== 'synced' ||
    item.reviewStatus !== 'none' ||
    item.originalTransactionId
  )
    return;
  return {
    data: {
      ...item,
      adjustmentSign: (item.type === 'income' ? 1 : -1) as -1 | 1
    },
    updatedAt: cached.updatedAt
  };
}

export function useRemainingRefundableMinor(
  id: string,
  enabled = true,
  excludedRefundId?: string
) {
  return useQuery({
    queryKey: coreFinanceKeys.refundable(id, excludedRefundId),
    queryFn: () =>
      coreFinanceService.getRemainingRefundableMinor(id, excludedRefundId),
    enabled: Boolean(id) && enabled
  });
}

function categoryQueryOptions(includeArchived: boolean, owner: string | null) {
  return {
    queryKey: coreFinanceKeys.categories(includeArchived),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      assertReadActive(signal);
      const categories = await readForQueryOwner(owner, () =>
        coreFinanceService.listCategories(includeArchived)
      );
      assertReadActive(signal);
      return categories;
    }
  };
}

export function useCategories(includeArchived = false, enabled = true) {
  const owner = useAppShellStore((state) => state.session?.userId ?? null);
  const client = useQueryClient();
  const allCategories = () => {
    if (includeArchived) return;
    const state = client.getQueryState<Category[]>(
      coreFinanceKeys.categories(true)
    );
    return state?.status === 'success' &&
      !state.isInvalidated &&
      state.fetchStatus === 'idle'
      ? state
      : undefined;
  };
  return useQuery({
    ...categoryQueryOptions(includeArchived, owner),
    initialData: () =>
      allCategories()?.data?.filter((category) => category.status === 'active'),
    initialDataUpdatedAt: () => allCategories()?.dataUpdatedAt,
    enabled
  });
}

/** Use the destination's existing query; never delay menu navigation. */
export async function prefetchCategories(
  client: QueryClient,
  ownerId: string
): Promise<void> {
  if (currentQueryOwner() !== ownerId) return;
  await client.prefetchQuery(categoryQueryOptions(true, ownerId));
}

export function useCoreFinanceMutation<TVariables, TResult>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
    }
  });
}

export function scopeToKey(scope: string): readonly unknown[] {
  const [root, kind, id] = scope.split('.');
  if (root === 'home') return ['core-finance', 'home'];
  if (root === 'accounts' && kind === 'detail' && id)
    return ['core-finance', 'account', id];
  if (root === 'accounts' && kind === 'balances')
    return ['core-finance', 'account-balances'];
  if (root === 'accounts') return ['core-finance', 'accounts'];
  if (root === 'transactions' && kind === 'detail' && id)
    return ['core-finance', 'transaction', id];
  if (root === 'transactions') return ['core-finance', 'transactions'];
  if (root === 'categories') return ['core-finance', 'categories'];
  if (scope === 'reports.live') return ['reports', 'live'];
  if (scope === 'assistant.context') return ['assistant', 'context', 'current'];
  return ['core-finance'];
}

export async function invalidateCoreFinanceScopes(
  client: QueryClient,
  scopes: readonly string[],
  requireSuccess = false
): Promise<void> {
  const keys = [
    ...new Map(
      scopes
        .flatMap((scope) =>
          scope === 'reports.live'
            ? [
                ['reports', 'live'],
                ['reports', 'net-worth'],
                ['reports', 'history']
              ]
            : [scopeToKey(scope)]
        )
        .map((key) => [JSON.stringify(key), key])
    ).values()
  ];
  const refreshPlanning = scopes.some((scope) =>
    /^(?:home|accounts|transactions)(?:[.]|$)/.test(scope)
  );
  const planning = (query: { queryKey: readonly unknown[] }) =>
    refreshPlanning &&
    query.queryKey[0] === 'planning' &&
    !['draft', 'conflict'].includes(String(query.queryKey[1])) &&
    !(query.queryKey[1] === 'salary' && query.queryKey[2] === 'profile');
  await Promise.all([
    ...keys.map((queryKey) => client.cancelQueries({ queryKey })),
    client.cancelQueries({ predicate: planning })
  ]);
  // Mark shared sources stale before any dependent query can run.
  await client.invalidateQueries({
    queryKey: ['reports', 'history'],
    refetchType: 'none'
  });
  await client.invalidateQueries({ predicate: planning, refetchType: 'none' });
  await Promise.all([
    ...keys.map((queryKey) =>
      client.invalidateQueries({ queryKey }, { throwOnError: requireSuccess })
    ),
    client.refetchQueries(
      { predicate: planning, type: 'active' },
      { throwOnError: requireSuccess }
    )
  ]);
}
