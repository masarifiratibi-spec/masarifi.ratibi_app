import type { SubscriptionOperation, SubscriptionState } from '@/domain/subscriptions';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';

let mockDatabase: StatefulSqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (database: StatefulSqlite, operation: (transaction: StatefulSqlite) => Promise<void>) => database.withExclusiveTransactionAsync(operation))
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionsRepository } = require('./subscriptions-repository') as typeof import('./subscriptions-repository');

const freeState = (version = 1): SubscriptionState => ({
  plan: 'free', status: 'free', offerId: 'free', catalogVersion: 'v1', startedAt: null, trialEndsAt: null,
  renewsAt: null, accessEndsAt: null, limits: {}, version, paidContentAccess: 'editable', updatedAt: version
});

const activeState = (version = 2): SubscriptionState => ({
  plan: 'basic', status: 'active', offerId: 'basic-monthly', catalogVersion: 'v1', startedAt: 2, trialEndsAt: null,
  renewsAt: 30, accessEndsAt: null, limits: { reports: 5 }, version, paidContentAccess: 'editable', updatedAt: version
});

const operation = (operationId: string, status: SubscriptionOperation['status'] = 'pending'): SubscriptionOperation => ({
  id: `record-${operationId}`, operationId, kind: 'purchase', offerId: 'basic-monthly', catalogVersion: 'v1',
  priorStateVersion: 1, status, requestedAt: 1, completedAt: status === 'pending' ? null : 2,
  safeFailure: status === 'failed' ? 'offline' : null, resultStateVersion: status === 'succeeded' ? 2 : null
});

beforeEach(() => {
  mockDatabase = new StatefulSqlite(['subscription_state', 'subscription_operations']);
});

test('persists exactly one version-checked subscription state row', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);

  await expect(repository.saveState(activeState(), 1)).rejects.toThrow('state_immutable');
  expect(await new SubscriptionsRepository().getState()).toEqual(freeState());
  expect(mockDatabase.read('subscription_state')).toHaveLength(1);
  expect(mockDatabase.read('subscription_state')[0].id).toBe('singleton');
});

test('rejects a new operation whose prior state version is stale', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);

  await expect(repository.startOperation({ ...operation('stale'), priorStateVersion: 9 })).rejects.toThrow('conflict');
  expect(mockDatabase.read('subscription_operations')).toEqual([]);
});

test('replays the exact operation for a unique operation id', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);
  const original = await repository.startOperation(operation('same'));

  expect(await repository.startOperation({ ...operation('same'), id: 'different', offerId: 'premium-monthly' })).toEqual(original);
  expect(mockDatabase.read('subscription_operations')).toHaveLength(1);
});

test('changes singleton state only when operation completion succeeds', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);
  await repository.startOperation(operation('failed'));

  await repository.completeOperation(operation('failed', 'failed'));
  expect(await repository.getState()).toEqual(freeState());

  await repository.startOperation(operation('success'));
  await repository.completeOperation(operation('success', 'succeeded'), activeState());
  expect(await repository.getState()).toEqual(activeState());
});

test('replays a completed result without applying another state change', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);
  await repository.startOperation(operation('success'));
  const completed = await repository.completeOperation(operation('success', 'succeeded'), activeState());

  const replay = await repository.completeOperation({ ...operation('success', 'succeeded'), completedAt: 99 }, { ...activeState(3), updatedAt: 99 });
  expect(replay).toEqual(completed);
  expect(await repository.getState()).toEqual(activeState());
});

test('rolls back a successful operation update when the state write fails', async () => {
  const repository = new SubscriptionsRepository();
  await repository.saveState(freeState(), null);
  await repository.startOperation(operation('atomic'));
  mockDatabase.failNextWrite('subscription_state');

  await expect(repository.completeOperation(operation('atomic', 'succeeded'), activeState())).rejects.toThrow('injected subscription_state failure');
  expect(await repository.getOperation('atomic')).toEqual(operation('atomic'));
  expect(await repository.getState()).toEqual(freeState());
});
