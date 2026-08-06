/**
 * Offline-entry repository.
 *
 * Validates payload before persistence, stores entries locally, and guards sync
 * transitions against the allowed OfflineEntry state machine. An entry is never
 * presented as synchronized until `synced` is confirmed. UI Contract §6.
 */

import { z } from 'zod';

import { openDatabase } from './database';
import {
  OFFLINE_ENTRY_TRANSITIONS,
  OFFLINE_ENTRY_DELETED,
  type OfflineEntry,
  type OfflineEntryPayload,
  type OfflineEntrySyncStatus
} from '@/domain/foundation';
import type { OfflineEntryRepository } from '@/services/contracts/foundation-service';
import {
  InvalidTransitionError,
  PayloadValidationError
} from '@/storage/errors';

const payloadSchema = z.object({
  amount: z.number().finite(),
  currencyCode: z.string().min(3).max(3),
  categoryKey: z.string().min(1),
  note: z.string().nullable()
});

interface OfflineEntryRow {
  local_id: string;
  amount: number;
  currency_code: string;
  category_key: string;
  note: string | null;
  sync_status: string;
  created_at: number;
  updated_at: number;
  last_error_key: string | null;
}

export function createLocalRecordsRepository(): OfflineEntryRepository {
  return {
    insert,
    update,
    delete: remove,
    list,
    transition
  };
}

async function insert(payload: OfflineEntryPayload): Promise<OfflineEntry> {
  validatePayload(payload);
  const now = Date.now();
  const localId = generateLocalId(now);
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO offline_entries
       (local_id, amount, currency_code, category_key, note, sync_status, created_at, updated_at, last_error_key)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`,
    localId,
    payload.amount,
    payload.currencyCode,
    payload.categoryKey,
    payload.note,
    now,
    now
  );
  return mapRow({
    local_id: localId,
    amount: payload.amount,
    currency_code: payload.currencyCode,
    category_key: payload.categoryKey,
    note: payload.note,
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
    last_error_key: null
  });
}

async function update(
  localId: string,
  payload: OfflineEntryPayload
): Promise<OfflineEntry> {
  validatePayload(payload);
  const current = await requireEntry(localId);
  if (current.syncStatus === 'syncing' || current.syncStatus === 'synced') {
    throw new InvalidTransitionError(current.syncStatus, 'edit');
  }
  const now = Date.now();
  const db = await openDatabase();
  const result = await db.runAsync(
    `UPDATE offline_entries
     SET amount = ?, currency_code = ?, category_key = ?, note = ?, updated_at = ?
     WHERE local_id = ?`,
    payload.amount,
    payload.currencyCode,
    payload.categoryKey,
    payload.note,
    now,
    localId
  );
  if (result.changes === 0) {
    throw new EntryNotFoundError(localId);
  }
  return requireEntry(localId);
}

async function remove(localId: string): Promise<void> {
  const current = await requireEntry(localId);
  if (!isAllowedTransition(current.syncStatus, OFFLINE_ENTRY_DELETED)) {
    throw new InvalidTransitionError(current.syncStatus, OFFLINE_ENTRY_DELETED);
  }
  const db = await openDatabase();
  const result = await db.runAsync(
    'DELETE FROM offline_entries WHERE local_id = ?',
    localId
  );
  if (result.changes === 0) {
    throw new EntryNotFoundError(localId);
  }
}

async function list(): Promise<readonly OfflineEntry[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<OfflineEntryRow>(
    'SELECT * FROM offline_entries ORDER BY created_at ASC'
  );
  return rows.map(mapRow);
}

async function transition(
  localId: string,
  next: OfflineEntrySyncStatus | typeof OFFLINE_ENTRY_DELETED
): Promise<OfflineEntry> {
  const current = await requireEntry(localId);

  if (next === OFFLINE_ENTRY_DELETED) {
    if (!isAllowedTransition(current.syncStatus, next)) {
      throw new InvalidTransitionError(current.syncStatus, next);
    }
    return remove(localId).then(() => current);
  }

  if (!isAllowedTransition(current.syncStatus, next)) {
    throw new InvalidTransitionError(current.syncStatus, next);
  }

  const now = Date.now();
  const lastErrorKey =
    next === 'failed' || next === 'conflict' ? `capture.offline.${next}` : null;
  const db = await openDatabase();
  await db.runAsync(
    `UPDATE offline_entries
     SET sync_status = ?, updated_at = ?, last_error_key = ?
     WHERE local_id = ?`,
    next,
    now,
    lastErrorKey,
    localId
  );
  return requireEntry(localId);
}

function isAllowedTransition(
  from: OfflineEntrySyncStatus,
  to: OfflineEntrySyncStatus | typeof OFFLINE_ENTRY_DELETED
): boolean {
  const allowed = OFFLINE_ENTRY_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

function validatePayload(payload: OfflineEntryPayload): void {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PayloadValidationError(parsed.error.message);
  }
}

async function requireEntry(localId: string): Promise<OfflineEntry> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<OfflineEntryRow>(
    'SELECT * FROM offline_entries WHERE local_id = ?',
    localId
  );
  if (!row) {
    throw new EntryNotFoundError(localId);
  }
  return mapRow(row);
}

function mapRow(row: OfflineEntryRow): OfflineEntry {
  return {
    localId: row.local_id,
    payload: {
      amount: row.amount,
      currencyCode: row.currency_code,
      categoryKey: row.category_key,
      note: row.note
    },
    syncStatus: row.sync_status as OfflineEntrySyncStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastErrorKey: row.last_error_key
  };
}

function generateLocalId(now: number): string {
  // Stable before remote identity exists; combines timestamp with randomness.
  return `local-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

// Exported for test construction; not part of the repository contract surface.
export class EntryNotFoundError extends Error {
  constructor(localId: string) {
    super(`Offline entry not found: ${localId}`);
    this.name = 'EntryNotFoundError';
  }
}
