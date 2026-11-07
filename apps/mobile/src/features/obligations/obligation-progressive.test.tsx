import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useObligationDetail } from './obligation-queries';
import { invalidatePlanningScopes } from '@/features/financial-planning/financial-planning-queries';
import { financialPlanningService } from '@/services/financial-planning-service';
import { createLiveFinancialPlanningService } from '@/services/live/financial-planning-service';
import {
  registerLiveClerkBridge,
  type LiveClerkBridge
} from '@/services/live/auth-service';
import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { fixtureObligation } from '@/test-utils/financial-planning-fixtures';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';

jest.mock('@/services/financial-planning-service', () => ({
  financialPlanningService: {}
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));

it('retains saved schedule and payment history while refreshing the same obligation version', async () => {
  const detail = await createSeededFinancialPlanningService().getObligation(
    fixtureObligation.id
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.assign(financialPlanningService, {
    getObligationHeader: async () => ({ ...detail, sectionsState: 'pending' }),
    getObligationSchedule: async () => {
      await pending;
      throw Error('offline');
    },
    getObligationPayments: async () => {
      await pending;
      throw Error('offline');
    }
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity }
    }
  });
  const base = financialPlanningKeys.obligation(fixtureObligation.id);
  client.setQueryData(
    [...base, 'schedule', detail.obligation.version],
    detail.schedule
  );
  client.setQueryData(
    [
      ...base,
      'payments',
      detail.obligation.currencyCode,
      detail.obligation.version
    ],
    { state: 'available', items: detail.payments }
  );
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useObligationDetail(fixtureObligation.id), {
    wrapper
  });
  try {
    await waitFor(() =>
      expect(view.result.current.data?.obligation.id).toBe(fixtureObligation.id)
    );
    expect(detail.schedule.length).toBeGreaterThan(0);
    expect(view.result.current.data?.schedule).toEqual(detail.schedule);
    expect(view.result.current.data?.payments).toEqual(detail.payments);
    expect(view.result.current.scheduleLoading).toBe(false);
    await act(async () => release());
    await waitFor(() => expect(view.result.current.isRefetching).toBe(false));
    expect(view.result.current.data?.schedule).toEqual(detail.schedule);
  } finally {
    release();
    view.unmount();
    client.clear();
  }
});

it('displays authoritative obligation details while schedule and history are still pending', async () => {
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session',
      userId: 'owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async () => 'fixture',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const id = '70000000-0000-4000-8000-000000000071';
  const wire = {
    id,
    name: 'Car',
    direction: 'payable',
    type: 'installment',
    scheduleKind: 'fixed_term',
    currencyCode: 'SAR',
    principalMinor: '10000',
    openingPaidMinor: '0',
    installmentAmountMinor: '5000',
    installmentCount: 2,
    frequency: 'monthly',
    expectedDay: 8,
    customIntervalDays: null,
    startDate: '2026-10-08',
    endDate: '2026-11-08',
    status: 'active',
    defaultAccountId: null,
    automaticMatchingEnabled: false,
    provider: null,
    providerKeywords: [],
    reminderTiming: null,
    notes: null,
    deletedAt: null,
    version: 1,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    summary: {
      direction: 'payable',
      currencyCode: 'SAR',
      scheduledMinor: '10000',
      allocatedMinor: '0',
      paidMinor: '0',
      remainingMinor: '10000',
      overdueMinor: '0',
      nextDueAt: '2026-11-08T00:00:00.000Z',
      completedInstallmentCount: 0,
      status: 'active',
      ledgerVersion: 1
    }
  };
  let release!: () => void;
  let pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let version = 1;
  const paths: string[] = [];
  const request: typeof fetch = async (url) => {
    const path = String(url);
    paths.push(path);
    if (/\/(schedule|payments)\?/.test(path)) {
      await pending;
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], nextCursor: null })
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...wire, version })
    } as Response;
  };
  Object.assign(
    financialPlanningService,
    createLiveFinancialPlanningService({
      baseUrl: 'https://inert.invalid',
      request
    })
  );
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity }
    }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useObligationDetail(id), { wrapper });
  try {
    await waitFor(() => {
      if (view.result.current.error)
        throw new Error(view.result.current.error.stack);
      expect(view.result.current.data?.obligation.title).toBe('Car');
    });
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.scheduleLoading).toBe(true);
    expect(view.result.current.historyLoading).toBe(true);
    await act(async () => release());
    await waitFor(() => expect(view.result.current.historyLoading).toBe(false));
    expect(view.result.current.data?.paymentHistoryState).toBe('available');
    expect(
      paths.filter((path) => !/\/(schedule|payments)\?/.test(path))
    ).toHaveLength(1);
    version = 2;
    pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refresh = invalidatePlanningScopes(client, [
      'planning.obligation.' + id
    ]);
    try {
      await waitFor(() =>
        expect(view.result.current.data?.obligation.version).toBe(2)
      );
      expect(view.result.current.historyLoading).toBe(true);
    } finally {
      release();
      await act(async () => {
        await refresh;
      });
    }
  } finally {
    release();
    view.unmount();
    client.clear();
  }
});
