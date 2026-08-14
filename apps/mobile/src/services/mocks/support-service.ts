import {
  canRateTicket,
  supportArticleSchema,
  supportDraftSchema,
  supportOperationSchema,
  supportTicketSchema,
  type SupportArticle,
  type SupportDraft,
  type SupportDraftInput,
  type SupportOperation,
  type SupportReplyInput,
  type SupportTicket
} from '@/domain/support';
import type { Page } from '@/domain/notifications';
import {
  supportServiceCapability,
  type SupportService
} from '@/services/contracts/assistant-notifications-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import type { MutationResult } from '@/services/contracts/core-finance-service';
import { SupportRepository } from '@/storage/support-repository';

type Repository = Pick<SupportRepository, 'saveDraft' | 'loadDraft' | 'discardDraft' | 'listTickets' | 'getTicket' | 'getOperation' | 'startOperation' | 'completeOperation'>;
type SupportFailure = 'offline' | 'representative_failure';

export class SupportServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function createMockSupportService({
  repository = new MemorySupportRepository(),
  now = Date.now,
  failNextOperation = null
}: {
  repository?: Repository;
  now?: () => number;
  failNextOperation?: SupportFailure | null;
} = {}): CapabilityProviderHandle<SupportService> & { resolveTicketForTest(ticketId: string): Promise<void> } {
  let pendingFailure = failNextOperation;

  async function saveDraft(input: SupportDraftInput): Promise<SupportDraft> {
    try {
      return await repository.saveDraft(supportDraftSchema.parse({ ...input, status: 'draft', updatedAt: now() }));
    } catch {
      throw new SupportServiceError('validation');
    }
  }

  async function completeStarted(operation: SupportOperation, ticket?: SupportTicket, expectedVersion?: number | null): Promise<MutationResult<SupportOperation>> {
    const failure = pendingFailure;
    pendingFailure = null;
    const completion = supportOperationSchema.parse({
      ...operation,
      status: failure ? 'failed' : 'submitted',
      safeFailure: failure,
      completedAt: now()
    });
    const stored = await repository.completeOperation(completion, ticket ? { ticket, expectedVersion: expectedVersion ?? null } : undefined);
    return result(stored, scopesFor(stored));
  }

  async function startOperation(input: Omit<SupportOperation, 'id' | 'requestedAt' | 'completedAt' | 'safeFailure' | 'status'>): Promise<SupportOperation> {
    try {
      return await repository.getOperation(input.operationId);
    } catch {
      return repository.startOperation(supportOperationSchema.parse({
        ...input,
        id: `support-operation-${input.operationId}`,
        status: 'pending',
        safeFailure: null,
        requestedAt: now(),
        completedAt: null
      }));
    }
  }

  return {
    metadata: {
      id: 'mock-support',
      capability: supportServiceCapability.capability,
      majorVersion: supportServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    async searchArticles({ query, category }) {
      const term = normalize(query);
      return articles.filter((article) => (!category || article.category === category) && article.searchTerms.some((item) => normalize(item).includes(term)));
    },
    listTickets: (cursor?: string) => repository.listTickets(cursor),
    getTicket: (id: string) => repository.getTicket(id),
    saveDraft,
    loadDraft: (id: string) => repository.loadDraft(id),
    discardDraft: (id: string) => repository.discardDraft(id),
    async submitDraft(id: string, operationId: string) {
      const replay = await replayOperation(operationId);
      if (replay) return replay;
      const draft = await requireDraft(repository, id);
      const ticketId = `ticket-${id}`;
      const kind = kindFor(draft.mode);
      const operation = await startOperation({ operationId, kind, draftId: id, ticketId });
      if (operation.status !== 'pending') return result(operation, scopesFor(operation));
      const ticket = ticketFromDraft(draft, ticketId, now());
      return completeStarted(operation, ticket, null);
    },
    async reply(ticketId: string, input: SupportReplyInput, expectedVersion: number, operationId: string) {
      const replay = await replayOperation(operationId);
      if (replay) return replay;
      const current = await repository.getTicket(ticketId);
      if (current.version !== expectedVersion) throw new SupportServiceError('conflict');
      const operation = await startOperation({ operationId, kind: 'reply', draftId: null, ticketId });
      if (operation.status !== 'pending') return result(operation, scopesFor(operation));
      const ticket = supportTicketSchema.parse({
        ...current,
        messages: [...current.messages, { id: `message-${operationId}`, author: 'user', body: input.description, createdAt: now() }],
        updatedAt: now(),
        version: current.version + 1
      });
      return completeStarted(operation, ticket, current.version);
    },
    async rate(ticketId: string, rating: number, expectedVersion: number, operationId: string) {
      const replay = await replayOperation(operationId);
      if (replay) return replay;
      const current = await repository.getTicket(ticketId);
      if (current.version !== expectedVersion) throw new SupportServiceError('conflict');
      if (!canRateTicket(current.status)) throw new SupportServiceError('rating_not_allowed');
      const operation = await startOperation({ operationId, kind: 'rate', draftId: null, ticketId });
      if (operation.status !== 'pending') return result(operation, scopesFor(operation));
      const ticket = supportTicketSchema.parse({ ...current, rating, updatedAt: now(), version: current.version + 1 });
      return completeStarted(operation, ticket, current.version);
    },
    async resolveTicketForTest(ticketId: string) {
      if (!(repository instanceof MemorySupportRepository)) return;
      await repository.setTicketStatus(ticketId, 'resolved', now());
    }
  };

  async function replayOperation(operationId: string): Promise<MutationResult<SupportOperation> | null> {
    try {
      const operation = await repository.getOperation(operationId);
      return result(operation, scopesFor(operation));
    } catch {
      return null;
    }
  }
}

export const supportService = createMockSupportService({ repository: new SupportRepository() });

const articles = [
  article('faq-subscription', 'faq', 'support.article.subscription.title', 'support.article.subscription.body', ['subscription', 'subscr', 'اشتراك', 'Ø§Ø´ØªØ±Ø§Ùƒ'], 'billing'),
  article('help-ticket', 'help', 'support.article.ticket.title', 'support.article.ticket.body', ['ticket', 'support', 'help', 'دعم'], 'support'),
  article('whats-new-2026-01', 'whats_new', 'support.article.whatsNew.title', 'support.article.whatsNew.body', ['whats new', 'new', 'جديد'], 'release')
];

function article(id: string, kind: SupportArticle['kind'], titleKey: string, bodyKey: string, searchTerms: string[], category: string): SupportArticle {
  return supportArticleSchema.parse({ id, kind, titleKey, bodyKey, searchTerms, category, version: '1.0.0', publishedAt: Date.UTC(2026, 0, 1) });
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

function kindFor(mode: SupportDraft['mode']): SupportOperation['kind'] {
  if (mode === 'feedback') return 'feedback';
  if (mode === 'transaction_report') return 'report_transaction';
  if (mode === 'assistant_report') return 'report_assistant';
  return 'submit_ticket';
}

async function requireDraft(repository: Repository, id: string): Promise<SupportDraft> {
  const draft = await repository.loadDraft(id);
  if (!draft) throw new SupportServiceError('not_found');
  return draft;
}

function ticketFromDraft(draft: SupportDraft, ticketId: string, at: number): SupportTicket {
  return supportTicketSchema.parse({
    id: ticketId,
    reference: `MSR-${ticketId.toUpperCase()}`,
    category: draft.category,
    subject: draft.subject,
    description: draft.description,
    context: draft.context,
    status: 'submitted',
    messages: [{ id: `message-${draft.id}`, author: 'user', body: draft.description, createdAt: at }],
    createdAt: at,
    updatedAt: at,
    rating: null,
    version: 1
  });
}

function result<T>(value: T, affectedScopes: readonly string[]): MutationResult<T> {
  return { value, affectedScopes };
}

function scopesFor(operation: SupportOperation): readonly string[] {
  if (operation.status !== 'submitted') return [`support.operation.${operation.operationId}`];
  return operation.ticketId ? [`support.operation.${operation.operationId}`, 'support.tickets', `support.ticket.${operation.ticketId}`] : [`support.operation.${operation.operationId}`];
}

class MemorySupportRepository implements Repository {
  private drafts = new Map<string, SupportDraft>();
  private tickets = new Map<string, SupportTicket>();
  private operations = new Map<string, SupportOperation>();

  async saveDraft(input: SupportDraft) {
    const draft = supportDraftSchema.parse(input);
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async loadDraft(id: string) {
    return this.drafts.get(id) ?? null;
  }

  async discardDraft(id: string) {
    this.drafts.delete(id);
  }

  async listTickets(cursor?: string): Promise<Page<SupportTicket>> {
    const sorted = [...this.tickets.values()].sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
    const start = cursor ? Number(cursor) : 0;
    return { items: sorted.slice(start, start + 25), total: sorted.length, nextCursor: start + 25 < sorted.length ? String(start + 25) : null };
  }

  async getTicket(id: string) {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new SupportServiceError('not_found');
    return ticket;
  }

  async getOperation(operationId: string) {
    const operation = this.operations.get(operationId);
    if (!operation) throw new SupportServiceError('not_found');
    return operation;
  }

  async startOperation(input: SupportOperation) {
    const replay = this.operations.get(input.operationId);
    if (replay) return replay;
    const operation = supportOperationSchema.parse(input);
    this.operations.set(operation.operationId, operation);
    return operation;
  }

  async completeOperation(input: SupportOperation, change?: { ticket: SupportTicket; expectedVersion: number | null }) {
    const current = await this.getOperation(input.operationId);
    if (current.status !== 'pending') return current;
    const operation = supportOperationSchema.parse(input);
    if (operation.status === 'submitted' && change) {
      const existing = this.tickets.get(change.ticket.id);
      const expected = existing?.version ?? null;
      if (expected !== change.expectedVersion || change.ticket.version !== (expected ?? 0) + 1) throw new SupportServiceError('conflict');
      this.tickets.set(change.ticket.id, supportTicketSchema.parse(change.ticket));
      if (operation.draftId) this.drafts.delete(operation.draftId);
    }
    this.operations.set(operation.operationId, operation);
    return operation;
  }

  async setTicketStatus(id: string, status: SupportTicket['status'], at: number) {
    const current = await this.getTicket(id);
    this.tickets.set(id, supportTicketSchema.parse({ ...current, status, updatedAt: at, version: current.version + 1 }));
  }
}
