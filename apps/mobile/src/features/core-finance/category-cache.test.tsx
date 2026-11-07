import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { coreFinanceKeys, useCategories } from './core-finance-queries';

const active = fixtureCategories[0]!;
const archived = { ...fixtureCategories[1]!, status: 'archived' as const };

function setup(staleTime = Infinity) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime, gcTime: Infinity } }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

it('opens active categories from a confirmed complete list without another read', () => {
  const { client, wrapper } = setup();
  client.setQueryData(coreFinanceKeys.categories(true), [active, archived]);
  const read = jest.spyOn(coreFinanceService, 'listCategories');
  try {
    const { result, unmount } = renderHook(() => useCategories(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([active]);
    expect(read).not.toHaveBeenCalled();
    unmount();
  } finally {
    read.mockRestore();
    client.clear();
  }
});

it('preserves the complete list age so expired categories still refresh', async () => {
  const { client, wrapper } = setup(1000);
  client.setQueryData(coreFinanceKeys.categories(true), [active], {
    updatedAt: Date.now() - 2000
  });
  const updated = { ...active, labelEn: 'Updated category' };
  const read = jest
    .spyOn(coreFinanceService, 'listCategories')
    .mockResolvedValue([updated]);
  try {
    const { result, unmount } = renderHook(() => useCategories(), { wrapper });
    expect(result.current.data).toEqual([active]);
    await waitFor(() => expect(result.current.data).toEqual([updated]));
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    read.mockRestore();
    client.clear();
  }
});

it.each(['invalidated', 'owner-cleared'])(
  'reads current categories instead of promoting a %s complete list',
  async (state) => {
    const { client, wrapper } = setup();
    client.setQueryData(coreFinanceKeys.categories(true), [active]);
    if (state === 'invalidated')
      await client.invalidateQueries({
        queryKey: coreFinanceKeys.categories(true),
        refetchType: 'none'
      });
    else client.clear();
    const read = jest
      .spyOn(coreFinanceService, 'listCategories')
      .mockResolvedValue([]);
    try {
      const { result, unmount } = renderHook(() => useCategories(), {
        wrapper
      });
      expect(result.current.data).toBeUndefined();
      await waitFor(() => expect(result.current.data).toEqual([]));
      unmount();
    } finally {
      read.mockRestore();
      client.clear();
    }
  }
);
