import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { createLiveLedgerService } from '@/services/live/core-finance-service';
import {
  registerLiveClerkBridge,
  type LiveClerkBridge
} from '@/services/live/auth-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { useNetWorthTrend, type ReportTimeframe } from './report-queries';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    listAccounts: jest.fn(async () => []),
    getHomeSummary: jest.fn(async () => ({ components: [] })),
    listTransactions: jest.fn()
  }
}));

it.each(['SAR', 'USD'])('reads the live ledger and requests rates only when an account requires conversion (%s)', async (currencyCode) => {
  jest.clearAllMocks();
  jest.mocked(coreFinanceService.listAccounts).mockResolvedValue([
    { ...fixtureAccounts[0], status: 'active', currencyCode }
  ]);
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session',
      userId: 'owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9_999_999_999_999
    }),
    getToken: async () => 'fixture-token',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const request = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          nextCursor: null,
          ledgerVersion: 1,
          requestId: 'fixture'
        })
      }) as Response
  );
  const live = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request
  });
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockImplementation(live.listTransactions);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ timeframe }: { timeframe: ReportTimeframe }) =>
      useNetWorthTrend({
        accountIds: [],
        anchorDate: '2026-10-17',
        currencyCode: 'SAR',
        timeframe
      }),
    { wrapper, initialProps: { timeframe: 'month' as ReportTimeframe } }
  );
  try {
    await waitFor(() => {
      expect(view.result.current.error).toBeNull();
      expect(view.result.current.isSuccess).toBe(true);
    });
    expect(view.result.current.data).toHaveLength(10);
    expect(coreFinanceService.getHomeSummary).toHaveBeenCalledTimes(currencyCode === 'SAR' ? 0 : 1);
    expect(request).toHaveBeenCalledTimes(1);
    view.rerender({ timeframe: 'week' });
    await waitFor(() => expect(view.result.current.data).toHaveLength(7));
    expect(coreFinanceService.getHomeSummary).toHaveBeenCalledTimes(currencyCode === 'SAR' ? 0 : 1);
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    client.clear();
  }
});
