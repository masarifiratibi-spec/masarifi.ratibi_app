import { openDatabase, runExclusiveDatabaseTransaction } from './database';
import { userProfileSchema } from '@/domain/settings';
import {
  readBelongsToScope,
  type ReadCacheScope,
  type StoredRead
} from '@/services/local-read-cache';

const VERSION = 1;
const MAX_BYTES = 512 * 1024;
// A known profile denial must survive LRU eviction while its canonical local
// copy still exists. This is an unavailable display marker, not financial data.
const PROFILE_DENIAL_PRIORITY = `CASE WHEN query_key = '["settings","profile"]' AND payload = 'null' THEN 1 ELSE 0 END`;
interface Row {
  query_key: string;
  payload: string;
  updated_at: number;
}

/** Uses the existing owner-specific SQLCipher database and lifecycle fence. */
export function createQueryReadCache(current: () => ReadCacheScope | null) {
  const assertCurrent = (scope: ReadCacheScope) => {
    const active = current();
    if (active?.ownerId !== scope.ownerId || active.locale !== scope.locale)
      throw Error('stale read-cache owner');
  };
  return {
    current,
    async load(scope: ReadCacheScope): Promise<StoredRead[]> {
      assertCurrent(scope);
      const database = await openDatabase(scope.ownerId);
      assertCurrent(scope);
      const rows = await database.getAllAsync<Row>(
        `SELECT query_key, payload, updated_at FROM query_read_cache WHERE schema_version = ? AND locale = ? ORDER BY ${PROFILE_DENIAL_PRIORITY} DESC, updated_at DESC LIMIT 64`,
        VERSION,
        scope.locale
      );
      assertCurrent(scope);
      const reads = rows.flatMap((row) => {
        try {
          if (row.payload.length * 2 > MAX_BYTES || row.query_key.length > 8192)
            return [];
          const key: unknown = JSON.parse(row.query_key);
          if (!Array.isArray(key) || !readBelongsToScope(key, scope)) return [];
          return [
            { key, data: JSON.parse(row.payload), updatedAt: row.updated_at }
          ];
        } catch {
          return [];
        }
      });
      const profileKey = ['settings', 'profile'];
      const projection = reads.find(
        (read) => JSON.stringify(read.key) === JSON.stringify(profileKey)
      );
      if (projection?.data === null) return reads;
      // Bootstrap already writes this owner-specific profile. A manual Query
      // seed is deliberately not a cache write; reuse the existing valid row.
      const local = await database.getFirstAsync<{
        payload: string;
        updated_at: number;
      }>(
        "SELECT payload, updated_at FROM settings_profile WHERE id = 'singleton'"
      );
      assertCurrent(scope);
      if (
        !local ||
        local.payload.length * 2 > MAX_BYTES ||
        !Number.isFinite(local.updated_at) ||
        local.updated_at <= 0 ||
        local.updated_at > Date.now()
      )
        return reads;
      try {
        const parsed = userProfileSchema.safeParse(JSON.parse(local.payload));
        const previous = userProfileSchema.safeParse(projection?.data);
        if (
          parsed.success &&
          (!projection ||
            !previous.success ||
            parsed.data.version > previous.data.version ||
            (parsed.data.version === previous.data.version &&
              local.updated_at > projection.updatedAt))
        )
          return [
            { key: profileKey, data: parsed.data, updatedAt: local.updated_at },
            ...reads.filter((read) => read !== projection)
          ].slice(0, 64);
      } catch {
        /* A corrupt profile cannot replace a valid read projection. */
      }
      return reads;
    },
    async save(scope: ReadCacheScope, read: StoredRead): Promise<void> {
      assertCurrent(scope);
      if (
        !readBelongsToScope(read.key, scope) ||
        !Number.isFinite(read.updatedAt) ||
        read.updatedAt <= 0
      )
        return;
      const key = JSON.stringify(read.key),
        payload = JSON.stringify(read.data);
      if (!payload || payload.length * 2 > MAX_BYTES || key.length > 8192)
        return;
      const database = await openDatabase(scope.ownerId);
      assertCurrent(scope);
      await runExclusiveDatabaseTransaction(database, async (transaction) => {
        assertCurrent(scope);
        await transaction.runAsync(
          `INSERT INTO query_read_cache (query_key, locale, schema_version, payload, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(query_key, locale) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, updated_at = excluded.updated_at WHERE (excluded.query_key = '["settings","profile"]' AND (excluded.payload = 'null' OR query_read_cache.payload = 'null')) OR excluded.updated_at >= query_read_cache.updated_at`,
          key,
          scope.locale,
          VERSION,
          payload,
          read.updatedAt
        );
        assertCurrent(scope);
        await transaction.runAsync(
          `DELETE FROM query_read_cache WHERE rowid NOT IN (SELECT rowid FROM query_read_cache ORDER BY ${PROFILE_DENIAL_PRIORITY} DESC, updated_at DESC, rowid DESC LIMIT 64)`
        );
      });
    },
    async deny(scope: ReadCacheScope, key: readonly unknown[]): Promise<void> {
      if (key.length === 2 && key[0] === 'settings' && key[1] === 'profile')
        await this.save(scope, { key, data: null, updatedAt: Date.now() });
      else await this.remove(scope, key);
    },
    async remove(
      scope: ReadCacheScope,
      key: readonly unknown[]
    ): Promise<void> {
      assertCurrent(scope);
      if (!readBelongsToScope(key, scope)) return;
      const database = await openDatabase(scope.ownerId);
      assertCurrent(scope);
      await runExclusiveDatabaseTransaction(database, async (transaction) => {
        assertCurrent(scope);
        await transaction.runAsync(
          'DELETE FROM query_read_cache WHERE query_key = ? AND locale = ?',
          JSON.stringify(key),
          scope.locale
        );
      });
    }
  };
}
