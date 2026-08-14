import { supportContextSchema, supportDraftSchema, supportTicketSchema, canRateTicket, supportArticleSchema, supportMessageSchema, canTransitionTicket, replaySupportOperation, supportOperationSchema } from './support';

test('uses discriminated bounded drafts with an exact attachment-free context allowlist', () => {
  expect(supportDraftSchema.safeParse({ id: 'd1', mode: 'ticket', category: 'technical', subject: 'Help', description: 'A valid description', ticketId: null, context: null, status: 'draft', updatedAt: 1 }).success).toBe(true);
  expect(supportContextSchema.safeParse({ itemId: 'tx1', itemKind: 'transaction', category: 'technical', status: 'review', appVersion: '1.0', diagnosticCategory: 'sync' }).success).toBe(true);
  expect(supportContextSchema.safeParse({ itemId: 'tx1', attachment: 'secret' }).success).toBe(false);
});

test('requires resolved ticket rating', () => {
  expect(supportTicketSchema.safeParse({ id: 't1', reference: 'SUP-1', category: 'technical', subject: 'Help', description: 'A valid description', context: null, status: 'resolved', messages: [], createdAt: 1, updatedAt: 1, rating: null, version: 1 }).success).toBe(true);
  expect(canRateTicket('resolved')).toBe(true);
  expect(canRateTicket('open')).toBe(false);
});

test('validates submitted and failed operation invariants and stable replay', () => {
  const submitted = supportOperationSchema.parse({ id: 'o1', operationId: 'op-1', kind: 'submit_ticket', draftId: 'd1', ticketId: null, status: 'submitted', safeFailure: null, requestedAt: 1, completedAt: 2 });
  expect(supportOperationSchema.safeParse({ ...submitted, completedAt: null }).success).toBe(false);
  expect(supportOperationSchema.safeParse({ ...submitted, status: 'failed', completedAt: 2, safeFailure: null }).success).toBe(false);
  expect(supportOperationSchema.safeParse({ ...submitted, status: 'failed', completedAt: 2, safeFailure: 'offline' }).success).toBe(true);
  expect(replaySupportOperation([submitted], 'op-1')).toBe(submitted);
  expect(replaySupportOperation([submitted], 'missing')).toBeNull();
});

test('rejects report modes paired with the wrong context kind', () => {
  const fields = { id: 'd3', category: 'technical', subject: 'Incorrect result', description: 'A valid description', ticketId: null, status: 'draft', updatedAt: 1 } as const;
  const transactionContext = { itemId: 'tx1', itemKind: 'transaction', category: 'technical', status: 'review', appVersion: '1.0', diagnosticCategory: 'sync' } as const;
  const assistantContext = { ...transactionContext, itemId: 'r1', itemKind: 'assistant_response' } as const;
  expect(supportDraftSchema.safeParse({ ...fields, mode: 'transaction_report', context: assistantContext }).success).toBe(false);
  expect(supportDraftSchema.safeParse({ ...fields, mode: 'assistant_report', context: transactionContext }).success).toBe(false);
});

test('rejects unknown draft/context keys and validates article/message transitions', () => {
  expect(supportDraftSchema.safeParse({ id: 'd2', mode: 'reply', category: 'technical', subject: 'Help', description: 'A valid description', ticketId: null, context: null, status: 'draft', updatedAt: 1, attachment: 'x' }).success).toBe(false);
  expect(supportContextSchema.safeParse({ itemId: 'tx1', itemKind: 'transaction', category: 'technical', status: 'review', appVersion: '1.0', diagnosticCategory: 'sync', amount: 1 }).success).toBe(false);
  expect(supportArticleSchema.safeParse({ id: 'a1', kind: 'faq', titleKey: 'a.title', bodyKey: 'a.body', searchTerms: [], category: 'technical', version: 'v1', publishedAt: 1 }).success).toBe(true);
  expect(supportMessageSchema.safeParse({ id: 'm1', author: 'support', body: 'Reply', createdAt: 1 }).success).toBe(true);
  expect(canTransitionTicket('open', 'resolved')).toBe(true);
  expect(canTransitionTicket('closed', 'open')).toBe(false);
});
