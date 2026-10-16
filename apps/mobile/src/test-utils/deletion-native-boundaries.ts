import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const deletionNative = {
  secrets: new Map<string, string>(),
  files: new Set<string>(),
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
    openDatabaseAsync: jest.fn(async () => {
      throw new Error('Deletion recovery must never open a database');
    })
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
  return filename;
}

export function resetDeletionNative(): void {
  deletionNative.secrets.clear();
  deletionNative.files.clear();
  deletionNative.failFileDeletion = false;
  deletionNative.failSecretDeletion = false;
}
