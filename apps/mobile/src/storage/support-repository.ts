import {
  supportDraftSchema,
  supportOperationSchema,
  supportTicketSchema,
  canRateTicket,
  type SupportDraft,
  type SupportOperation,
  type SupportTicket
} from '@/domain/support';
import type { Page } from '@/domain/notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';

type PayloadRow = { payload: string };
type TicketChange = { ticket: SupportTicket; expectedVersion: number | null };

export class SupportRepository {
  async saveDraft(input: SupportDraft): Promise<SupportDraft> {
    const draft = supportDraftSchema.parse(input);
    const database = await openDatabase();
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      await persistDraft(transaction, draft);
    });
    return draft;
  }

  async loadDraft(id: string): Promise<SupportDraft | null> {
    return optionalPayload(await openDatabase(), 'support_drafts', 'id', id, supportDraftSchema);
  }

  async discardDraft(id: string): Promise<void> {
    const database = await openDatabase();
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      await transaction.runAsync('DELETE FROM support_drafts WHERE id = ?', id);
    });
  }

  async getTicket(id: string): Promise<SupportTicket> {
    return requirePayload(await openDatabase(), 'support_tickets', 'id', id, supportTicketSchema);
  }

  async listTickets(cursor?: string, pageSizeInput?: number): Promise<Page<SupportTicket>> {
    const pageSize = normalizedPageSize(pageSizeInput);
    const decoded = cursor ? decodeCursor(cursor) : null;
    const tickets = (await (await openDatabase()).getAllAsync<PayloadRow>('SELECT payload FROM support_tickets'))
      .map((row) => supportTicketSchema.parse(JSON.parse(row.payload)))
      .sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
    return pageValues(tickets, pageSize, decoded);
  }

  async getOperation(operationId: string): Promise<SupportOperation> {
    return requirePayload(await openDatabase(), 'support_operations', 'operation_id', operationId, supportOperationSchema);
  }

  async startOperation(input: SupportOperation): Promise<SupportOperation> {
    const operation = supportOperationSchema.parse(input);
    if (operation.status !== 'pending') throw new Error('invalid_status');
    const database = await openDatabase();
    let stored = operation;
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const replay = await optionalPayload(transaction, 'support_operations', 'operation_id', operation.operationId, supportOperationSchema);
      if (replay) { stored = replay; return; }
      await persistOperation(transaction, operation);
    });
    return stored;
  }

  async completeOperation(input: SupportOperation, ticketChange?: TicketChange): Promise<SupportOperation> {
    const completion = supportOperationSchema.parse(input);
    if (!['submitted', 'failed', 'cancelled'].includes(completion.status)) throw new Error('invalid_status');
    const database = await openDatabase();
    let stored = completion;
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const current = await requirePayload(transaction, 'support_operations', 'operation_id', completion.operationId, supportOperationSchema);
      if (current.status !== 'pending') { stored = current; return; }
      if (!sameOperation(current, completion)) throw new Error('operation_immutable');
      await persistOperation(transaction, completion);
      if (completion.status === 'submitted') await applySubmittedChange(transaction, completion, ticketChange);
    });
    return stored;
  }
}

async function applySubmittedChange(database: SQLiteDatabase, operation: SupportOperation, change?: TicketChange): Promise<void> {
  if (operation.kind === 'rate') {
    await applyRatingChange(database, operation, change);
    return;
  }
  if (change) {
    const ticket = orderedTicket(change.ticket);
    if (operation.ticketId !== ticket.id) throw new Error('operation_immutable');
    const current = await optionalPayload(database, 'support_tickets', 'id', ticket.id, supportTicketSchema);
    checkNextVersion(current?.version ?? null, change.expectedVersion, ticket.version);
    await persistTicket(database, ticket);
  }
  if (operation.draftId) await database.runAsync('DELETE FROM support_drafts WHERE id = ?', operation.draftId);
}

async function applyRatingChange(database: SQLiteDatabase, operation: SupportOperation, change?: TicketChange): Promise<void> {
  if (!change || !operation.ticketId || change.ticket.id !== operation.ticketId) throw new Error('operation_immutable');
  const current = await requirePayload(database, 'support_tickets', 'id', operation.ticketId, supportTicketSchema);
  if (!canRateTicket(current.status)) throw new Error('rating_not_allowed');
  if (change.ticket.rating === null) throw new Error('rating_required');
  checkNextVersion(current.version, change.expectedVersion, change.ticket.version);
  const rated = supportTicketSchema.parse({ ...current, rating: change.ticket.rating, version: change.ticket.version, updatedAt: change.ticket.updatedAt });
  await persistTicket(database, rated);
}

