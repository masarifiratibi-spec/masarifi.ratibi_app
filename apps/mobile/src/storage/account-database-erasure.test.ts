import {
  clearDatabaseOwner,
  configureDatabaseOwner,
  openDatabase,
  purgeAccountDatabase,
  resetDatabaseForTests,
  runExclusiveDatabaseTransaction
} from './database';
import { readTransactionDraftSnapshot } from './transaction-draft-snapshots';

const OWNER_A = 'user_owner-a';
const OWNER_B = 'user_owner-b';
const HASH_A =
  '302cbf455146ca0d27d11370adbb69352f1be116e6f2982a3f4d69e23026c2e7';
const HASH_B =
  'deb1c31d6c49dc5a32cbc77853ddc77abbb73f40bad389cdd8fb754345e88d78';
const NAME_A = 'masarifi-302cbf455146ca0d27d11370.db';
const NAME_B = 'masarifi-deb1c31d6c49dc5a32cbc778.db';
const KEY_A = `masarifi.database.key.${HASH_A}`;
const KEY_B = `masarifi.database.key.${HASH_B}`;
const priorClientMode = process.env.EXPO_PUBLIC_CLIENT_MODE;
const mockFiles = new Set<string>();
const mockSecrets = new Map<string, string>();
const mockConnections = new Map<string, { closed: boolean }>();
const mockFileFailures = new Set<string>();
let mockCloseFailure = false;
let mockSecretFailure = false;
let mockSilentDelete = false;
let mockSilentSecretDelete = false;

it.each([
  ['configure', () => configureDatabaseOwner(OWNER_A)],
  ['clear', () => clearDatabaseOwner()],
  ['purge', () => purgeAccountDatabase(OWNER_A)]
] as const)('invalidates draft snapshots on database owner %s', async (_name, lifecycle) => {
  await configureDatabaseOwner(OWNER_A);
  const owner = { userId: OWNER_A, assertCurrent: async () => undefined };
  const read = jest.fn(async () => null);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  const pending = lifecycle();
  // Lifecycle work has not finished its queued async operation yet.
  await readTransactionDraftSnapshot(owner, 'manual', read);
  await pending;
  await readTransactionDraftSnapshot(owner, 'manual', read);
  expect(read).toHaveBeenCalledTimes(3);
});
const mockDirectory = '/data/user/0/com.masarifi.mobile/files/SQLite';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, ownerId: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(ownerId)
      .digest('hex'),
  getRandomBytesAsync: async () => new Uint8Array(32).fill(7)
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecrets.get(key) ?? null,
  setItemAsync: async (key: string, secret: string) => {
    mockSecrets.set(key, secret);
  },
  deleteItemAsync: async (key: string) => {
    if (mockSecretFailure) throw new Error('key deletion failed');
    if (!mockSilentSecretDelete) mockSecrets.delete(key);
  }
}));
jest.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;
    constructor(directory: string, name: string) {
      if (!directory.startsWith('file://')) throw new Error('invalid URI');
      this.uri = `${directory}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      if (mockFileFailures.has(this.uri))
        throw new Error('file deletion failed');
      if (!mockSilentDelete) mockFiles.delete(this.uri);
    }
  }
}));
jest.mock('expo-sqlite', () => ({
  get defaultDatabaseDirectory() {
    return mockDirectory;
  },
  openDatabaseAsync: async (name: string) => {
    const connection = { closed: false };
    let cachedByNative = true;
    mockConnections.set(name, connection);
    mockFiles.add(`file://${mockDirectory}/${name}`);
    const database = {
      execAsync: async () => {
        if (connection.closed) throw new Error('closed database');
      },
      getFirstAsync: async (sql: string) =>
        sql.includes('cipher_version') ? { cipher_version: '4.6.1' } : null,
      getAllAsync: async () => [],
      runAsync: async () => {
        if (connection.closed) throw new Error('closed database');
      },
      withExclusiveTransactionAsync: async (
        operation: (transaction: unknown) => Promise<void>
      ) => operation(database),
      closeAsync: async () => {
        // Match Expo's cache eviction before sqlite3_close on Android/iOS.
        if (!cachedByNative) return;
        cachedByNative = false;
        if (mockCloseFailure) throw new Error('database close failed');
        connection.closed = true;
      }
    };
    return database;
  }
}));

