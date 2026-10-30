import { QueryClient } from '@tanstack/react-query';
import {
  bindLocalReadCache,
  isOfflineReadableKey,
  type ReadCacheScope,
  type StoredRead
} from './local-read-cache';

const key = ['planning', 'salary', '2026-10-29', 'Asia/Riyadh'];
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('hydrates device-history display data only for the explicitly authorized owner', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const own = ['settings', 'sessions', { ownerId: 'a' }];
  const foreign = ['settings', 'sessions', { ownerId: 'b' }];
  const unscoped = ['settings', 'sessions'];
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'ar' }),
    load: async () =>
      [own, foreign, unscoped].map((key) => ({
        key,
        data: [{ deviceLabel: 'Saved device' }],
        updatedAt: 100
      })),
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(own)).toEqual([{ deviceLabel: 'Saved device' }]);
  expect(client.getQueryData(foreign)).toBeUndefined();
  expect(client.getQueryData(unscoped)).toBeUndefined();
  expect(
    isOfflineReadableKey(['settings', 'revoke-session', { ownerId: 'a' }])
  ).toBe(false);
  stop();
  client.clear();
});

it('restores only owned tracking display reads, excluding operational configuration and commands', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const own = ['automatic-tracking', 'history', {}, { ownerId: 'a' }];
  const foreign = ['automatic-tracking', 'status', { ownerId: 'b' }];
  const unscoped = ['automatic-tracking', 'keywords', {}];
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'ar' }),
    load: async () =>
      [own, foreign, unscoped].map((key) => ({
        key,
        data: { saved: true },
        updatedAt: 100
      })),
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(own)).toEqual({ saved: true });
  expect(client.getQueryData(foreign)).toBeUndefined();
  expect(client.getQueryData(unscoped)).toBeUndefined();
  for (const kind of [
    'native-configuration',
    'permissions',
    'resolve',
    'capture',
    'mutation'
  ])
    expect(
      isOfflineReadableKey(['automatic-tracking', kind, { ownerId: 'a' }])
    ).toBe(false);
  stop();
  client.clear();
});

it('restores owned Assistant display history without making consent or action previews offline authority', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const own = ['assistant', 'conversation', 'saved-chat', { ownerId: 'a' }];
  const foreign = ['assistant', 'response', 'saved-response', { ownerId: 'b' }];
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'en' }),
    load: async () => [
      { key: own, data: { responses: { items: [] } }, updatedAt: 100 },
      { key: foreign, data: { private: 'B' }, updatedAt: 100 }
    ],
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(own)).toEqual({ responses: { items: [] } });
  expect(client.getQueryData(foreign)).toBeUndefined();
  for (const resource of [
    'consent',
    'availability',
    'actionPreview',
    'questionOperation'
  ])
    expect(isOfflineReadableKey(['assistant', resource])).toBe(false);
  stop();
  client.clear();
});

it('restores only explicitly owned notification history/counts and never action authority', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const own = ['notifications', 'list', { category: 'salary' }, 'owner-a'];
  const foreign = ['notifications', 'detail', 'notification-b', 'owner-b'];
  const unscoped = ['notifications', 'unread'];
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'owner-a', locale: 'ar' }),
    load: async () => [
      { key: own, data: { pages: [], pageParams: [] }, updatedAt: 100 },
      { key: foreign, data: { private: 'B' }, updatedAt: 100 },
      { key: unscoped, data: 7, updatedAt: 100 }
    ],
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(own)).toEqual({ pages: [], pageParams: [] });
  expect(client.getQueryData(foreign)).toBeUndefined();
  expect(client.getQueryData(unscoped)).toBeUndefined();
  expect(isOfflineReadableKey(['notifications', 'action'])).toBe(false);
  stop();
  client.clear();
});

it('renders a stored salary immediately while the authoritative read is unresolved, keeping its original timestamp', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const scope = { ownerId: 'owner-a', locale: 'ar' };
  const save = jest.fn(async () => undefined);
  const stop = bindLocalReadCache(client, {
    current: () => scope,
    load: async () => [{ key, data: { receivedMinor: 7000 }, updatedAt: 100 }],
    save
  });
  await tick();
  let release!: (value: unknown) => void;
  const request = client.fetchQuery({
    queryKey: key,
    queryFn: () =>
      new Promise((resolve) => {
        release = resolve;
      })
  });
  await tick();
  expect(client.getQueryData(key)).toEqual({ receivedMinor: 7000 });
  expect(client.getQueryState(key)?.dataUpdatedAt).toBe(100);
  release({ receivedMinor: 8000 });
  await request;
  await tick();
  expect(client.getQueryData(key)).toEqual({ receivedMinor: 8000 });
  expect(save).toHaveBeenCalledWith(
    scope,
    expect.objectContaining({ data: { receivedMinor: 8000 } })
  );
  stop();
  client.clear();
});

