import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { changeLocale, translate } from '@/localization/i18n';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { financialPlanningService } from '@/services/financial-planning-service';
import { createLiveFinancialPlanningService } from '@/services/live/financial-planning-service';
import { registerLiveClerkBridge } from '@/services/live/auth-service';
import { ObligationForm } from './ObligationForm';

jest.mock('@/config/demo-mode', () => ({
  isFixtureModeEnabled: () => false,
  isDemoModeEnabled: () => false
}));
jest.mock('@/services/financial-planning-service', () => ({ financialPlanningService: {} }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);
jest.mock('@/services/mocks/core-finance-service', () => {
  const actual = jest.requireActual<typeof import('@/services/mocks/core-finance-service')>(
    '@/services/mocks/core-finance-service'
  );
  return { ...actual, coreFinanceService: actual.createSeededCoreFinanceService() };
});

it('withdraws the previous owner and ID working copy even when its old HTTP read resolves late', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hydrated: true, locale: 'en', direction: 'ltr' });
  const previous = useAppShellStore.getState();
  const firstId = '70000000-0000-4000-8000-000000000081';
  const secondId = '70000000-0000-4000-8000-000000000082';
  const missingId = '70000000-0000-4000-8000-000000000083';
  const session = (userId: string) => ({
    status: 'authenticated' as const, userId, method: 'google' as const,
    issuedAt: 1, expiresAt: 9999999999999, restoration: 'restored' as const
  });
  const owner = () => {
    const ownerId = useAppShellStore.getState().session?.userId;
    if (!ownerId) throw new Error('Test session is missing');
    return ownerId;
  };
  useAppShellStore.setState({ session: session('edit-owner-a'), hydrated: false });
  registerLiveClerkBridge({
    getSession: async () => ({ ...session(owner()), id: owner() }),
    getToken: async () => owner(), startPhone: jest.fn(), verifyPhone: jest.fn(),
    resendPhone: jest.fn(), signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(), signOut: jest.fn()
  });
  let releaseOld!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  let oldReadStarted!: () => void;
  const oldRead = new Promise<void>((resolve) => { oldReadStarted = resolve; });
  let holdOld = false;
  const writes: { owner: string; method: string; body: { expectedVersion: number; patch: { name: string } } }[] = [];
  const wire = (id: string, readOwner: string) => ({
    id, name: id === secondId ? 'Second obligation' : `${readOwner} obligation`,
    direction: 'payable', type: 'custom', scheduleKind: 'fixed_term', currencyCode: 'SAR',
    principalMinor: '1000', openingPaidMinor: '0', installmentAmountMinor: '1000',
    installmentCount: 1, frequency: 'monthly', expectedDay: 4, customIntervalDays: null,
    startDate: '2026-11-04', endDate: '2026-11-04', status: 'active',
    defaultAccountId: null, automaticMatchingEnabled: false, provider: null,
    providerKeywords: [], reminderTiming: null, notes: null, deletedAt: null,
    version: readOwner === 'edit-owner-a' ? 7 : id === secondId ? 3 : 2,
    createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z',
    summary: null
  });
  const response = (status: number, body: unknown) => ({
    ok: status < 400, status, json: async () => body
  }) as Response;
  const request: typeof fetch = async (url, init) => {
    const readOwner = new Headers(init?.headers).get('Authorization')!.replace('Bearer ', '');
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ owner: readOwner, method, body: JSON.parse(String(init?.body)) });
      return response(409, { code: 'conflict', message: 'Changed concurrently' });
    }
    if (String(url).includes(missingId)) return response(404, { code: 'not_found' });
    if (readOwner === 'edit-owner-a' && holdOld) {
      oldReadStarted();
      await oldResponse;
    }
    if (/\/(schedule|payments)\?/.test(String(url)))
      return response(200, { items: [], nextCursor: null });
    return response(200, wire(String(url).includes(secondId) ? secondId : firstId, readOwner));
  };
  Object.assign(financialPlanningService, createLiveFinancialPlanningService({
    baseUrl: 'https://inert.invalid', request, persistent: false
  }));
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity }
  } });
  const tree = (id: string | null) => (
    <FoundationProviders client={client}>
      {id ? <ObligationForm obligationId={id} /> : null}
    </FoundationProviders>
  );
  const view = render(tree(null));
  try {
    const original = await financialPlanningService.getObligation(firstId);
    await act(async () => {
      client.setQueryData(financialPlanningKeys.obligation(firstId), original);
      client.setQueryData([...financialPlanningKeys.obligation(firstId), 'header'], original);
    });
    view.rerender(tree(firstId));
    await view.findByDisplayValue('edit-owner-a obligation');
    holdOld = true;
    let pendingRefresh!: Promise<unknown>;
    await act(async () => {
      fireEvent.changeText(view.getByLabelText('Obligation name'), 'Private unsaved A');
      pendingRefresh = client.refetchQueries({ queryKey: financialPlanningKeys.obligation(firstId) });
      await oldRead;
      useAppShellStore.setState({ session: session('edit-owner-b') });
    });
    await view.findByDisplayValue('edit-owner-b obligation');
    expect(view.queryByDisplayValue('Private unsaved A')).toBeNull();
    await act(async () => { releaseOld(); await pendingRefresh; });
    expect(view.getByLabelText('Obligation name').props.value).toBe('edit-owner-b obligation');
    fireEvent.changeText(view.getByLabelText('Obligation name'), 'Owner B edit');
    fireEvent.press(view.getByRole('button', { name: 'Save obligation' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ owner: 'edit-owner-b', method: 'PATCH',
      body: { expectedVersion: 2, patch: { name: 'Owner B edit' } } });
    view.rerender(tree(secondId));
    await view.findByDisplayValue('Second obligation');
    expect(view.queryByDisplayValue('Owner B edit')).toBeNull();
    view.rerender(tree(missingId));
    await view.findByText(translate('planning.state.error'));
    expect(view.queryByRole('button', { name: 'Save obligation' })).toBeNull();
    expect(writes).toHaveLength(1);
  } finally {
    releaseOld(); view.unmount(); client.clear();
    useAppShellStore.setState(previous);
  }
});
