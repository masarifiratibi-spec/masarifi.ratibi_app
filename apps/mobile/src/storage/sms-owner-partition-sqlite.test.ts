import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SmsImportQueue, type SmsImportQueueState } from './sms-import-queue';
import {
  admitTrackingOwner,
  beginTrackingAdmission
} from '@/state/tracking-admission';
import { pendingOwnerWork } from './pending-owner-work';
import { resetLocalUserData } from './local-data-reset';

interface NativeSqlite {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    get(...args: string[]): Record<string, unknown> | undefined;
    all(): Record<string, unknown>[];
    run(...args: string[]): { changes: number };
  };
}
// Runtime is pinned to Node24; the mobile app's older Node typings do not include this host-only API.
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => NativeSqlite;
}>('node:sqlite');
let mockSqlite: NativeSqlite;
const mockPort = {
  async execAsync(sql: string) {
    mockSqlite.exec(sql);
  },
  async getAllAsync(sql: string) {
    return mockSqlite.prepare(sql).all();
  },
  async getFirstAsync(sql: string, ...args: string[]) {
    return mockSqlite.prepare(sql).get(...args) ?? null;
  },
  async runAsync(sql: string, ...args: string[]) {
    return mockSqlite.prepare(sql).run(...args);
  }
};
jest.mock('./database', () => ({
  openDatabase: async () => mockPort,
  hasQuarantinedOwnerDatabase: async () => false,
  runExclusiveDatabaseTransaction: async (
    _db: unknown,
    run: (tx: typeof mockPort) => Promise<void>
  ) => {
    mockSqlite.exec('BEGIN IMMEDIATE');
    try {
      await run(mockPort);
      mockSqlite.exec('COMMIT');
    } catch (error) {
      mockSqlite.exec('ROLLBACK');
      throw error;
    }
  }
}));
jest.mock('./app-shell-storage', () => ({
  clearAppShellUserData: async () => undefined
}));
jest.mock('./secure-preferences', () => ({
  clearPersistedPreferences: async () => undefined
}));
jest.mock('./runtime-user-data-reset', () => ({
  ...jest.requireActual('./runtime-user-data-reset'),
  resetRuntimeUserData: async () => undefined
}));