function orderedTicket(input: SupportTicket): SupportTicket {
  return supportTicketSchema.parse({
    ...input,
    messages: [...input.messages].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  });
}

function sameOperation(current: SupportOperation, completion: SupportOperation): boolean {
  return current.id === completion.id && current.operationId === completion.operationId && current.kind === completion.kind &&
    current.draftId === completion.draftId && (current.ticketId === null || current.ticketId === completion.ticketId);
}

function checkNextVersion(current: number | null, expected: number | null, next: number): void {
  if (current !== expected || next !== (current ?? 0) + 1) throw new Error('conflict');
}

function persistDraft(database: Pick<SQLiteDatabase, 'runAsync'>, draft: SupportDraft): Promise<unknown> {
  return database.runAsync(
    'INSERT INTO support_drafts (id, payload, mode, status, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, mode = excluded.mode, status = excluded.status, updated_at = excluded.updated_at',
    draft.id, JSON.stringify(draft), draft.mode, draft.status, draft.updatedAt
  );
}

function persistTicket(database: Pick<SQLiteDatabase, 'runAsync'>, ticket: SupportTicket): Promise<unknown> {
  return database.runAsync(
    'INSERT INTO support_tickets (id, payload, status, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, status = excluded.status, updated_at = excluded.updated_at',
    ticket.id, JSON.stringify(ticket), ticket.status, ticket.updatedAt
  );
}

function persistOperation(database: Pick<SQLiteDatabase, 'runAsync'>, operation: SupportOperation): Promise<unknown> {
  return database.runAsync(
    'INSERT INTO support_operations (id, payload, operation_id, kind, status, requested_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, operation_id = excluded.operation_id, kind = excluded.kind, status = excluded.status, requested_at = excluded.requested_at',
    operation.id, JSON.stringify(operation), operation.operationId, operation.kind, operation.status, operation.requestedAt
  );
}

async function requirePayload<T>(database: Pick<SQLiteDatabase, 'getFirstAsync'>, table: string, column: string, key: string, schema: Parser<T>): Promise<T> {
  const stored = await optionalPayload(database, table, column, key, schema);
  if (!stored) throw new Error('not_found');
  return stored;
}

async function optionalPayload<T>(database: Pick<SQLiteDatabase, 'getFirstAsync'>, table: string, column: string, key: string, schema: Parser<T>): Promise<T | null> {
  const row = await database.getFirstAsync<PayloadRow>(`SELECT payload FROM ${table} WHERE ${column} = ?`, key);
  return row ? schema.parse(JSON.parse(row.payload)) : null;
}

function pageValues(tickets: SupportTicket[], pageSize: number, cursor: [number, string] | null): Page<SupportTicket> {
  // ponytail: deterministic support history is bounded; move cursor filtering into SQL if retention becomes unbounded.
  const start = cursor ? tickets.findIndex((ticket) => ticket.updatedAt < cursor[0] || (ticket.updatedAt === cursor[0] && ticket.id < cursor[1])) : 0;
  const items = start < 0 ? [] : tickets.slice(start, start + pageSize);
  return { items, total: tickets.length, nextCursor: start >= 0 && start + pageSize < tickets.length && items.length ? encodeCursor(items[items.length - 1]) : null };
}

function normalizedPageSize(value?: number): number {
  if (value === undefined) return 25;
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('invalid_page_size');
  return value;
}

function encodeCursor(ticket: SupportTicket): string {
  return encodeURIComponent(JSON.stringify([ticket.updatedAt, ticket.id]));
}

function decodeCursor(value: string): [number, string] {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!Array.isArray(parsed) || parsed.length !== 2 || !Number.isInteger(parsed[0]) || typeof parsed[1] !== 'string') throw new Error();
    return [parsed[0], parsed[1]];
  } catch {
    throw new Error('invalid_cursor');
  }
}

type Parser<T> = { parse(value: unknown): T };
