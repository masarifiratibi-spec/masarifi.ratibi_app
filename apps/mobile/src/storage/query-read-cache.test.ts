import { readFileSync } from 'node:fs';
import { createQueryReadCache } from './query-read-cache';
import { QueryClient } from '@tanstack/react-query';
import { bindLocalReadCache } from '@/services/local-read-cache';
import type { ReadCacheScope } from '@/services/local-read-cache';

let mockOwner = 'owner-a';
let mockAfterOpen: (() => void) | undefined;
interface Sqlite {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: (string | number)[]): unknown[];
    run(...values: (string | number)[]): unknown;
    get(): unknown;
  };
  close(): void;
}
// Node 24 supplies this built-in; the app intentionally retains its existing Node 18 type package.
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (location: string) => Sqlite;
}>('node:sqlite');
const mockDatabases = new Map<string, Sqlite>();
jest.mock('./database', () => ({
  openDatabase: async (owner: string) => {
    if (owner !== mockOwner) throw Error('stale database owner');
    const db = mockDatabases.get(owner)!;
    mockAfterOpen?.();
    return {
      raw: db,
      getAllAsync: async (sql: string, ...args: never[]) =>
        db.prepare(sql).all(...args),
      getFirstAsync: async (sql: string) => db.prepare(sql).get() ?? null,
      runAsync: async (sql: string, ...args: never[]) =>
        db.prepare(sql).run(...args)
    };
  },
  runExclusiveDatabaseTransaction: async (
    database: { raw: Sqlite },
    work: (transaction: unknown) => Promise<void>
  ) => {
    database.raw.exec('BEGIN');
    try {
      await work({
        runAsync: async (sql: string, ...args: never[]) =>
          database.raw.prepare(sql).run(...args)
      });
      database.raw.exec('COMMIT');
    } catch (error) {
      database.raw.exec('ROLLBACK');
      throw error;
    }
  }
}));

beforeEach(() => {
  mockOwner = 'owner-a';
  mockAfterOpen = undefined;
  const ddl = readFileSync('src/storage/database.ts', 'utf8').match(
    /-- migration:16([\s\S]*?)-- migration:10/
  )![1];
  const db = new DatabaseSync(':memory:');
  db.exec(ddl);
  db.exec(
    'CREATE TABLE settings_profile (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'
  );
  mockDatabases.set(mockOwner, db);
});