function seedOwnerFiles(name: string): void {
  for (const suffix of ['', '-wal', '-shm'])
    mockFiles.add(`file://${mockDirectory}/${name}${suffix}`);
}

function remainingFilenames(): string[] {
  return [...mockFiles].map((uri) => uri.split('/').at(-1)!).sort();
}

beforeEach(async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  mockCloseFailure = false;
  mockSecretFailure = false;
  mockSilentDelete = false;
  mockSilentSecretDelete = false;
  resetDatabaseForTests();
  await clearDatabaseOwner();
  mockFiles.clear();
  mockSecrets.clear();
  mockConnections.clear();
  mockFileFailures.clear();
  seedOwnerFiles(NAME_A);
  seedOwnerFiles(NAME_B);
  seedOwnerFiles('masarifi.db');
  mockFiles.add(`file://${mockDirectory}/${NAME_A}.unrelated`);
  mockSecrets.set(KEY_A, 'a'.repeat(64));
  mockSecrets.set(KEY_B, 'b'.repeat(64));
});

afterEach(() => {
  if (priorClientMode === undefined) delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  else process.env.EXPO_PUBLIC_CLIENT_MODE = priorClientMode;
});

test('removes the deleted owner database, sidecars and key while preserving other owners and shared storage', async () => {
  await configureDatabaseOwner(OWNER_A);
  await openDatabase(OWNER_A);

  await purgeAccountDatabase(OWNER_A);

  expect(mockConnections.get(NAME_A)?.closed).toBe(true);
  expect(remainingFilenames()).toEqual(
    [
      `${NAME_A}.unrelated`,
      NAME_B,
      `${NAME_B}-shm`,
      `${NAME_B}-wal`,
      'masarifi.db',
      'masarifi.db-shm',
      'masarifi.db-wal'
    ].sort()
  );
  expect(mockSecrets.has(KEY_A)).toBe(false);
  expect(mockSecrets.get(KEY_B)).toBe('b'.repeat(64));
  await expect(openDatabase(OWNER_A)).rejects.toThrow('stale database owner');
});

test('purges a switched-away owner without closing or replacing the active owner', async () => {
  await configureDatabaseOwner(OWNER_A);
  await openDatabase(OWNER_A);
  const switching = configureDatabaseOwner(OWNER_B);
  const opening = openDatabase(OWNER_B);
  const purging = purgeAccountDatabase(OWNER_A);
  await switching;
  const current = await opening;
  await purging;

  expect(mockConnections.get(NAME_B)?.closed).toBe(false);
  expect(await openDatabase(OWNER_B)).toBe(current);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(false);
  expect(mockSecrets.has(KEY_A)).toBe(false);
  expect(mockSecrets.get(KEY_B)).toBe('b'.repeat(64));
});

test('purges after sign-out without opening or recreating the deleted database', async () => {
  await configureDatabaseOwner(OWNER_A);
  await openDatabase(OWNER_A);
  await clearDatabaseOwner(OWNER_A);
  mockConnections.clear();

  await purgeAccountDatabase(OWNER_A);
  await purgeAccountDatabase(OWNER_A);

  expect(mockConnections.size).toBe(0);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(false);
  expect(mockSecrets.has(KEY_A)).toBe(false);
  expect(mockSecrets.get(KEY_B)).toBe('b'.repeat(64));
});

