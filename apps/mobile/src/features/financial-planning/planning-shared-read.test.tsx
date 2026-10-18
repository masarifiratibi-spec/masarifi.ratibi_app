import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePlanningOverview,
  useSalaryOverview
} from './financial-planning-queries';
import { financialPlanningService } from '@/services/financial-planning-service';
import { createLiveFinancialPlanningService } from '@/services/live/financial-planning-service';
import {
  registerLiveClerkBridge,
  type LiveClerkBridge
} from '@/services/live/auth-service';

jest.mock('@/services/financial-planning-service', () => ({
  financialPlanningService: {}
}));

it('shares one summary across salary and two currency projections', async () => {
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
  const request = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          period: '2026-10',
          dataState: 'empty',
          ledgerVersion: 0,
          salary: null,
          budgets: [],
          obligations: { payables: [], receivables: [] },
          savings: []
        })
      }) as Response
  );
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
  const view = renderHook(
    () => ({
      salary: useSalaryOverview('2026-10-17', 'Asia/Riyadh'),
      sar: usePlanningOverview('SAR', '2026-10-17', 'Asia/Riyadh'),
      usd: usePlanningOverview('USD', '2026-10-17', 'Asia/Riyadh')
    }),
    { wrapper }
  );
  try {
    await waitFor(() =>
      expect(
        view.result.current.usd.isSuccess &&
          view.result.current.sar.isSuccess &&
          view.result.current.salary.isSuccess
      ).toBe(true)
    );
    expect(view.result.current.usd.data?.obligationsDueMinor).toMatchObject({
      status: 'available',
      value: { currencyCode: 'USD', minorUnits: 0 }
    });
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    client.clear();
  }
});
