import type { SupportDraft, SupportOperation, SupportTicket } from '@/domain/support';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';

let mockDatabase: StatefulSqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(async (database: StatefulSqlite, operation: (transaction: StatefulSqlite) => Promise<void>) => database.withExclusiveTransactionAsync(operation))
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportRepository } = require('./support-repository') as typeof import('./support-repository');

const draft = (id: string, updatedAt = 1): SupportDraft => ({
  id, mode: 'ticket', category: 'technical', subject: `Subject ${id}`, description: `Description ${id}`,
  ticketId: null, context: null, status: 'draft', updatedAt
});

const ticket = (id: string, updatedAt: number, status: SupportTicket['status'] = 'open', version = 1): SupportTicket => ({
  id, reference: `SUP-${id}`, category: 'technical', subject: `Subject ${id}`, description: `Description ${id}`,
  context: null, status, messages: [
    { id: `${id}-new`, author: 'support', body: 'Newest', createdAt: updatedAt },
    { id: `${id}-old`, author: 'user', body: 'Oldest', createdAt: 1 }
  ], createdAt: 1, updatedAt, rating: null, version
});

const operation = (
  operationId: string,
  status: SupportOperation['status'] = 'pending',
  kind: SupportOperation['kind'] = 'submit_ticket',
  ticketId: string | null = null
): SupportOperation => ({
  id: `record-${operationId}`, operationId, kind, draftId: kind === 'rate' ? null : `draft-${operationId}`, ticketId,
  status, safeFailure: status === 'failed' ? 'offline' : null, requestedAt: 1,
  completedAt: status === 'submitted' ? 2 : status === 'pending' ? null : 2
});

beforeEach(() => {
  mockDatabase = new StatefulSqlite(['support_drafts', 'support_tickets', 'support_operations']);
});

async function submitTicket(repository: InstanceType<typeof SupportRepository>, value: SupportTicket, operationId = `create-${value.id}`): Promise<void> {
  await repository.startOperation(operation(operationId));
  await repository.completeOperation(operation(operationId, 'submitted', 'submit_ticket', value.id), { ticket: value, expectedVersion: null });
}

test('recovers and discards drafts independently across repository instances', async () => {
  const repository = new SupportRepository();
  await repository.saveDraft(draft('one', 1));
  await repository.saveDraft(draft('two', 2));

  expect(await new SupportRepository().loadDraft('one')).toEqual(draft('one', 1));
  expect(await new SupportRepository().loadDraft('two')).toEqual(draft('two', 2));
  await repository.discardDraft('one');
  expect(await repository.loadDraft('one')).toBeNull();
  expect(await repository.loadDraft('two')).toEqual(draft('two', 2));
});

test('pages tickets stably and returns messages in chronological order', async () => {
  const repository = new SupportRepository();
  await submitTicket(repository, ticket('old', 1));
  await submitTicket(repository, ticket('a', 2));
  await submitTicket(repository, ticket('b', 2));

  const first = await repository.listTickets(undefined, 2);
  const second = await repository.listTickets(first.nextCursor ?? undefined, 2);

  expect(first.items.map((value) => value.id)).toEqual(['b', 'a']);
  expect(second.items.map((value) => value.id)).toEqual(['old']);
  expect((await repository.getTicket('b')).messages.map((message) => message.id)).toEqual(['b-old', 'b-new']);
});

test('rejects rating a nonexistent ticket', async () => {
  const repository = new SupportRepository();
  await repository.startOperation(operation('rate-missing', 'pending', 'rate', 'missing'));

  await expect(repository.completeOperation(operation('rate-missing', 'submitted', 'rate', 'missing'), {
    ticket: { ...ticket('missing', 3, 'resolved', 2), rating: 5 }, expectedVersion: 1
  })).rejects.toThrow('not_found');
  expect(await repository.getOperation('rate-missing')).toEqual(operation('rate-missing', 'pending', 'rate', 'missing'));
});

test('rejects rating a persisted open ticket even when the proposed snapshot says resolved', async () => {
  const repository = new SupportRepository();
  await submitTicket(repository, ticket('open', 2));
  await repository.startOperation(operation('rate-open', 'pending', 'rate', 'open'));

  await expect(repository.completeOperation(operation('rate-open', 'submitted', 'rate', 'open'), {
    ticket: { ...ticket('open', 3, 'resolved', 2), rating: 5 }, expectedVersion: 1
  })).rejects.toThrow('rating_not_allowed');
  const unchanged = await repository.getTicket('open');
  expect(unchanged).toMatchObject({ status: 'open', subject: 'Subject open', rating: null, version: 1 });
  expect(unchanged.messages.map((message) => message.id)).toEqual(['open-old', 'open-new']);
});

