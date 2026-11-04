import { createHash, randomBytes, randomUUID } from 'node:crypto';

interface FixtureDatabase {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    get(): Record<string, unknown> | undefined;
    all(): Record<string, unknown>[];
  };
}
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => FixtureDatabase;
}>('node:sqlite');

export const deletionNative = {
  secrets: new Map<string, string>(),
  files: new Set<string>(),
  databases: new Map<string, FixtureDatabase>(),
  failFileDeletion: false,
  failSecretDeletion: false,
  secureStore: {
    getItemAsync: jest.fn(
      async (key: string): Promise<string | null> =>
        deletionNative.secrets.get(key) ?? null
    ),
    setItemAsync: jest.fn(async (key: string, secret: string) => {
      deletionNative.secrets.set(key, secret);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      if (deletionNative.failSecretDeletion)
        throw new Error('secure deletion failed');
      deletionNative.secrets.delete(key);
    })
  },
  crypto: {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, text: string) =>
      createHash('sha256').update(text).digest('hex'),
    getRandomBytesAsync: async (length: number) =>
      new Uint8Array(randomBytes(length)),
    randomUUID
  },
  sqlite: {
    defaultDatabaseDirectory: 'file:///databases',
    openDatabaseAsync: jest.fn(
      async (name: string, options?: { useNewConnection?: boolean }) => {
        const filename = `file:///databases/${name}`;
        const db = deletionNative.databases.get(filename);
        if (
          !options?.useNewConnection ||
          !db ||
          !deletionNative.files.has(filename)
        )
          throw new Error(
            'Deletion recovery must only inspect an existing database'
          );
        let closed = false;
        const check = () => {
          if (closed) throw new Error('closed inspection');
        };
        return {
          execAsync: async (sql: string) => {
            check();
            db.exec(sql);
          },
          getFirstAsync: async (sql: string) => {
            check();
            return sql === 'PRAGMA cipher_version'
              ? { cipher_version: '4.6.1' }
              : (db.prepare(sql).get() ?? null);
          },
          getAllAsync: async (sql: string) => {
            check();
            return db.prepare(sql).all();
          },
          closeAsync: async () => {
            closed = true;
          }
        };
      }
    )
  },
  fileSystem: {
    File: class {
      readonly uri: string;
      constructor(directory: string, name: string) {
        this.uri = `${directory}/${name}`;
      }
      get exists(): boolean {
        return deletionNative.files.has(this.uri);
      }
      delete() {
        if (deletionNative.failFileDeletion)
          throw new Error('file deletion failed');
        deletionNative.files.delete(this.uri);
      }
    }
  }
};

export function seedDeletedOwner(ownerId: string): string {
  const ownerHash = createHash('sha256').update(ownerId).digest('hex');
  const filename = `file:///databases/masarifi-${ownerHash.slice(0, 24)}.db`;
  for (const suffix of ['', '-wal', '-shm'])
    deletionNative.files.add(`${filename}${suffix}`);
  deletionNative.secrets.set(
    `masarifi.database.key.${ownerHash}`,
    'b'.repeat(64)
  );
  const database = new DatabaseSync(':memory:');
  database.exec(`
    create table schema_migrations(version integer primary key);
    insert into schema_migrations values(17);
    create table sms_import_queue(id text primary key,payload text not null);
    create table sms_import_queue_v3(id text primary key,payload text not null);
  `);
  deletionNative.databases.get(filename)?.close();
  deletionNative.databases.set(filename, database);
  return filename;
}

export function resetDeletionNative(): void {
  for (const db of deletionNative.databases.values()) db.close();
  deletionNative.databases.clear();
  deletionNative.secrets.clear();
  deletionNative.files.clear();
  deletionNative.failFileDeletion = false;
  deletionNative.failSecretDeletion = false;
}
