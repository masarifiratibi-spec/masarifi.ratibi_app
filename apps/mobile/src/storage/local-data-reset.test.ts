import { StatefulSqlite } from '@/test-utils/stateful-sqlite';

let mockDatabase: StatefulSqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (db: StatefulSqlite, operation: (transaction: StatefulSqlite) => Promise<void>) => db.withExclusiveTransactionAsync(operation))
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resetLocalUserData } = require('./local-data-reset') as typeof import('./local-data-reset');

const clearedTables = ['notifications', 'assistant_conversations', 'support_drafts', 'finance_transactions'];
const preservedTables = ['security_events', 'subscription_state', 'profile_preferences'];

beforeEach(async () => {
  mockDatabase = new StatefulSqlite([...clearedTables, ...preservedTables]);
  for (const table of [...clearedTables, ...preservedTables]) {
    await mockDatabase.runAsync(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`, `${table}-1`, '{}');
  }
});

test('deletes only allowlisted local user tables and preserves session/security/profile/entitlement data', async () => {
  const result = await resetLocalUserData('local-delete-1');

  expect(result).toEqual({ deletedRows: clearedTables.length, operationId: 'local-delete-1' });
  for (const table of clearedTables) expect(mockDatabase.read(table)).toEqual([]);
  for (const table of preservedTables) expect(mockDatabase.read(table)).toHaveLength(1);
});

test('rolls back all deletes on failure and replays completed operations', async () => {
  mockDatabase.failNextWrite('support_drafts');
  await expect(resetLocalUserData('local-delete-fail')).rejects.toThrow('injected support_drafts failure');
  for (const table of [...clearedTables, ...preservedTables]) expect(mockDatabase.read(table)).toHaveLength(1);

  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
});
