/**
 * Offline-entry repository tests.
 *
 * The repository's logic — payload validation, sync-state machine, edit/delete
 * before sync — is the subject under test. expo-sqlite is a native boundary
 * unavailable in Jest, so we swap the database module for an in-memory store
 * that honors the same row shape. Native persistence itself is validated on
 * development builds (quickstart §3).
 */

/* eslint-disable import/first -- jest.mock must be hoisted before importing the module under test */
import type { OfflineEntry } from '@/domain/foundation';

jest.mock('./database', () => {
  // In-memory store that honors the same row semantics as the SQLite schema,
  // without parsing SQL column order. Reset per test to avoid cross-test leaks.
  let rows = new Map<string, Record<string, unknown>>();

  const api = {
    async runAsync(sql: string, ...params: unknown[]) {
      const lower = sql.trim().toLowerCase();
      if (lower.startsWith('insert')) {
        // Repository INSERT: status is a SQL literal ('pending'); params are
        // (id, amount, currency, category, note, createdAt, updatedAt).
        const [id, amount, currency, category, note, createdAt, updatedAt] =
          params as [
            string,
            number,
            string,
            string,
            string | null,
            number,
            number
          ];
        rows.set(id, {
          local_id: id,
          amount,
          currency_code: currency,
          category_key: category,
          note,
          sync_status: 'pending',
          created_at: createdAt,
          updated_at: updatedAt,
          last_error_key: null
        });
        return { changes: 1 };
      }
      if (lower.includes('sync_status')) {
        const [status, updatedAt, err, id] = params as [
          string,
          number,
          string | null,
          string
        ];
        const row = rows.get(id);
        if (!row) return { changes: 0 };
        rows.set(id, {
          ...row,
          sync_status: status,
          updated_at: updatedAt,
          last_error_key: err
        });
        return { changes: 1 };
      }
      if (lower.startsWith('update')) {
        const [amount, currency, category, note, updatedAt, id] = params as [
          number,
          string,
          string,
          string | null,
          number,
          string
        ];
        const row = rows.get(id);
        if (!row) return { changes: 0 };
        rows.set(id, {
          ...row,
          amount,
          currency_code: currency,
          category_key: category,
          note,
          updated_at: updatedAt
        });
        return { changes: 1 };
      }
      if (lower.startsWith('delete')) {
        const [id] = params as string[];
        return { changes: rows.delete(id) ? 1 : 0 };
      }
      return { changes: 0 };
    },
    async getAllAsync() {
      return Array.from(rows.values()).sort(
        (a, b) => (a.created_at as number) - (b.created_at as number)
      );
    },
    async getFirstAsync(_sql: string, id: string) {
      return rows.get(id) ?? null;
    }
  };

  return {
    openDatabase: jest.fn(async () => api),
    resetDatabaseForTests: jest.fn(() => {
      rows = new Map();
    })
  };
});

import {
  createLocalRecordsRepository,
  EntryNotFoundError
} from './local-records';
import { InvalidTransitionError, PayloadValidationError } from './errors';
import { resetDatabaseForTests } from './database';

const validPayload = {
  amount: 100,
  currencyCode: 'SAR',
  categoryKey: 'food',
  note: null
};

beforeEach(() => resetDatabaseForTests());

describe('OfflineEntry repository insert', () => {
  it('saves a valid entry locally as pending sync', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    expect(entry.syncStatus).toBe('pending');
    expect(entry.payload.amount).toBe(100);
  });

  it.each([
    ['non-finite amount', { ...validPayload, amount: Number.NaN }],
    ['non-3-letter currency', { ...validPayload, currencyCode: 'US' }],
    ['empty category', { ...validPayload, categoryKey: '' }]
  ])('rejects invalid payload: %s', async (_label, bad) => {
    const repo = createLocalRecordsRepository();
    await expect(repo.insert(bad)).rejects.toBeInstanceOf(
      PayloadValidationError
    );
  });
});

describe('OfflineEntry sync transitions', () => {
  it('moves pending -> syncing -> synced after confirmed success', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    const syncing = await repo.transition(entry.localId, 'syncing');
    expect(syncing.syncStatus).toBe('syncing');
    const synced = await repo.transition(entry.localId, 'synced');
    expect(synced.syncStatus).toBe('synced');
  });

  it('allows retry from failed back to pending', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');
    await repo.transition(entry.localId, 'failed');
    const retried = await repo.transition(entry.localId, 'pending');
    expect(retried.syncStatus).toBe('pending');
  });

  it('preserves the entry and allows retry after a conflict', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');
    await repo.transition(entry.localId, 'conflict');
    const all = await repo.list();
    expect(all.find((e) => e.localId === entry.localId)).toBeDefined();
  });

  it('rejects jumping synced -> pending directly', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');
    await repo.transition(entry.localId, 'synced');
    await expect(
      repo.transition(entry.localId, 'pending')
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

describe('OfflineEntry edit and delete before sync', () => {
  it('edits a pending entry without changing its sync status', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    const updated = await repo.update(entry.localId, {
      ...validPayload,
      amount: 250
    });
    expect(updated.payload.amount).toBe(250);
    expect(updated.syncStatus).toBe('pending');
  });

  it('deletes a pending entry', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.delete(entry.localId);
    await expect(repo.list()).resolves.toHaveLength(0);
  });

  it('throws a typed error when deleting an unknown entry', async () => {
    const repo = createLocalRecordsRepository();
    await expect(repo.delete('missing')).rejects.toBeInstanceOf(
      EntryNotFoundError
    );
  });

  it('rejects editing an entry after synchronization is confirmed', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');
    await repo.transition(entry.localId, 'synced');

    await expect(
      repo.update(entry.localId, { ...validPayload, amount: 250 })
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('rejects deleting an entry after synchronization is confirmed', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');
    await repo.transition(entry.localId, 'synced');

    await expect(repo.delete(entry.localId)).rejects.toBeInstanceOf(
      InvalidTransitionError
    );
  });
});

describe('OfflineEntry terminal delete transition', () => {
  it('removes the entry via the deleted terminal', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'deleted');
    const remaining = await repo.list();
    expect(
      remaining.find((e: OfflineEntry) => e.localId === entry.localId)
    ).toBeUndefined();
  });

  it('rejects the deleted terminal from a non-pending state', async () => {
    const repo = createLocalRecordsRepository();
    const entry = await repo.insert(validPayload);
    await repo.transition(entry.localId, 'syncing');

    await expect(
      repo.transition(entry.localId, 'deleted')
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

describe('OfflineEntry failure details', () => {
  it.each(['failed', 'conflict'] as const)(
    'stores an actionable error key for %s transitions',
    async (status) => {
      const repo = createLocalRecordsRepository();
      const entry = await repo.insert(validPayload);
      await repo.transition(entry.localId, 'syncing');
      const changed = await repo.transition(entry.localId, status);

      expect(changed.lastErrorKey).toBe(`capture.offline.${status}`);
    }
  );
});
