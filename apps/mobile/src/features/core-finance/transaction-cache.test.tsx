import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { emptyTransactionFilters } from '@/domain/core-finance';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import {
  fixtureAccounts,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import {
  coreFinanceKeys,
  useAccounts,
  useTransaction
} from './core-finance-queries';

const item = {
  ...fixtureTransactions[0],
  type: 'expense' as const,
  status: 'posted' as const,
  syncStatus: 'synced' as const,
  reviewStatus: 'none' as const,
  originalTransactionId: null,
  notes: 'ملاحظة محفوظة',
  adjustmentSign: 1 as const
};

it.each([
  ['income', 1],
  ['transfer', -1]
] as const)(
  'retains complete cached %s fields with the authoritative posting sign',
  (type, adjustmentSign) => {
    const { client, wrapper } = setup();
    const row = {
      ...item,
      type,
      destinationAccountId: type === 'transfer' ? fixtureAccounts[1].id : null,
      feeMinor: type === 'transfer' ? 25 : 0
    };
    client.setQueryData(coreFinanceKeys.transactions(), {
      items: [row],
      nextCursor: null
    });
    const read = jest.spyOn(coreFinanceService, 'getTransaction');
    try {
      const { result, unmount } = renderHook(() => useTransaction(row.id), {
        wrapper
      });
      expect(result.current.data).toEqual({ ...row, adjustmentSign });
      expect(read).not.toHaveBeenCalled();
      unmount();
    } finally {
      read.mockRestore();
      client.clear();
    }
  }
);

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        gcTime: Infinity
      }
    }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

