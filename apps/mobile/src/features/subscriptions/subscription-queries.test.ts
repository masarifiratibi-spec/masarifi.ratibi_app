import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { subscriptionService } from '@/services/mocks/subscription-settings-service';
import {
  subscriptionKeys,
  useCompleteSubscriptionOperation,
  useStartSubscriptionOperation,
  useSubscriptionCatalog,
  useSubscriptionOperation,
  useSubscriptionState
} from './subscription-queries';

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(callback);
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    callback();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('loads catalog, state, and operation from the subscription service owner', async () => {
  const { wrapper } = queryHarness();
  const catalog = { version: '2026-01', offers: [] };
  const state = subscriptionState();
  const operation = subscriptionOperation({ operationId: 'op-1' });
  jest.spyOn(subscriptionService, 'getCatalog').mockResolvedValue(catalog as never);
  jest.spyOn(subscriptionService, 'getState').mockResolvedValue(state as never);
  jest.spyOn(subscriptionService, 'getOperation').mockResolvedValue(operation as never);

  const catalogQuery = renderHook(() => useSubscriptionCatalog(), { wrapper });
  const stateQuery = renderHook(() => useSubscriptionState(), { wrapper });
  const operationQuery = renderHook(() => useSubscriptionOperation('op-1'), { wrapper });

  await waitFor(() => expect(catalogQuery.result.current.data).toBe(catalog));
  await waitFor(() => expect(stateQuery.result.current.data).toBe(state));
  await waitFor(() => expect(operationQuery.result.current.data).toBe(operation));

  expect(subscriptionService.getOperation).toHaveBeenCalledWith('op-1');
});

it('invalidates state and operation only after successful lifecycle mutations', async () => {
  const { client, wrapper } = queryHarness();
  const operation = subscriptionOperation({ operationId: 'purchase-1', status: 'review' });
  jest.spyOn(subscriptionService, 'startOperation').mockResolvedValue({
    value: operation,
    affectedScopes: ['subscriptions.operation.purchase-1']
  } as never);
  jest.spyOn(subscriptionService, 'completeMockOperation').mockResolvedValue({
    value: { ...operation, status: 'succeeded', resultStateVersion: 2 },
    affectedScopes: ['subscriptions.operation.purchase-1', 'subscriptions.state']
  } as never);
  client.setQueryData(subscriptionKeys.state(), subscriptionState());
  client.setQueryData(subscriptionKeys.operation('purchase-1'), operation);

  const start = renderHook(() => useStartSubscriptionOperation(), { wrapper });
  const complete = renderHook(() => useCompleteSubscriptionOperation(), { wrapper });

  await act(async () => {
    await start.result.current.mutateAsync({
      input: { kind: 'purchase', offerId: 'premium-annual', catalogVersion: '2026-01' },
      expectedVersion: 1,
      operationId: 'purchase-1'
    });
    await complete.result.current.mutateAsync({ operationId: 'purchase-1', outcome: 'success' });
  });

  expect(subscriptionService.startOperation).toHaveBeenCalledWith(
    { kind: 'purchase', offerId: 'premium-annual', catalogVersion: '2026-01' },
    1,
    'purchase-1'
  );
  expect(client.getQueryState(subscriptionKeys.operation('purchase-1'))?.isInvalidated).toBe(true);
  expect(client.getQueryState(subscriptionKeys.state())?.isInvalidated).toBe(true);
});

it('preserves cached state after a failed mutation', async () => {
  const { client, wrapper } = queryHarness();
  const state = subscriptionState();
  client.setQueryData(subscriptionKeys.state(), state);
  jest.spyOn(subscriptionService, 'startOperation').mockRejectedValue(new Error('conflict'));

  const start = renderHook(() => useStartSubscriptionOperation(), { wrapper });
  await expect(
    start.result.current.mutateAsync({
      input: { kind: 'purchase', offerId: 'basic-monthly', catalogVersion: '2026-01' },
      expectedVersion: 99,
      operationId: 'conflict'
    })
  ).rejects.toThrow('conflict');

  expect(client.getQueryData(subscriptionKeys.state())).toEqual(state);
});

function queryHarness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false }
    }
  });
  const wrapper = ({ children }: PropsWithChildren) => React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

function subscriptionState() {
  return {
    plan: 'free',
    status: 'free',
    offerId: 'free',
    catalogVersion: '2026-01',
    startedAt: null,
    trialEndsAt: null,
    renewsAt: null,
    accessEndsAt: null,
    limits: { assistantQuestions: 5 },
    version: 1,
    paidContentAccess: 'editable',
    updatedAt: 1
  };
}

function subscriptionOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    operationId: 'op-1',
    kind: 'purchase',
    offerId: 'premium-annual',
    catalogVersion: '2026-01',
    priorStateVersion: 1,
    status: 'review',
    requestedAt: 1,
    completedAt: null,
    safeFailure: null,
    resultStateVersion: null,
    ...overrides
  };
}
