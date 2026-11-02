import {
  normalizeQaSetupOperation,
  type QaSetupOperation,
} from '../../performance/qa-api/qa-ledger-setup';

const source = '00000000-0000-4000-8000-000000000001';
const destination = '00000000-0000-4000-8000-000000000002';
const category = '00000000-0000-4000-8000-000000000003';
const occurredAt = '2025-01-15T09:00:00.000Z';
const createInput: QaSetupOperation = {
  kind: 'createTransaction',
  body: {
    kind: 'income',
    amountMinor: 100,
    currency: 'SAR',
    accountId: source,
    categoryId: category,
    title: 'QA income',
    occurredAt,
  },
};
const cases: readonly [QaSetupOperation, string, number, Record<string, unknown>][] = [
  [
    createInput,
    'ledger.transaction.create',
    201,
    { kind: 'income', amountMinor: 100, currency: 'SAR', accountId: source, occurredAt },
  ],
  [
    {
      kind: 'transfer',
      body: {
        sourceAccountId: source,
        destinationAccountId: destination,
        amountMinor: 1000,
        feeMinor: 75,
        currency: 'SAR',
        title: 'QA transfer',
        occurredAt,
      },
    },
    'ledger.transfer.create',
    201,
    {
      sourceAccountId: source,
      destinationAccountId: destination,
      amountMinor: 1000,
      feeMinor: 75,
      feeAccountId: source,
      occurredAt,
    },
  ],
  [
    {
      kind: 'reverseTransaction',
      transactionId: source,
      body: { expectedVersion: 2, occurredAt, reason: 'QA reversal' },
    },
    'ledger.transaction.reverse',
    201,
    { transactionId: source, expectedVersion: 2, occurredAt, reason: 'QA reversal' },
  ],
  [
    {
      kind: 'reviseTransaction',
      transactionId: source,
      body: { expectedVersion: 1, categoryId: category, reason: 'QA category change' },
    },
    'ledger.transaction.revise',
    200,
    {
      transactionId: source,
      expectedVersion: 1,
      patch: { categoryId: category },
      reason: 'QA category change',
    },
  ],
];

describe('setup-only ledger command contract', () => {
  it.each(cases)(
    'uses the canonical command and idempotency scope for %j',
    (input, scope, status, command) => {
      const prepared = normalizeQaSetupOperation(input);
      expect(prepared).toMatchObject({ operation: input.kind, scope, status, command });
      expect(prepared.command).not.toHaveProperty('id');
      expect(prepared.command).not.toHaveProperty('userId');
    },
  );

  it.each(['userId', 'id', 'trackingCaptureId'])(
    'rejects an unapproved financial identity field %s',
    (field) => {
      const input = createInput;
      const body = { ...(input.body as Record<string, unknown>), [field]: source };
      expect(() => normalizeQaSetupOperation({ ...input, body })).toThrow();
    },
  );

  it('rejects unsupported operations without constructing a public mutation', () => {
    expect(() =>
      normalizeQaSetupOperation({
        kind: 'deleteTransaction',
        body: { expectedVersion: 1 },
      } as unknown as QaSetupOperation),
    ).toThrow('QA_SETUP_OPERATION_INVALID');
  });
});