it('retains the last valid result and timestamp when a background read fails', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'en' }),
    load: async () => [{ key, data: [], updatedAt: 200 }],
    save: jest.fn()
  });
  await tick();
  await expect(
    client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        throw Error('offline');
      }
    })
  ).rejects.toThrow('offline');
  expect(client.getQueryData(key)).toEqual([]);
  expect(client.getQueryState(key)?.dataUpdatedAt).toBe(200);
  stop();
  client.clear();
});

it('discards a delayed old-owner hydration and never persists data under a replacement owner', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  let scope: ReadCacheScope | null = { ownerId: 'old', locale: 'ar' };
  let finish!: (rows: StoredRead[]) => void;
  const save = jest.fn();
  const stop = bindLocalReadCache(client, {
    current: () => scope,
    load: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    save
  });
  scope = { ownerId: 'new', locale: 'ar' };
  finish([{ key, data: { private: 'old-owner' }, updatedAt: 1 }]);
  await tick();
  expect(client.getQueryData(key)).toBeUndefined();
  client.setQueryData(key, { private: 'new-owner' });
  expect(save).not.toHaveBeenCalled();
  stop();
  client.clear();
});

it('does not overwrite newer authoritative data with disk hydration', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  client.setQueryData(key, { version: 3 }, { updatedAt: 300 });
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'ar' }),
    load: async () => [{ key, data: { version: 2 }, updatedAt: 200 }],
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(key)).toEqual({ version: 3 });
  stop();
  client.clear();
});

it('restricts persistence to useful read models, excluding credentials, private output links, AI, billing and action previews', () => {
  for (const value of [
    key,
    ['core-finance', 'accounts', false],
    ['core-finance', 'categories', false],
    ['reports', 'live', 'owner', {}]
  ])
    expect(isOfflineReadableKey(value)).toBe(true);
  for (const value of [
    ['settings', 'sessions'],
    ['settings', 'privacy-request', 'export'],
    ['reports', 'attempt', 'id'],
    ['reports', 'preview', {}],
    ['assistant', 'conversation', 'id'],
    ['subscriptions'],
    ['planning', 'draft', 'id'],
    ['planning', 'payment-preview', 'id']
  ])
    expect(isOfflineReadableKey(value)).toBe(false);
});

it('does not hydrate a foreign explicit owner key or persist optimistic manual query writes', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const save = jest.fn();
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'current', locale: 'ar' }),
    load: async () => [
      {
        key: ['reports', 'live', 'foreign', {}],
        data: { total: 1 },
        updatedAt: 100
      }
    ],
    save
  });
  await tick();
  expect(
    client.getQueryData(['reports', 'live', 'foreign', {}])
  ).toBeUndefined();
  client.setQueryData(key, { total: 'optimistic' });
  await tick();
  expect(save).not.toHaveBeenCalled();
  stop();
  client.clear();
});

it('does not restore a disk snapshot after a confirmed permission denial and evicts that read model', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  let finish!: (rows: StoredRead[]) => void;
  const remove = jest.fn(async () => undefined);
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'ar' }),
    load: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    save: jest.fn(),
    remove
  });
  await expect(
    client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        throw Object.assign(Error('denied'), { code: 'forbidden' });
      }
    })
  ).rejects.toThrow('denied');
  finish([{ key, data: { private: 'old' }, updatedAt: 100 }]);
  await tick();
  expect(client.getQueryData(key)).toBeUndefined();
  expect(remove).toHaveBeenCalledWith({ ownerId: 'a', locale: 'ar' }, key);
  stop();
  client.clear();
});

it("persists only this owner's support history keys", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const own = ['support', 'ticket', 'case-a', 'a'],
    foreign = ['support', 'ticket', 'case-b', 'b'];
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'en' }),
    load: async () => [
      { key: own, data: { subject: 'Saved case A' }, updatedAt: 100 },
      { key: foreign, data: { subject: 'Private case B' }, updatedAt: 100 }
    ],
    save: jest.fn()
  });
  await tick();
  expect(client.getQueryData(own)).toEqual({ subject: 'Saved case A' });
  expect(client.getQueryData(foreign)).toBeUndefined();
  stop();
  client.clear();
});

it('removes an already visible snapshot after an authoritative deletion instead of presenting it offline later', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  const remove = jest.fn(async () => undefined);
  const stop = bindLocalReadCache(client, {
    current: () => ({ ownerId: 'a', locale: 'en' }),
    load: async () => [],
    save: jest.fn(),
    remove
  });
  await tick();
  client.setQueryData(key, { amountMinor: 100 });
  await expect(
    client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        throw Object.assign(Error('deleted'), { code: 'not_found' });
      }
    })
  ).rejects.toThrow('deleted');
  expect(client.getQueryData(key)).toBeUndefined();
  expect(client.getQueryState(key)?.status).toBe('error');
  expect(remove).toHaveBeenCalledWith({ ownerId: 'a', locale: 'en' }, key);
  stop();
  client.clear();
});
