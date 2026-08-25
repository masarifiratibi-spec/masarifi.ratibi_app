import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import { registerRuntimeUserDataReset } from './runtime-user-data-reset';

let mockDatabase: StatefulSqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (db: StatefulSqlite, operation: (transaction: StatefulSqlite) => Promise<void>) => db.withExclusiveTransactionAsync(operation))
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resetLocalUserData } = require('./local-data-reset') as typeof import('./local-data-reset');

const clearedTables = [
  'notifications',
  'assistant_conversations',
  'assistant_responses',
  'support_drafts',
  'support_tickets',
  'subscription_state',
  'tracking_events',
  'planning_obligation_payments',
  'planning_obligations',
  'finance_corrections',
  'finance_transactions',
  'finance_accounts',
  'demo_seed_markers'
];
const preservedTables = ['schema_migrations'];

beforeEach(async () => {
  mockDatabase = new StatefulSqlite([...clearedTables, ...preservedTables]);
  for (const table of [...clearedTables, ...preservedTables]) {
    await mockDatabase.runAsync(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`, `${table}-1`, '{}');
  }
});

test('deletes every user-data table discovered from the authoritative schema', async () => {
  const runtimeReset = jest.fn();
  const unregister = registerRuntimeUserDataReset(runtimeReset);
  const result = await resetLocalUserData('local-delete-1');

  expect(result).toEqual({ deletedRows: clearedTables.length, operationId: 'local-delete-1' });
  for (const table of clearedTables) expect(mockDatabase.read(table)).toEqual([]);
  expect(mockDatabase.read('schema_migrations')).toHaveLength(1);
  expect(runtimeReset).toHaveBeenCalledTimes(1);
  unregister();
});

test('rolls back all deletes on failure and replays completed operations', async () => {
  mockDatabase.failNextWrite('planning_obligations');
  await expect(resetLocalUserData('local-delete-fail')).rejects.toThrow(
    'injected planning_obligations failure'
  );
  for (const table of [...clearedTables, ...preservedTables]) expect(mockDatabase.read(table)).toHaveLength(1);

  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
});
