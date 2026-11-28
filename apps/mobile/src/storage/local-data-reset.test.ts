import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppShellUserData } from './app-shell-storage';
import { resetLocalUserData } from './local-data-reset';
import { clearPersistedPreferences } from './secure-preferences';
import { registerRuntimeUserDataReset } from './runtime-user-data-reset';
import { readTransactionDraftSnapshot } from './transaction-draft-snapshots';
import { runExclusiveDatabaseTransaction } from './database';
import * as SecureStore from 'expo-secure-store';
import { admitTrackingOwner } from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';

let mockDatabase: StatefulSqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (db: StatefulSqlite, operation: (transaction: StatefulSqlite) => Promise<void>) => db.withExclusiveTransactionAsync(operation))
}));
jest.mock('./app-shell-storage', () => ({
  clearAppShellUserData: jest.fn(async () => undefined)
}));
jest.mock('./secure-preferences', () => ({
  clearPersistedPreferences: jest.fn(async () => undefined)
}));
jest.mock('@/services/platform/ios-shortcut-cleanup', () => ({
  ...jest.requireActual('@/services/platform/ios-shortcut-cleanup'),
  purgeIosShortcutOwner: (owner: string, guard: () => void) =>
    jest.requireActual('./ios-shortcut-storage').purgeIosShortcutOwner(owner, guard)
}));

const clearShellData = jest.mocked(clearAppShellUserData);
const clearPreferences = jest.mocked(clearPersistedPreferences);

const clearedTables = [
  'notifications',
  'assistant_conversations',
  'assistant_responses',
  'support_drafts',
  'support_tickets',
  'subscription_state',
  'tracking_events',
  'sms_import_queue',
  'planning_obligation_payments',
  'planning_obligations',
  'finance_corrections',
  'finance_transactions',
  'finance_accounts',
  'demo_seed_markers'
];
const preservedTables = ['schema_migrations'];

beforeEach(async () => {
  jest.clearAllMocks();
  mockDatabase = new StatefulSqlite([...clearedTables, ...preservedTables]);
  for (const table of [...clearedTables, ...preservedTables]) {
    await mockDatabase.runAsync(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`, `${table}-1`, '{}');
  }
});

test('cold iOS local-data deletion purges owned shortcut records without loading its runtime', async () => {
  const slots = new Map([
    ['masarifi.iosShortcut.enrollment.v1', JSON.stringify({ ownerId: 'local-owner', enabled: true })],
    ['masarifi.iosShortcut.receipt.v1', JSON.stringify({ ownerId: 'local-owner', lastTransactionId: 'old-money' })]
  ]);
  jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async slot => slots.get(slot) ?? null);
  jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async slot => { slots.delete(slot); });
  admitTrackingOwner('local-owner');
  try {
    await resetLocalUserData('ios-cold-local-delete');
    expect(slots.size).toBe(0);
  } finally { clearTrackingIsolation(); jest.restoreAllMocks(); }
});
test('deletes every user-data table discovered from the authoritative schema', async () => {
  await AsyncStorage.setItem('masarifi.tracking.smsImportQueue.v1', 'private SMS');
  const runtimeReset = jest.fn();
  const unregister = registerRuntimeUserDataReset(runtimeReset);
  const result = await resetLocalUserData('local-delete-1');

  expect(result).toEqual({ deletedRows: clearedTables.length, operationId: 'local-delete-1' });
  for (const table of clearedTables) expect(mockDatabase.read(table)).toEqual([]);
  expect(await AsyncStorage.getItem('masarifi.tracking.smsImportQueue.v1')).toBeNull();
  expect(mockDatabase.read('schema_migrations')).toHaveLength(1);
  expect(clearShellData).toHaveBeenCalledTimes(1);
  expect(clearPreferences).toHaveBeenCalledTimes(1);
  expect(runtimeReset).toHaveBeenCalledTimes(1);
  unregister();
});

test('rolls back all deletes on failure and replays completed operations', async () => {
  const runtimeReset = jest.fn();
  const unregister = registerRuntimeUserDataReset(runtimeReset);
  mockDatabase.failNextWrite('planning_obligations');
  await expect(resetLocalUserData('local-delete-fail')).rejects.toThrow(
    'injected planning_obligations failure'
  );
  for (const table of [...clearedTables, ...preservedTables]) expect(mockDatabase.read(table)).toHaveLength(1);
  expect(clearShellData).toHaveBeenCalledTimes(1);
  expect(clearPreferences).toHaveBeenCalledTimes(1);
  expect(runtimeReset).toHaveBeenCalledTimes(1);

  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
  await expect(resetLocalUserData('local-delete-2')).resolves.toMatchObject({ deletedRows: clearedTables.length });
  unregister();
});

test('bypasses and invalidates draft snapshots throughout local deletion', async () => {
  const owner = { userId: 'local-reset-owner', assertCurrent: async () => undefined };
  const read = jest.fn(async () => null);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  jest.mocked(runExclusiveDatabaseTransaction).mockImplementationOnce(async (db, operation) => {
    await readTransactionDraftSnapshot(owner, 'manual', read);
    await readTransactionDraftSnapshot(owner, 'manual', read);
    expect(read).toHaveBeenCalledTimes(3);
    await (db as unknown as StatefulSqlite).withExclusiveTransactionAsync(async () => operation(db));
  });
  await resetLocalUserData('local-delete-snapshots');
  await readTransactionDraftSnapshot(owner, 'manual', read);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  expect(read).toHaveBeenCalledTimes(4);
});