const owner = 'user_owned';
const legacyKey = 'masarifi.tracking.smsImportQueue.v1';
function saved(ownerId = owner): SmsImportQueueState {
  return {
    version: 1,
    ownerId,
    pending: [
      {
        idempotencyKey: 'sms:retained-operation',
        sessionId: 'retained-session',
        submission: {
          schemaVersion: 1,
          sourceType: 'sms',
          events: [
            {
              sourceItemKey: 'retained-item',
              amountMinor: -123,
              currency: 'SAR',
              receivedAt: '2026-11-04T00:00:00Z'
            }
          ]
        }
      }
    ],
    cursor: 123,
    fingerprints: ['retained-item'],
    mode: 'paused',
    rules: { keywords: [], senders: [] }
  };
}
let values: Map<string, string>;
const storage = {
  async getItem(key: string) {
    return values.get(key) ?? null;
  },
  async removeItem(key: string) {
    values.delete(key);
  }
};
beforeEach(() => {
  mockSqlite = new DatabaseSync(':memory:');
  mockSqlite.exec(
    "CREATE TABLE sms_import_queue(id TEXT PRIMARY KEY CHECK(id='singleton'),payload TEXT NOT NULL)"
  );
  // Exercise the actual additive migration, not a fake SQL interpreter.
  const source = readFileSync(join(__dirname, 'database.ts'), 'utf8');
  const sql = source.match(
    /-- migration:17\s*([\s\S]*?)(?=-- migration:|`\);)/
  )?.[1];
  if (sql) mockSqlite.exec(sql);
  values = new Map();
  beginTrackingAdmission();
  admitTrackingOwner(
    owner,
    {
      ownerDigest: 'a'.repeat(64),
      generation: '11111111-1111-4111-8111-111111111111'
    },
    'session-owned'
  );
});
afterEach(() => {
  mockSqlite.close();
  beginTrackingAdmission();
});

it.each(['foreign', 'malformed'])(
  'preserves %s legacy SQLite and plaintext bytes across load write and own clear',
  async (kind) => {
    const raw =
      kind === 'foreign'
        ? JSON.stringify(saved('user_foreign'))
        : '{unattributed';
    mockSqlite
      .prepare('INSERT INTO sms_import_queue VALUES(?,?)')
      .run('singleton', raw);
    values.set(legacyKey, raw);
    const queue = new SmsImportQueue(storage);
    expect((await queue.load(owner)).pending).toEqual([]);
    await queue.checkpoint(owner, 456, ['new-item']);
    await queue.clear(owner);
    expect((await new SmsImportQueue(storage).load(owner)).pending).toEqual([]);
    expect(
      mockSqlite.prepare('SELECT payload FROM sms_import_queue').get()
    ).toEqual({ payload: raw });
    expect(values.get(legacyKey)).toBe(raw);
  }
);

it('copies proven same-owner pending work exactly once and never resurrects terminal operations', async () => {
  const original = saved();
  const raw = JSON.stringify(original);
  mockSqlite
    .prepare('INSERT INTO sms_import_queue VALUES(?,?)')
    .run('singleton', raw);
  values.set(legacyKey, raw);
  const queue = new SmsImportQueue(storage);
  expect((await queue.load(owner)).pending).toEqual(original.pending);
  await queue.markTerminal(owner, original.pending[0]!.idempotencyKey);
  expect((await new SmsImportQueue(storage).load(owner)).pending).toEqual([]);
  await queue.clear(owner);
  expect((await new SmsImportQueue(storage).load(owner)).pending).toEqual([]);
  expect(
    mockSqlite.prepare('SELECT payload FROM sms_import_queue').get()
  ).toEqual({ payload: raw });
  expect(values.get(legacyKey)).toBe(raw);
});

it('rejects a mismatched partition row without replacing its bytes', async () => {
  // A corrupted/misbound destination must not be treated as a fresh queue.
  const raw = JSON.stringify(saved('user_foreign'));
  mockSqlite
    .prepare('INSERT INTO sms_import_queue_v3 VALUES(?,?)')
    .run('singleton', raw);
  const queue = new SmsImportQueue(storage);
  await expect(queue.load(owner)).rejects.toThrow(
    'tracking_queue_owner_unavailable'
  );
  await expect(queue.clear(owner)).rejects.toThrow(
    'tracking_queue_owner_unavailable'
  );
  expect(
    mockSqlite.prepare('SELECT payload FROM sms_import_queue_v3').get()
  ).toEqual({ payload: raw });
});

it('counts only current owner pending Tracking work in logout assessment', async () => {
  for (const table of [
    'sync_mutation_queue',
    'finance_drafts',
    'planning_drafts',
    'voice_operation_journal',
    'voice_batch_operations'
  ])
    mockSqlite.exec(`CREATE TABLE ${table}(status TEXT,payload TEXT)`);
  mockSqlite
    .prepare('INSERT INTO sms_import_queue VALUES(?,?)')
    .run('singleton', JSON.stringify(saved('user_foreign')));
  const queue = new SmsImportQueue(storage);
  await queue.enqueue(owner, {
    idempotencyKey: 'new-operation',
    submission: saved().pending[0]!.submission,
    cursor: 123,
    fingerprints: ['new-item']
  });
  await queue.enqueue(owner, {
    idempotencyKey: 'second-operation',
    submission: saved().pending[0]!.submission,
    cursor: 123,
    fingerprints: ['second-item']
  });
  expect(await pendingOwnerWork(owner)).toBe(2);
});

it('clears current local data without deleting legacy Tracking or reimporting completed work', async () => {
  const raw = JSON.stringify(saved('user_foreign'));
  mockSqlite
    .prepare('INSERT INTO sms_import_queue VALUES(?,?)')
    .run('singleton', raw);
  mockSqlite.exec(
    'CREATE TABLE finance_drafts(id TEXT PRIMARY KEY,payload TEXT)'
  );
  mockSqlite
    .prepare('INSERT INTO finance_drafts VALUES(?,?)')
    .run('current-draft', '{}');
  await new SmsImportQueue(storage).checkpoint(owner, 456, []);
  await resetLocalUserData('partition-local-clear');
  expect(
    mockSqlite.prepare('SELECT payload FROM sms_import_queue').get()
  ).toEqual({ payload: raw });
  expect(mockSqlite.prepare('SELECT * FROM finance_drafts').all()).toEqual([]);
  expect((await new SmsImportQueue(storage).load(owner)).pending).toEqual([]);
});