test.each(['resolved', 'closed'] as const)('rates a persisted %s ticket without replacing other fields', async (status) => {
  const repository = new SupportRepository();
  await submitTicket(repository, ticket(status, 2, status));
  await repository.startOperation(operation(`rate-${status}`, 'pending', 'rate', status));
  const proposed = {
    ...ticket(status, 3, status === 'resolved' ? 'closed' : 'resolved', 2),
    subject: 'Replacement must be ignored', messages: [], rating: 5
  } as SupportTicket;

  await expect(repository.completeOperation(operation(`rate-${status}`, 'submitted', 'rate', status), { ticket: proposed, expectedVersion: 9 })).rejects.toThrow('conflict');
  await repository.completeOperation(operation(`rate-${status}`, 'submitted', 'rate', status), { ticket: proposed, expectedVersion: 1 });
  const rated = await repository.getTicket(status);
  expect(rated).toMatchObject({ status, subject: `Subject ${status}`, rating: 5, version: 2, updatedAt: 3 });
  expect(rated.messages.map((message) => message.id)).toEqual([`${status}-old`, `${status}-new`]);
});

test('keeps drafts and tickets unchanged unless an operation is submitted', async () => {
  const repository = new SupportRepository();
  await repository.saveDraft(draft('draft-failed'));
  await repository.startOperation(operation('failed'));
  await repository.completeOperation(operation('failed', 'failed', 'submit_ticket', 'not-visible'), { ticket: ticket('not-visible', 2), expectedVersion: null });

  expect((await repository.listTickets()).items).toEqual([]);
  expect(await repository.loadDraft('draft-failed')).toEqual(draft('draft-failed'));

  await repository.saveDraft({ ...draft('draft-success'), id: 'draft-success' });
  await repository.startOperation({ ...operation('success'), draftId: 'draft-success' });
  await repository.completeOperation({ ...operation('success', 'submitted', 'submit_ticket', 'visible'), draftId: 'draft-success' }, { ticket: ticket('visible', 3), expectedVersion: null });
  expect((await repository.listTickets()).items.map((value) => value.id)).toEqual(['visible']);
  expect(await repository.loadDraft('draft-success')).toBeNull();
});

test('replays a unique submitted operation without duplicating its visible change', async () => {
  const repository = new SupportRepository();
  await repository.startOperation(operation('same'));
  const completed = await repository.completeOperation(operation('same', 'submitted', 'submit_ticket', 'visible'), { ticket: ticket('visible', 2), expectedVersion: null });

  const replay = await repository.completeOperation({ ...operation('same', 'submitted', 'submit_ticket', 'changed'), completedAt: 99 }, { ticket: ticket('changed', 99), expectedVersion: null });
  expect(replay).toEqual(completed);
  expect((await repository.listTickets()).items.map((value) => value.id)).toEqual(['visible']);
  expect(mockDatabase.read('support_operations')).toHaveLength(1);
});

test('rolls back operation and draft changes when a submitted ticket write fails', async () => {
  const repository = new SupportRepository();
  await repository.saveDraft(draft('atomic'));
  await repository.startOperation({ ...operation('atomic'), draftId: 'atomic' });
  mockDatabase.failNextWrite('support_tickets');

  await expect(repository.completeOperation({ ...operation('atomic', 'submitted', 'submit_ticket', 'visible'), draftId: 'atomic' }, { ticket: ticket('visible', 2), expectedVersion: null })).rejects.toThrow('injected support_tickets failure');
  expect(await repository.getOperation('atomic')).toEqual({ ...operation('atomic'), draftId: 'atomic' });
  expect(await repository.loadDraft('atomic')).toEqual(draft('atomic'));
  expect(mockDatabase.read('support_tickets')).toEqual([]);
});

test('persists no attachment column in drafts, tickets, or operations', async () => {
  const repository = new SupportRepository();
  await repository.saveDraft(draft('columns'));
  await submitTicket(repository, ticket('columns', 2), 'columns');

  for (const table of ['support_drafts', 'support_tickets', 'support_operations']) {
    expect(Object.keys(mockDatabase.read(table)[0])).not.toContain('attachment');
  }
});
