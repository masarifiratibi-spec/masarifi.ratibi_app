import {
  subscriptionOperationSchema,
  subscriptionStateSchema,
  type SubscriptionOperation,
  type SubscriptionState
} from '@/domain/subscriptions';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';

type PayloadRow = { payload: string };

export class SubscriptionsRepository {
  async getState(): Promise<SubscriptionState> {
    return requirePayload(await openDatabase(), 'subscription_state', 'id', 'singleton', subscriptionStateSchema);
  }

  async saveState(input: SubscriptionState, expectedVersion: number | null): Promise<SubscriptionState> {
    const state = subscriptionStateSchema.parse(input);
    const database = await openDatabase();
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const current = await optionalPayload(transaction, 'subscription_state', 'id', 'singleton', subscriptionStateSchema);
      if (current) throw new Error('state_immutable');
      checkNextVersion(null, expectedVersion, state.version);
      await persistState(transaction, state);
    });
    return state;
  }

  async getOperation(operationId: string): Promise<SubscriptionOperation> {
    return requirePayload(await openDatabase(), 'subscription_operations', 'operation_id', operationId, subscriptionOperationSchema);
  }

  async startOperation(input: SubscriptionOperation): Promise<SubscriptionOperation> {
    const operation = subscriptionOperationSchema.parse(input);
    if (!['review', 'pending'].includes(operation.status)) throw new Error('invalid_status');
    const database = await openDatabase();
    let stored = operation;
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const replay = await optionalPayload(transaction, 'subscription_operations', 'operation_id', operation.operationId, subscriptionOperationSchema);
      if (replay) { stored = replay; return; }
      const state = await requirePayload(transaction, 'subscription_state', 'id', 'singleton', subscriptionStateSchema);
      if (state.version !== operation.priorStateVersion) throw new Error('conflict');
      await persistOperation(transaction, operation);
    });
    return stored;
  }

  async completeOperation(input: SubscriptionOperation, nextState?: SubscriptionState): Promise<SubscriptionOperation> {
    const completion = subscriptionOperationSchema.parse(input);
    if (!['succeeded', 'failed', 'cancelled'].includes(completion.status)) throw new Error('invalid_status');
    const database = await openDatabase();
    let stored = completion;
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const current = await requirePayload(transaction, 'subscription_operations', 'operation_id', completion.operationId, subscriptionOperationSchema);
      if (isTerminal(current.status)) { stored = current; return; }
      if (!sameOperation(current, completion)) throw new Error('operation_immutable');
      if (completion.status === 'succeeded') {
        if (!nextState) throw new Error('state_required');
        await applySuccessfulCompletion(transaction, completion, nextState);
      }
      else await persistOperation(transaction, completion);
    });
    return stored;
  }
}

async function applySuccessfulCompletion(database: SQLiteDatabase, operation: SubscriptionOperation, input: SubscriptionState): Promise<void> {
  const state = subscriptionStateSchema.parse(input);
  const current = await requirePayload(database, 'subscription_state', 'id', 'singleton', subscriptionStateSchema);
  if (current.version !== operation.priorStateVersion || state.version !== current.version + 1 || operation.resultStateVersion !== state.version) throw new Error('conflict');
  await persistOperation(database, operation);
  await persistState(database, state);
}

function sameOperation(current: SubscriptionOperation, completion: SubscriptionOperation): boolean {
  return current.id === completion.id && current.operationId === completion.operationId && current.kind === completion.kind &&
    current.offerId === completion.offerId && current.catalogVersion === completion.catalogVersion && current.priorStateVersion === completion.priorStateVersion;
}

function isTerminal(status: SubscriptionOperation['status']): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function checkNextVersion(current: number | null, expected: number | null, next: number): void {
  if (current !== expected || next !== (current ?? 0) + 1) throw new Error('conflict');
}

function persistState(database: Pick<SQLiteDatabase, 'runAsync'>, state: SubscriptionState): Promise<unknown> {
  return database.runAsync(
    'INSERT INTO subscription_state (id, payload, status, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, status = excluded.status, updated_at = excluded.updated_at',
    'singleton', JSON.stringify(state), state.status, state.updatedAt
  );
}

function persistOperation(database: Pick<SQLiteDatabase, 'runAsync'>, operation: SubscriptionOperation): Promise<unknown> {
  return database.runAsync(
    'INSERT INTO subscription_operations (id, payload, operation_id, kind, status, requested_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, operation_id = excluded.operation_id, kind = excluded.kind, status = excluded.status, requested_at = excluded.requested_at',
    operation.id, JSON.stringify(operation), operation.operationId, operation.kind, operation.status, operation.requestedAt
  );
}

async function requirePayload<T>(database: Pick<SQLiteDatabase, 'getFirstAsync'>, table: string, column: string, key: string, schema: Parser<T>): Promise<T> {
  const stored = await optionalPayload(database, table, column, key, schema);
  if (!stored) throw new Error('not_found');
  return stored;
}

async function optionalPayload<T>(database: Pick<SQLiteDatabase, 'getFirstAsync'>, table: string, column: string, key: string, schema: Parser<T>): Promise<T | null> {
  const row = await database.getFirstAsync<PayloadRow>(`SELECT payload FROM ${table} WHERE ${column} = ?`, key);
  return row ? schema.parse(JSON.parse(row.payload)) : null;
}

type Parser<T> = { parse(value: unknown): T };
