import type { SupportDraftInput } from '@/domain/support';
import { translateDynamic } from '@/localization/i18n';

import { createMockSupportService } from './support-service';

const now = Date.UTC(2026, 0, 20, 9);

test('searches localized help by exact, partial, Arabic, English, and no-result terms', async () => {
  const service = createMockSupportService({ now: () => now });

  expect((await service.searchArticles({ query: 'subscription' })).map((item) => item.id)).toContain('faq-subscription');
  expect((await service.searchArticles({ query: 'subscr' })).map((item) => item.id)).toContain('faq-subscription');
  expect((await service.searchArticles({ query: 'اشتراك' })).map((item) => item.id)).toContain('faq-subscription');
  expect(await service.searchArticles({ query: 'nothing-here' })).toEqual([]);
});

test('returns article content keys translated in Arabic and English', async () => {
  const service = createMockSupportService({ now: () => now });
  const articles = await service.searchArticles({ query: '' });

  for (const article of articles) {
    for (const locale of ['ar', 'en'] as const) {
      expect(translateDynamic(article.titleKey, {}, locale)).not.toBe(article.titleKey);
      expect(translateDynamic(article.bodyKey, {}, locale)).not.toBe(article.bodyKey);
    }
  }
});

test('saves, loads, discards, validates, and preserves drafts through failed submission', async () => {
  const service = createMockSupportService({ now: () => now, failNextOperation: 'offline' });
  const draft = await service.saveDraft(ticketDraft('draft-1'));

  expect(await service.loadDraft(draft.id)).toEqual(draft);
  await expect(service.saveDraft({ ...ticketDraft('bad'), subject: '' })).rejects.toMatchObject({ code: 'validation' });
  const failed = await service.submitDraft(draft.id, 'submit-offline');
  expect(failed.value).toMatchObject({ status: 'failed', safeFailure: 'offline' });
  expect(await service.loadDraft(draft.id)).toEqual(draft);

  await service.discardDraft(draft.id);
  expect(await service.loadDraft(draft.id)).toBeNull();
});

test('creates visible tickets, replies, feedback, and contextual reports only after submitted outcomes', async () => {
  const service = createMockSupportService({ now: () => now });
  const ticketDraftValue = await service.saveDraft(ticketDraft('ticket-draft'));
  const ticketOp = await service.submitDraft(ticketDraftValue.id, 'submit-ticket');

  expect(ticketOp.value).toMatchObject({ status: 'submitted', kind: 'submit_ticket' });
  expect((await service.listTickets()).items).toHaveLength(1);

  const ticket = (await service.listTickets()).items[0];
  await service.reply(ticket.id, { description: 'I still need help with this issue.' }, ticket.version, 'reply-1');
  expect((await service.getTicket(ticket.id)).messages.map((message) => message.body)).toContain('I still need help with this issue.');

  for (const draft of [
    feedbackDraft('feedback-draft'),
    transactionReportDraft('tx-report'),
    assistantReportDraft('assistant-report')
  ]) {
    const saved = await service.saveDraft(draft);
    const operation = await service.submitDraft(saved.id, `submit-${saved.id}`);
    expect(operation.value.status).toBe('submitted');
  }
});

test('rates only resolved or closed tickets and replays operations without duplicate visible changes', async () => {
  const service = createMockSupportService({ now: () => now });
  const submitted = await service.saveDraft(ticketDraft('rate-draft'));
  await service.submitDraft(submitted.id, 'submit-rate-ticket');
  const ticket = (await service.listTickets()).items[0];

  await expect(service.rate(ticket.id, 5, ticket.version, 'rate-open')).rejects.toMatchObject({ code: 'rating_not_allowed' });
  await service.resolveTicketForTest(ticket.id);
  const resolved = await service.getTicket(ticket.id);
  const rated = await service.rate(ticket.id, 5, resolved.version, 'rate-resolved');

  expect(rated.value).toMatchObject({ status: 'submitted', kind: 'rate' });
  expect((await service.rate(ticket.id, 1, resolved.version, 'rate-resolved'))).toEqual(rated);
  expect((await service.getTicket(ticket.id)).rating).toBe(5);
});

test('exposes no attachment field in service results', async () => {
  const service = createMockSupportService({ now: () => now });
  const saved = await service.saveDraft(ticketDraft('no-attachments'));
  const submitted = await service.submitDraft(saved.id, 'no-attachment-submit');

  expect(keysIn([saved, submitted, await service.listTickets()]).filter((key) => /attachment/i.test(key))).toEqual([]);
});

function keysIn(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(keysIn);
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysIn(child)]);
}

function ticketDraft(id: string): SupportDraftInput {
  return { id, mode: 'ticket', category: 'technical', subject: 'Need help', description: 'Please help me with this issue.', ticketId: null, context: null };
}

function feedbackDraft(id: string): SupportDraftInput {
  return { ...ticketDraft(id), mode: 'feedback', subject: 'Feedback' };
}

function transactionReportDraft(id: string): SupportDraftInput {
  return {
    ...ticketDraft(id),
    mode: 'transaction_report',
    subject: 'Incorrect transaction',
    context: { itemId: 'transaction-1', itemKind: 'transaction', category: 'technical', status: 'posted', appVersion: '1.0.0', diagnosticCategory: 'transaction' }
  };
}

function assistantReportDraft(id: string): SupportDraftInput {
  return {
    ...ticketDraft(id),
    mode: 'assistant_report',
    subject: 'Incorrect assistant answer',
    context: { itemId: 'response-1', itemKind: 'assistant_response', category: 'assistant', status: 'answered', appVersion: '1.0.0', diagnosticCategory: 'assistant' }
  };
}