it('opens an edit form using the complete cached account list without another active-account request', () => {
  const { client, wrapper } = setup();
  const active = { ...fixtureAccounts[0], status: 'active' as const };
  client.setQueryData(coreFinanceKeys.accounts(true), [
    active,
    { ...fixtureAccounts[1], status: 'archived' },
    { ...fixtureAccounts[2], status: 'closed' }
  ]);
  const read = jest.spyOn(coreFinanceService, 'listAccounts');
  try {
    const { result, unmount } = renderHook(() => useAccounts(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([active]);
    expect(read).not.toHaveBeenCalled();
    unmount();
  } finally {
    read.mockRestore();
    client.clear();
  }
});

it.each(['page', 'pages', 'home', 'today'])(
  'opens a complete cached %s transaction immediately without another detail read',
  (source) => {
    const { client, wrapper } = setup();
    const key =
      source === 'home'
        ? coreFinanceKeys.home('SAR')
        : source === 'pages'
          ? coreFinanceKeys.transactionPages()
          : source === 'today'
            ? [
                'core-finance',
                'transactions',
                'home-today',
                'Asia/Riyadh',
                emptyTransactionFilters
              ]
            : coreFinanceKeys.transactions();
    const data =
      source === 'home'
        ? { recentTransactions: [item] }
        : source === 'pages'
          ? { pages: [{ items: [item], nextCursor: null }], pageParams: [null] }
          : source === 'today'
            ? [{ transaction: item, group: 'expense', sign: 'negative' }]
            : { items: [item], nextCursor: null };
    client.setQueryData(key, data, { updatedAt: 1234 });
    const read = jest.spyOn(coreFinanceService, 'getTransaction');
    try {
      const { result, unmount } = renderHook(() => useTransaction(item.id), {
        wrapper
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({ ...item, adjustmentSign: -1 });
      expect(result.current.dataUpdatedAt).toBe(1234);
      expect(read).not.toHaveBeenCalled();
      unmount();
    } finally {
      read.mockRestore();
      client.clear();
    }
  }
);

it.each(['invalidated', 'owner-cleared', 'reversal', 'pending', 'refund'])(
  'fetches authoritative detail rather than reuse an unsafe %s source',
  async (state) => {
    const { client, wrapper } = setup();
    const cached =
      state === 'reversal' || state === 'refund'
        ? { ...item, type: state }
        : state === 'pending'
          ? { ...item, syncStatus: 'pending' }
          : item;
    const key = coreFinanceKeys.transactions();
    client.setQueryData(key, { items: [cached], nextCursor: null });
    if (state === 'invalidated')
      await client.invalidateQueries({ queryKey: key, refetchType: 'none' });
    if (state === 'invalidated')
      client.setQueryData(coreFinanceKeys.home('SAR'), {
        recentTransactions: [item]
      });
    if (state === 'owner-cleared') client.clear();
    const authoritative = {
      ...item,
      title: 'Authoritative',
      adjustmentSign: -1 as const
    };
    const read = jest
      .spyOn(coreFinanceService, 'getTransaction')
      .mockResolvedValue(authoritative);
    try {
      const { result, unmount } = renderHook(() => useTransaction(item.id), {
        wrapper
      });
      expect(result.current.data).toBeUndefined();
      await waitFor(() => expect(result.current.data).toEqual(authoritative));
      expect(read).toHaveBeenCalledTimes(1);
      unmount();
    } finally {
      read.mockRestore();
      client.clear();
    }
  }
);

it('uses the highest cached version and revalidates it after a financial invalidation', async () => {
  const { client, wrapper } = setup();
  client.setQueryData(coreFinanceKeys.transactions(), {
    items: [{ ...item, version: 3 }],
    nextCursor: null
  });
  client.setQueryData(coreFinanceKeys.home('SAR'), {
    recentTransactions: [{ ...item, version: 2 }]
  });
  const read = jest
    .spyOn(coreFinanceService, 'getTransaction')
    .mockResolvedValue({ ...item, version: 4 });
  try {
    const { result, unmount } = renderHook(() => useTransaction(item.id), {
      wrapper
    });
    expect(result.current.data?.version).toBe(3);
    expect(read).not.toHaveBeenCalled();
    await act(async () => {
      await client.invalidateQueries({
        queryKey: coreFinanceKeys.transaction(item.id)
      });
    });
    await waitFor(() => expect(result.current.data?.version).toBe(4));
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    read.mockRestore();
    client.clear();
  }
});

it('does not pin a previous list version while an authoritative list refresh is outstanding', async () => {
  const { client, wrapper } = setup();
  const key = coreFinanceKeys.transactions();
  client.setQueryData(key, { items: [item], nextCursor: null });
  client.setQueryData(coreFinanceKeys.home('SAR'), {
    recentTransactions: [item]
  });
  let finish!: (page: { items: (typeof item)[]; nextCursor: null }) => void;
  const refreshing = client.fetchQuery({
    queryKey: key,
    staleTime: 0,
    queryFn: () =>
      new Promise<{ items: (typeof item)[]; nextCursor: null }>((resolve) => {
        finish = resolve;
      })
  });
  const read = jest
    .spyOn(coreFinanceService, 'getTransaction')
    .mockResolvedValue({ ...item, version: 2 });
  try {
    const { result, unmount } = renderHook(() => useTransaction(item.id), {
      wrapper
    });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.version).toBe(2));
    expect(read).toHaveBeenCalledTimes(1);
    finish({ items: [{ ...item, version: 2 }], nextCursor: null });
    await refreshing;
    unmount();
  } finally {
    await client.cancelQueries();
    read.mockRestore();
    client.clear();
  }
});

it('does not promote the previous complete account list while it refreshes', async () => {
  const { client, wrapper } = setup();
  const key = coreFinanceKeys.accounts(true);
  client.setQueryData(key, fixtureAccounts);
  const refreshing = client.fetchQuery({
    queryKey: key,
    staleTime: 0,
    queryFn: ({ signal }) =>
      new Promise<typeof fixtureAccounts>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('cancelled')))
      )
  });
  const read = jest
    .spyOn(coreFinanceService, 'listAccounts')
    .mockResolvedValue([]);
  try {
    const { result, unmount } = renderHook(() => useAccounts(), { wrapper });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    await client.cancelQueries();
    await refreshing.catch(() => undefined);
    read.mockRestore();
    client.clear();
  }
});

it('does not fall back to an older posted row when a newer cached version is pending', async () => {
  const { client, wrapper } = setup();
  client.setQueryData(coreFinanceKeys.transactions(), {
    items: [{ ...item, version: 3, syncStatus: 'pending' }],
    nextCursor: null
  });
  client.setQueryData(coreFinanceKeys.home('SAR'), {
    recentTransactions: [{ ...item, version: 2 }]
  });
  const read = jest
    .spyOn(coreFinanceService, 'getTransaction')
    .mockResolvedValue({ ...item, version: 4 });
  try {
    const { result, unmount } = renderHook(() => useTransaction(item.id), {
      wrapper
    });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.version).toBe(4));
    unmount();
  } finally {
    read.mockRestore();
    client.clear();
  }
});
