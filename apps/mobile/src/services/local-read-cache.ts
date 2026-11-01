import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { isAuthoritativeReadDenial } from './read-snapshot';

export interface ReadCacheScope {
  ownerId: string;
  locale: string;
}
export interface StoredRead {
  key: QueryKey;
  data: unknown;
  updatedAt: number;
}
export interface ReadCacheStore {
  current(): ReadCacheScope | null;
  load(scope: ReadCacheScope): Promise<StoredRead[]>;
  save(scope: ReadCacheScope, read: StoredRead): Promise<void>;
  remove?(scope: ReadCacheScope, key: QueryKey): Promise<void>;
  deny?(scope: ReadCacheScope, key: QueryKey): Promise<void>;
}

/** Only display models. Never persist tokens, signed URLs, action previews or mutations. */
export const offlineReadPrefixes = Object.entries({
  'core-finance': [
    'home',
    'accounts',
    'account-balances',
    'account',
    'transactions',
    'transaction',
    'categories'
  ],
  planning: [
    'snapshot',
    'overview',
    'salary',
    'budget',
    'budgets',
    'budget-id',
    'obligations',
    'obligation',
    'goals',
    'goal'
  ],
  reports: ['live', 'net-worth', 'history', 'breakdown'],
  settings: ['profile', 'sessions'],
  support: ['articles', 'tickets', 'ticket'],
  notifications: ['list', 'detail', 'unread'],
  assistant: ['conversations', 'conversation', 'response'],
  'automatic-tracking': [
    'status',
    'history',
    'review',
    'duplicate',
    'duplicates',
    'keywords',
    'senders'
  ]
}).flatMap(([root, resources]) =>
  resources.map((resource) => [root, resource])
);

export function isOfflineReadableKey(key: QueryKey): boolean {
  if (
    key[0] === 'assistant' ||
    key[0] === 'automatic-tracking' ||
    (key[0] === 'settings' && key[1] === 'sessions')
  ) {
    const owner = key.at(-1);
    if (
      !owner ||
      typeof owner !== 'object' ||
      !('ownerId' in owner) ||
      typeof owner.ownerId !== 'string' ||
      !owner.ownerId
    )
      return false;
  }
  return offlineReadPrefixes.some(
    (prefix) => prefix[0] === key[0] && prefix[1] === key[1]
  );
}

export function readBelongsToScope(
  key: QueryKey,
  scope: ReadCacheScope
): boolean {
  if (key[0] === 'support') {
    const ownerIndex = key[1] === 'tickets' ? 2 : key[1] === 'ticket' ? 3 : 4;
    return isOfflineReadableKey(key) && key[ownerIndex] === scope.ownerId;
  }
  if (key[0] === 'notifications') {
    return (
      isOfflineReadableKey(key) &&
      key[key[1] === 'unread' ? 2 : 3] === scope.ownerId
    );
  }
  if (
    key[0] === 'assistant' ||
    key[0] === 'automatic-tracking' ||
    (key[0] === 'settings' && key[1] === 'sessions')
  ) {
    const owner = key.at(-1);
    return (
      isOfflineReadableKey(key) &&
      Boolean(
        owner &&
        typeof owner === 'object' &&
        'ownerId' in owner &&
        owner.ownerId === scope.ownerId
      )
    );
  }
  return (
    isOfflineReadableKey(key) &&
    !(
      ((key[0] === 'reports' && key[1] === 'live') ||
        (key[0] === 'planning' && key[1] === 'snapshot')) &&
      key[2] !== scope.ownerId
    )
  );
}

/** Hydration publishes old timestamps; Query remains the only live read/state owner. */
export function bindLocalReadCache(
  client: QueryClient,
  store: ReadCacheStore
): () => void {
  const scope = store.current();
  if (!scope) return () => {};
  let disposed = false;
  let restoring = false;
  const current = () => {
    const value = store.current();
    return (
      !disposed &&
      value?.ownerId === scope.ownerId &&
      value.locale === scope.locale
    );
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (
      restoring ||
      !current() ||
      event.type !== 'updated' ||
      client.getQueryCache().get(event.query.queryHash) !== event.query ||
      !readBelongsToScope(event.query.queryKey, scope)
    )
      return;
    const state = event.query.state;
    if (
      event.action.type === 'invalidate' ||
      (event.action.type === 'error' && isAuthoritativeReadDenial(state.error))
    ) {
      if (event.action.type === 'error')
        event.query.setState({ data: undefined, dataUpdatedAt: 0 });
      const removal =
        event.action.type === 'error' && store.deny
          ? store.deny(scope, event.query.queryKey)
          : store.remove?.(scope, event.query.queryKey);
      void removal?.catch(() => undefined);
      return;
    }
    if (event.action.type !== 'success' || event.action.manual) return;
    if (state.data === undefined || !Number.isFinite(state.dataUpdatedAt))
      return;
    void store
      .save(scope, {
        key: event.query.queryKey,
        data: state.data,
        updatedAt: state.dataUpdatedAt
      })
      .catch(() => undefined);
  });
  void store
    .load(scope)
    .then((rows) => {
      if (!current()) return;
      restoring = true;
      try {
        for (const row of rows) {
          if (
            !readBelongsToScope(row.key, scope) ||
            !Number.isFinite(row.updatedAt) ||
            row.updatedAt <= 0 ||
            row.updatedAt > Date.now() ||
            row.data === undefined
          )
            continue;
          const previous = client.getQueryState(row.key);
          if (
            previous?.isInvalidated ||
            isAuthoritativeReadDenial(previous?.error)
          )
            continue;
          if (
            previous?.data !== undefined &&
            previous.dataUpdatedAt >= row.updatedAt
          )
            continue;
          client.setQueryData(row.key, row.data, { updatedAt: row.updatedAt });
          // A persisted projection must be checked against current local/synced state on first use.
          void client.invalidateQueries({
            queryKey: row.key,
            exact: true,
            refetchType: 'none'
          });
        }
      } finally {
        restoring = false;
      }
    })
    .catch(() => undefined);
  return () => {
    disposed = true;
    unsubscribe();
  };
}
