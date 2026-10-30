import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

import MoreRoute from '@app/(tabs)/more';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import {
  authenticatedSession,
  signedOutSession
} from '@/test-utils/app-shell-fixtures';
import { financialPlanningService } from '@/services/financial-planning-service';
import { createLiveFinancialPlanningService } from '@/services/live/financial-planning-service';
import { registerLiveClerkBridge } from '@/services/live/auth-service';
import { localDateInTimeZone } from '@/domain/financial-period';
import { translate } from '@/localization/i18n';
import { SalaryOverviewScreen } from '@/features/salary/SalaryOverviewScreen';
import { ObligationOverviewScreen } from '@/features/obligations/ObligationOverviewScreen';
import { financialPlanningKeys } from './financial-planning-queries';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';

jest.mock('@/services/financial-planning-service', () => ({
  financialPlanningService: {}
}));
// An empty native secure store returns null; Expo's automatic mock returns undefined.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));

beforeEach(() => {
  useAppShellStore.setState({ session: authenticatedSession });
  usePreferenceStore.setState({ timeZone: 'Asia/Riyadh', hydrated: true });
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'menu-session',
      userId: authenticatedSession.userId!,
      method: 'phone',
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
  });
});

function fixture() {
  const server = { unavailable: false, pending: null as Promise<void> | null };
  const request = jest.fn(async (url: string | URL | Request) => {
    if (server.pending) await server.pending;
    if (server.unavailable)
      return new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }), {
        status: 503
      });
    return new Response(
      JSON.stringify(
        String(url).includes('/planning/summary')
          ? {
              period: '2026-10',
              dataState: 'empty',
              ledgerVersion: 0,
              salary: null,
              budgets: [],
              obligations: { payables: [], receivables: [] },
              savings: []
            }
          : { items: [], nextCursor: null }
      ),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  });
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
  client.setQueryData(['settings', 'profile'], {
    name: 'Menu Owner',
    googleAccount: 'm***@example.test',
    email: 'menu@example.test',
    avatar: 'default',
    phone: null,
    country: 'SA',
    currency: 'SAR',
    timeZone: 'Asia/Riyadh',
    completion: [],
    version: 1
  });
  client.setQueryData(['assistant', 'consent'], { status: 'enabled' });
  client.setQueryData(['assistant', 'availability'], { status: 'available' });
  const wrap = (child: React.ReactNode) => (
    <FoundationProviders client={client}>{child}</FoundationProviders>
  );
  return { request, client, wrap, server };
}

it('prepares salary and obligations while the menu is visible, then opens each without a blocking read', async () => {
  const h = fixture();
  const view = render(h.wrap(<MoreRoute />));
  const today = localDateInTimeZone(Date.now(), 'Asia/Riyadh');
  try {
    await waitFor(() =>
      expect(
        h.client.getQueryData(
          financialPlanningKeys.salary(today, 'Asia/Riyadh')
        )
      ).toBeDefined()
    );
    await waitFor(() =>
      expect(
        h.client.getQueryData([
          ...financialPlanningKeys.obligations(),
          'overview'
        ])
      ).toBeDefined()
    );
    const requestsBeforeOpening = h.request.mock.calls.length;
    view.rerender(h.wrap(<SalaryOverviewScreen />));
    expect(screen.queryByText(translate('planning.state.loading'))).toBeNull();
    expect(
      screen.getByText(translate('planning.salary.setup'))
    ).toBeOnTheScreen();
    view.rerender(h.wrap(<ObligationOverviewScreen />));
    expect(screen.queryByText(translate('planning.state.loading'))).toBeNull();
    expect(screen.getByTestId('obligations-hero')).toBeOnTheScreen();
    expect(h.request.mock.calls).toHaveLength(requestsBeforeOpening);
  } finally {
    view.unmount();
    h.client.clear();
  }
});

it('does not start personal planning reads from the menu while signed out', async () => {
  useAppShellStore.setState({ session: signedOutSession });
  const h = fixture();
  const view = render(h.wrap(<MoreRoute />));
  try {
    await waitFor(() =>
      expect(
        screen.getByLabelText(translate('appShell.shell.profile'))
      ).toBeOnTheScreen()
    );
    expect(h.request).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    h.client.clear();
  }
});

it('retries a failed menu preload when the salary screen opens', async () => {
  const h = fixture();
  h.server.unavailable = true;
  const today = localDateInTimeZone(Date.now(), 'Asia/Riyadh');
  const key = financialPlanningKeys.salary(today, 'Asia/Riyadh');
  const view = render(h.wrap(<MoreRoute />));
  try {
    await waitFor(() =>
      expect(h.client.getQueryState(key)?.status).toBe('error')
    );
    h.server.unavailable = false;
    view.rerender(h.wrap(<SalaryOverviewScreen />));
    expect(
      await screen.findByText(translate('planning.salary.setup'))
    ).toBeOnTheScreen();
    expect(screen.queryByText(translate('planning.state.error'))).toBeNull();
  } finally {
    view.unmount();
    h.client.clear();
  }
});

it('discards a late menu preload when the authenticated identity is reset', async () => {
  const h = fixture();
  let release!: () => void;
  h.server.pending = new Promise((resolve) => {
    release = resolve;
  });
  const view = render(h.wrap(<MoreRoute />));
  try {
    await waitFor(() => expect(h.request).toHaveBeenCalled());
    await act(async () => {
      useAppShellStore.setState({ session: signedOutSession });
      await resetRuntimeIdentityData();
      release();
    });
    expect(
      h.client
        .getQueriesData({ queryKey: ['planning'] })
        .every(([, data]) => data === undefined)
    ).toBe(true);
  } finally {
    release();
    view.unmount();
    h.client.clear();
  }
});
