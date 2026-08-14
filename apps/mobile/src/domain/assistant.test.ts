import { type AssistantResponse, assistantActionPreviewSchema, assistantConsentSchema, assistantResponseSchema, canTransitionPreview, deleteConversationIsolated } from './assistant';

test('validates consent and immutable safe response snapshots', () => {
  expect(assistantConsentSchema.safeParse({ status: 'enabled', disclosedDataCategories: ['transactions'], consentedAt: 1, disabledAt: null, version: 1 }).success).toBe(true);
  expect(assistantResponseSchema.safeParse({ id: 'r1', conversationId: 'c1', question: 'How much?', responseType: 'direct', blocks: [{ label: 'fact', key: 'assistant.fact', values: {} }], period: null, dataAsOf: 1, snapshot: { sources: [{ kind: 'transaction', id: 'tx1', version: 2 }], values: [], completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: [] }, reportReference: null }, limitations: [], proposedActionIds: [], feedback: null, createdAt: 1 }).success).toBe(true);
});

test('keeps conversation deletion isolated and previews versioned, expiring, and operation-bound', () => {
  const preview = { id: 'p1', responseId: 'r1', kind: 'create_budget', input: { amountMinor: 1, currency: 'SAR' }, affectedDestination: { kind: 'budget', budgetId: 'b1' }, sourceVersions: [{ id: 'b1', version: 1 }], status: 'ready', operationId: null, expiresAt: 2, resultReference: null, safeFailure: null, version: 1 };
  expect(assistantActionPreviewSchema.safeParse(preview).success).toBe(true);
  expect(canTransitionPreview('ready', 'confirming')).toBe(true);
  expect(canTransitionPreview('succeeded', 'ready')).toBe(false);
  const sources = [{ id: 'tx1' }];
  expect(deleteConversationIsolated('c1', [{ conversationId: 'c1' }, { conversationId: 'c2' }], sources)).toEqual({ responses: [{ conversationId: 'c2' }], sourceRecords: sources });
});

test('rejects unsafe snapshots and inconsistent consent or data-changing preview lifecycle', () => {
  expect(assistantConsentSchema.safeParse({ status: 'enabled', disclosedDataCategories: [], consentedAt: null, disabledAt: null, version: 1 }).success).toBe(false);
  expect(assistantResponseSchema.safeParse({ id: 'r2', conversationId: 'c1', question: 'Q', responseType: 'direct', blocks: [], period: null, dataAsOf: 1, snapshot: { sources: [{ kind: 'transaction', id: 'tx1', version: 1, note: 'raw' }], values: [], completeness: { confirmed: 0, reviewRequired: 0, conflicts: 0, reasons: [] }, reportReference: null }, limitations: [], proposedActionIds: [], feedback: null, createdAt: 1 }).success).toBe(false);
  expect(assistantActionPreviewSchema.safeParse({ id: 'p2', responseId: 'r1', kind: 'create_budget', input: {}, affectedDestination: { kind: 'url', href: '/bad' }, sourceVersions: [], status: 'confirming', operationId: null, expiresAt: null, resultReference: null, safeFailure: null, version: 1 }).success).toBe(false);
});

test('parses deeply frozen readonly response snapshots', () => {
  const response: AssistantResponse = assistantResponseSchema.parse({ id: 'r3', conversationId: 'c1', question: 'How much?', responseType: 'direct', blocks: [], period: null, dataAsOf: 1, snapshot: { sources: [{ kind: 'transaction', id: 'tx1', version: 1 }], values: [], completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: ['confirmed_only'] }, reportReference: null }, limitations: [], proposedActionIds: [], feedback: null, createdAt: 1 });
  if (false) {
    // @ts-expect-error AssistantResponse exposes nested snapshot values as readonly.
    response.snapshot.completeness.confirmed = 2;
  }
  expect([response.snapshot, response.snapshot.sources, response.snapshot.sources[0], response.snapshot.completeness, response.snapshot.completeness.reasons].every(Object.isFrozen)).toBe(true);
  expect(Reflect.set(response.snapshot.completeness, 'confirmed', 2)).toBe(false);
  expect(response.snapshot.completeness.confirmed).toBe(1);
});