const savedProfile = {
  name: 'Saved owner',
  avatar: 'default',
  phone: null,
  email: null,
  googleAccount: null,
  country: 'AE',
  currency: 'AED',
  timeZone: 'Asia/Dubai',
  completion: [],
  version: 2
};
it('does not resurrect a denied profile from canonical local storage after eviction or restart, and permits a later authoritative success', async () => {
  const scope = { ownerId: mockOwner, locale: 'ar' };
  mockDatabases
    .get(mockOwner)!
    .prepare('INSERT INTO settings_profile VALUES (?, ?, ?)')
    .run('singleton', JSON.stringify(savedProfile), 200);
  const store = createQueryReadCache(() => scope);
  await store.save(scope, {
    key: ['settings', 'profile'],
    data: savedProfile,
    updatedAt: 200
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  const stop = bindLocalReadCache(client, store);
  try {
    await flush();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(100);
    try {
      await expect(
        client.fetchQuery({
          queryKey: ['settings', 'profile'],
          queryFn: async () => {
            throw Object.assign(Error('denied'), {
              code: 'permission_required'
            });
          }
        })
      ).rejects.toThrow('denied');
      await flush();
    } finally {
      clock.mockRestore();
    }
    for (let index = 300; index < 370; index++)
      await store.save(scope, {
        key: ['planning', 'goal', index],
        data: [],
        updatedAt: index
      });
    const reopened = createQueryReadCache(() => scope);
    expect(
      (await reopened.load(scope)).find((read) => read.key[0] === 'settings')
        ?.data
    ).toBeNull();
    const fresh = {
      ...savedProfile,
      name: 'Fresh authorized profile',
      version: 3
    };
    await client.fetchQuery({
      queryKey: ['settings', 'profile'],
      queryFn: async () => fresh
    });
    await flush();
    expect(
      (await reopened.load(scope)).find((read) => read.key[0] === 'settings')
        ?.data
    ).toEqual(fresh);
  } finally {
    stop();
    client.clear();
  }
});
it('uses the existing owner SQLite profile on a cold open even when bootstrap never wrote a Query projection', async () => {
  const scope = { ownerId: mockOwner, locale: 'ar' };
  mockDatabases
    .get(mockOwner)!
    .prepare('INSERT INTO settings_profile VALUES (?, ?, ?)')
    .run('singleton', JSON.stringify(savedProfile), 200);
  const store = createQueryReadCache(() => scope);
  expect(await store.load(scope)).toEqual([
    { key: ['settings', 'profile'], data: savedProfile, updatedAt: 200 }
  ]);
});

it('prefers a newer valid local profile over an older cached display without inventing a fresh timestamp', async () => {
  const scope = { ownerId: mockOwner, locale: 'en' };
  const store = createQueryReadCache(() => scope);
  await store.save(scope, {
    key: ['settings', 'profile'],
    data: { ...savedProfile, name: 'Old name', version: 1 },
    updatedAt: 100
  });
  mockDatabases
    .get(mockOwner)!
    .prepare('INSERT INTO settings_profile VALUES (?, ?, ?)')
    .run('singleton', JSON.stringify(savedProfile), 200);
  expect(await store.load(scope)).toEqual([
    { key: ['settings', 'profile'], data: savedProfile, updatedAt: 200 }
  ]);
});
afterEach(() => {
  for (const db of mockDatabases.values()) db.close();
  mockDatabases.clear();
});

it('round-trips exact currency, period and account filters with original timestamps, isolating languages and rejecting older writes', async () => {
  let scope = { ownerId: mockOwner, locale: 'ar' };
  const store = createQueryReadCache(() => scope);
  const key = [
    'core-finance',
    'transactions',
    { currency: 'USD', accountIds: ['account-a'], period: '2026-10' }
  ];
  const data = {
    items: [
      { amountMinor: 12345, syncStatus: 'pending', status: 'pending_sync' }
    ]
  };
  await store.save(scope, { key, data, updatedAt: 200 });
  await store.save(scope, { key, data: { items: [] }, updatedAt: 100 });
  expect(await store.load(scope)).toEqual([{ key, data, updatedAt: 200 }]);
  scope = { ...scope, locale: 'en' };
  expect(await store.load(scope)).toEqual([]);
});

it('rejects a changed owner after database acquisition before writing', async () => {
  let scope: ReadCacheScope = { ownerId: mockOwner, locale: 'ar' };
  const old = scope;
  const store = createQueryReadCache(() => scope);
  mockAfterOpen = () => {
    scope = { ownerId: 'owner-b', locale: 'ar' };
  };
  await expect(
    store.save(old, { key: ['planning', 'goals'], data: [], updatedAt: 100 })
  ).rejects.toThrow('stale read-cache owner');
  expect(
    mockDatabases
      .get(mockOwner)!
      .prepare('SELECT count(*) count FROM query_read_cache')
      .get()
  ).toEqual({ count: 0 });
});

it('skips corrupt, forbidden and excessive read models without affecting canonical financial tables', async () => {
  const scope = { ownerId: mockOwner, locale: 'ar' };
  const store = createQueryReadCache(() => scope);
  await store.save(scope, {
    key: ['settings', 'sessions'],
    data: 'private',
    updatedAt: 1
  });
  await store.save(scope, {
    key: ['planning', 'goals'],
    data: 'x'.repeat(600000),
    updatedAt: 1
  });
  mockDatabases
    .get(mockOwner)!
    .prepare('INSERT INTO query_read_cache VALUES (?, ?, ?, ?, ?)')
    .run('["planning","goals"]', 'ar', 1, '{broken', 1);
  expect(await store.load(scope)).toEqual([]);
});

it('bounds stored display models to 64 entries using actual SQLite eviction', async () => {
  const scope = { ownerId: mockOwner, locale: 'en' };
  const store = createQueryReadCache(() => scope);
  for (let index = 1; index <= 70; index++)
    await store.save(scope, {
      key: ['planning', 'goal', index],
      data: { index },
      updatedAt: index
    });
  const rows = await store.load(scope);
  expect(rows).toHaveLength(64);
  expect(rows.at(0)?.updatedAt).toBe(70);
  expect(rows.at(-1)?.updatedAt).toBe(7);
});

it('removes only the invalidated read model and leaves other periods intact', async () => {
  const scope = { ownerId: mockOwner, locale: 'en' };
  const store = createQueryReadCache(() => scope);
  const removed = ['planning', 'budget', '2026-10'],
    retained = ['planning', 'budget', '2026-09'];
  await store.save(scope, {
    key: removed,
    data: { amountMinor: 2 },
    updatedAt: 100
  });
  await store.save(scope, {
    key: retained,
    data: { amountMinor: 1 },
    updatedAt: 100
  });
  await store.remove(scope, removed);
  expect(await store.load(scope)).toEqual([
    { key: retained, data: { amountMinor: 1 }, updatedAt: 100 }
  ]);
});

it('restores planning display models across language changes only from the current owner database', async () => {
  let scope: ReadCacheScope = { ownerId: mockOwner, locale: 'ar' };
  const store = createQueryReadCache(() => scope);
  const key = ['planning', 'salary', '2026-10-29', 'Asia/Riyadh'];
  await store.save(scope, {
    key,
    data: { profileId: 'saved-profile' },
    updatedAt: 100
  });
  await store.save(scope, {
    key: ['settings', 'profile'],
    data: { name: 'private-profile' },
    updatedAt: 100
  });
  scope = { ...scope, locale: 'en' };
  expect(await store.loadPlanning(scope)).toEqual([
    { key, data: { profileId: 'saved-profile' }, updatedAt: 100 }
  ]);
  mockAfterOpen = () => {
    scope = { ownerId: 'owner-b', locale: 'en' };
  };
  await expect(
    store.loadPlanning({ ownerId: mockOwner, locale: 'en' })
  ).rejects.toThrow('stale read-cache owner');
});

it('retains a salary denial across locales and old day keys until a fresh successful live read', async () => {
  let scope: ReadCacheScope = { ownerId: mockOwner, locale: 'ar' };
  const store = createQueryReadCache(() => scope);
  await store.save(scope, {
    key: ['planning', 'snapshot', mockOwner, '2026-10-29', 'Asia/Riyadh'],
    data: { salary: {} },
    updatedAt: 100
  });
  await store.deny(scope, ['planning', 'salary', '2026-10-30', 'Asia/Riyadh']);
  scope = { ...scope, locale: 'en' };
  const blocked = await store.loadPlanning(scope);
  expect(blocked.some((read) => read.key[2] === 'denied')).toBe(true);
  await store.save(scope, {
    key: ['planning', 'salary', '2026-10-30', 'Asia/Riyadh'],
    data: { dataState: 'offline' },
    updatedAt: Date.now()
  });
  expect(
    (await store.loadPlanning(scope)).some((read) => read.key[2] === 'denied')
  ).toBe(true);
  await store.save(scope, {
    key: ['planning', 'salary', '2026-10-30', 'Asia/Riyadh'],
    data: { dataState: 'ready' },
    updatedAt: Date.now() + 1
  });
  expect(
    (await store.loadPlanning(scope)).some((read) => read.key[2] === 'denied')
  ).toBe(false);
});
