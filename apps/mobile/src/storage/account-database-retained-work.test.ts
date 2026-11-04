import { createHash } from 'node:crypto';
import {
  configureDatabaseOwner,
  openDatabase,
  purgeAccountDatabase,
  clearDatabaseOwner,
  resetDatabaseForTests
} from './database';

interface NativeDatabase {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    get(...values: unknown[]): Record<string, unknown> | undefined;
    all(...values: unknown[]): Record<string, unknown>[];
    run(...values: unknown[]): { changes: number };
  };
}
const { DatabaseSync: mockDatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => NativeDatabase;
}>('node:sqlite');
const mockFiles = new Set<string>();
const mockDatabases = new Map<string, NativeDatabase>();
const mockSecrets = new Map<string, string>();
let mockNextKey = 1;
let mockDeleteFailure: string | null = null;
let mockLegacyClaims: string[] | null = null;
const owner = 'user_purge_a';
const other = 'user_purge_b';
const hash = (id: string) => createHash('sha256').update(id).digest('hex');
const filename = (id: string) => `masarifi-${hash(id).slice(0, 24)}.db`;
const key = (id: string) => `masarifi.database.key.${hash(id)}`;
const previousMode = process.env.EXPO_PUBLIC_CLIENT_MODE;

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex'),
  getRandomBytesAsync: async () => new Uint8Array(32).fill(mockNextKey++)
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (name: string) =>
    name === 'masarifi.database.legacyOwnerHash' && mockLegacyClaims?.length
      ? mockLegacyClaims.shift()!
      : (mockSecrets.get(name) ?? null),
  setItemAsync: async (name: string, value: string) => {
    mockSecrets.set(name, value);
  },
  deleteItemAsync: async (name: string) => {
    mockSecrets.delete(name);
  }
}));
jest.mock('expo-file-system', () => ({
  File: class {
    readonly filename: string;
    constructor(_directory: string, name: string) {
      this.filename = name;
    }
    get exists() {
      return mockFiles.has(this.filename);
    }
    delete() {
      if (this.filename === mockDeleteFailure)
        throw new Error('synthetic filesystem interruption');
      mockFiles.delete(this.filename);
    }
  }
}));
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/synthetic/SQLite',
  openDatabaseAsync: async (name: string) => {
    let db = mockDatabases.get(name);
    if (!db || !mockFiles.has(name)) {
      db = new mockDatabaseSync(':memory:');
      mockDatabases.set(name, db);
      for (const suffix of ['', '-wal', '-shm']) mockFiles.add(name + suffix);
    }
    const raw = db;
    let closed = false;
    const check = () => {
      if (closed) throw new Error('closed database');
    };
    const port = {
      execAsync: async (sql: string) => {
        check();
        raw.exec(sql);
      },
      getFirstAsync: async (sql: string, ...values: unknown[]) => {
        check();
        // SQLCipher is the unavailable host boundary; every application SQL query is real.
        return sql.trim() === 'PRAGMA cipher_version'
          ? { cipher_version: '4.6.1' }
          : (raw.prepare(sql).get(...values) ?? null);
      },
      getAllAsync: async (sql: string, ...values: unknown[]) => {
        check();
        return raw.prepare(sql).all(...values);
      },
      runAsync: async (sql: string, ...values: unknown[]) => {
        check();
        return raw.prepare(sql).run(...values);
      },
      closeAsync: async () => {
        closed = true;
      },
      withExclusiveTransactionAsync: async (
        action: (tx: unknown) => Promise<void>
      ) => {
        check();
        raw.exec('BEGIN IMMEDIATE');
        try {
          await action(port);
          raw.exec('COMMIT');
        } catch (error) {
          raw.exec('ROLLBACK');
          throw error;
        }
      }
    };
    return port;
  }
}));

beforeEach(async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  resetDatabaseForTests();
  await clearDatabaseOwner(undefined, { preservePendingWork: true });
  mockFiles.clear();
  mockSecrets.clear();
  mockDatabases.clear();
  mockNextKey = 1;
  mockDeleteFailure = null;
  mockLegacyClaims = null;
  mockFiles.add(filename(other));
  mockSecrets.set(key(other), 'b'.repeat(64));
  await configureDatabaseOwner(owner);
  await openDatabase(owner);
});
afterEach(async () => {
  await clearDatabaseOwner(undefined, { preservePendingWork: true });
  for (const db of mockDatabases.values()) db.close();
  resetDatabaseForTests();
  if (previousMode === undefined) delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  else process.env.EXPO_PUBLIC_CLIENT_MODE = previousMode;
});