test('closes a pending open before purge and allows the next owner to open afterward', async () => {
  await configureDatabaseOwner(OWNER_A);
  const opening = openDatabase(OWNER_A);
  const purging = purgeAccountDatabase(OWNER_A);
  const switching = configureDatabaseOwner(OWNER_B);
  const nextOwner = openDatabase(OWNER_B);
  await Promise.all([opening, purging, switching, nextOwner]);

  expect(mockConnections.get(NAME_A)?.closed).toBe(true);
  expect(mockConnections.get(NAME_B)?.closed).toBe(false);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(false);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_B}`)).toBe(true);
  expect(mockSecrets.has(KEY_A)).toBe(false);
});

test('waits for an in-flight transaction before deleting its files and rejects queued stale access', async () => {
  await configureDatabaseOwner(OWNER_A);
  const database = await openDatabase(OWNER_A);
  let releaseTransaction!: () => void;
  let transactionStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    transactionStarted = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  const transaction = runExclusiveDatabaseTransaction(database, async () => {
    transactionStarted();
    await release;
    expect(mockConnections.get(NAME_A)?.closed).toBe(false);
    expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(true);
  });
  await started;
  try {
    const purging = purgeAccountDatabase(OWNER_A);
    const staleOpen = expect(openDatabase(OWNER_A)).rejects.toThrow(
      'stale database owner'
    );
    const staleTransaction = expect(
      runExclusiveDatabaseTransaction(database, async () => {
        throw new Error('stale operation was allowed');
      })
    ).rejects.toThrow('stale database owner');
    releaseTransaction();
    await Promise.all([transaction, purging, staleOpen, staleTransaction]);
  } finally {
    releaseTransaction();
    await transaction;
  }
  expect(mockConnections.get(NAME_A)?.closed).toBe(true);
  expect(mockSecrets.has(KEY_A)).toBe(false);
});

test('blocks deletion after a failed native close even if a repeated close would resolve without closing', async () => {
  await configureDatabaseOwner(OWNER_A);
  await openDatabase(OWNER_A);
  mockCloseFailure = true;

  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'database close failed'
  );
  expect(mockConnections.get(NAME_A)?.closed).toBe(false);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(true);
  expect(mockSecrets.has(KEY_A)).toBe(true);

  mockCloseFailure = false;
  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'database close failed'
  );
  await expect(openDatabase(OWNER_A)).rejects.toThrow('database close failed');
  await expect(configureDatabaseOwner(OWNER_B)).rejects.toThrow(
    'database close failed'
  );
  expect(mockConnections.get(NAME_A)?.closed).toBe(false);
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(true);
  expect(mockSecrets.has(KEY_A)).toBe(true);
});

test('retries interrupted sidecar removal and never reports success while a file remains', async () => {
  const wal = `file://${mockDirectory}/${NAME_A}-wal`;
  mockFileFailures.add(wal);
  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'file deletion failed'
  );
  expect(mockFiles.has(wal)).toBe(true);
  mockFileFailures.clear();
  await purgeAccountDatabase(OWNER_A);
  expect(mockFiles.has(wal)).toBe(false);
  expect(mockSecrets.has(KEY_A)).toBe(false);
});

test('rejects a silent filesystem no-op instead of claiming complete erasure', async () => {
  mockSilentDelete = true;
  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'database files remain'
  );
  expect(mockSecrets.has(KEY_A)).toBe(true);
});

test('propagates key removal failure and supports retry after database files are already absent', async () => {
  mockSecretFailure = true;
  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'key deletion failed'
  );
  expect(mockFiles.has(`file://${mockDirectory}/${NAME_A}`)).toBe(false);
  expect(mockSecrets.has(KEY_A)).toBe(true);
  mockSecretFailure = false;
  await purgeAccountDatabase(OWNER_A);
  await purgeAccountDatabase(OWNER_A);
  expect(mockSecrets.has(KEY_A)).toBe(false);
});

test('rejects a retained encryption key even when the SecureStore deletion promise resolves', async () => {
  mockSilentSecretDelete = true;
  await expect(purgeAccountDatabase(OWNER_A)).rejects.toThrow(
    'database key remains'
  );
  expect(mockSecrets.has(KEY_A)).toBe(true);
});