it.each(
  ['sms_import_queue', 'sms_import_queue_v3'].flatMap((table) => [
    [
      table,
      'foreign',
      JSON.stringify({
        version: 1,
        ownerId: other,
        pending: [{ idempotencyKey: 'retained-original' }]
      })
    ],
    [table, 'unattributed', JSON.stringify({ version: 1, pending: [] })],
    [table, 'malformed', '{retained-corrupt-original']
  ])
)(
  'preserves %s %s retained work during physical owner purge',
  async (table, _kind, payload) => {
    const db = mockDatabases.get(filename(owner))!;
    db.prepare(
      `INSERT INTO ${table}(id,payload) VALUES('singleton',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`
    ).run(payload);
    const secret = mockSecrets.get(key(owner));
    await expect(purgeAccountDatabase(owner)).rejects.toThrow();
    expect(mockFiles.has(filename(owner))).toBe(true);
    expect(mockSecrets.get(key(owner))).toBe(secret);
    expect(db.prepare(`SELECT payload FROM ${table}`).get()?.payload).toBe(
      payload
    );
    expect(mockFiles.has(filename(other))).toBe(true);
    expect(mockSecrets.get(key(other))).toBe('b'.repeat(64));
  }
);

it('erases explicitly owned tracking data and its key while preserving the other owner', async () => {
  const db = mockDatabases.get(filename(owner))!;
  db.prepare(
    "INSERT INTO sms_import_queue(id,payload) VALUES('singleton',?)"
  ).run(JSON.stringify({ version: 1, ownerId: owner, pending: [] }));
  await purgeAccountDatabase(owner);
  expect(mockFiles.has(filename(owner))).toBe(false);
  expect(mockSecrets.has(key(owner))).toBe(false);
  expect(mockFiles.has(filename(other))).toBe(true);
  expect(mockSecrets.get(key(other))).toBe('b'.repeat(64));
});

it('resumes a partial verified removal after reconstruction without inspecting an orphan sidecar as a new database', async () => {
  mockDeleteFailure = filename(owner) + '-wal';
  await expect(purgeAccountDatabase(owner)).rejects.toThrow(
    'synthetic filesystem interruption'
  );
  expect(mockFiles.has(filename(owner))).toBe(false);
  expect(mockFiles.has(mockDeleteFailure)).toBe(true);
  expect(mockSecrets.has(key(owner))).toBe(true);
  resetDatabaseForTests();
  await configureDatabaseOwner(owner);
  await expect(openDatabase(owner)).rejects.toThrow(
    'database purge incomplete'
  );
  expect(mockFiles.has(filename(owner))).toBe(false);
  expect(mockFiles.has(mockDeleteFailure)).toBe(true);
  mockDeleteFailure = null;
  await purgeAccountDatabase(owner);
  expect(mockFiles.has(filename(owner) + '-wal')).toBe(false);
  expect(mockSecrets.has(key(owner))).toBe(false);
  expect(mockSecrets.get(key(other))).toBe('b'.repeat(64));
});

it('preserves an unattributed sidecar and its retained key when the original database is missing', async () => {
  await clearDatabaseOwner(undefined, { preservePendingWork: true });
  mockFiles.delete(filename(owner));
  await expect(purgeAccountDatabase(owner)).rejects.toThrow(
    'database purge attribution unavailable'
  );
  expect(mockFiles.has(filename(owner) + '-wal')).toBe(true);
  expect(mockSecrets.has(key(owner))).toBe(true);
});

it.each(['malformed', 'foreign-owner', 'foreign-target'] as const)(
  'rejects a %s purge receipt without removing data or keys',
  async (kind) => {
    const record =
      kind === 'malformed'
        ? '{retained-unknown-receipt'
        : JSON.stringify({
            version: 1,
            ownerHash: kind === 'foreign-owner' ? hash(other) : hash(owner),
            targets: [filename(kind === 'foreign-target' ? other : owner)]
          });
    mockSecrets.set(`masarifi.database.purge.${hash(owner)}`, record);
    await expect(purgeAccountDatabase(owner)).rejects.toThrow(
      'database purge attribution unavailable'
    );
    expect(mockFiles.has(filename(owner))).toBe(true);
    expect(mockSecrets.has(key(owner))).toBe(true);
    expect(mockFiles.has(filename(other))).toBe(true);
    expect(mockSecrets.get(`masarifi.database.purge.${hash(owner)}`)).toBe(
      record
    );
  }
);

it('preserves an uninspected legacy file when its protected claim changes after the purge target snapshot', async () => {
  for (const suffix of ['', '-wal', '-shm'])
    mockFiles.add('masarifi.db' + suffix);
  mockSecrets.set('masarifi.database.legacyOwnerHash', hash(other));
  mockLegacyClaims = [hash(other), hash(owner)];
  await purgeAccountDatabase(owner);
  expect(mockFiles.has('masarifi.db')).toBe(true);
  expect(mockFiles.has('masarifi.db-wal')).toBe(true);
  expect(mockSecrets.get('masarifi.database.legacyOwnerHash')).toBe(
    hash(other)
  );
});
