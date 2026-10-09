import { openDatabase } from './database';
import { CoreFinanceRepository } from './core-finance-repository';
import { draftInputSchema } from '@/domain/core-finance';

jest.mock('./database', () => ({
  openDatabase: jest.fn(),
  runExclusiveDatabaseTransaction: async (
    db: { execAsync: (sql: string) => Promise<void> },
    work: (db: unknown) => Promise<void>
  ) => {
    await db.execAsync('BEGIN');
    try {
      await work(db);
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
}));
const { DatabaseSync } = jest.requireActual('node:sqlite');

it('rejects replacing an unresolved submission with another operation', () => {
  const repository = new CoreFinanceRepository();
  const first = draftInputSchema.parse({
    id: 'manual-entry',
    transactionType: 'expense',
    amountText: '50',
    accountId: 'account',
    categoryId: 'food',
    destinationAccountId: null,
    merchant: null,
    notes: null,
    occurredAt: Date.now(),
    status: 'editing',
    updatedAt: Date.now(),
    submission: {
      version: 1,
      operationId: '90000000-0000-4000-8000-000000000098',
      input: {
        type: 'expense',
        amountMinor: 5000,
        currencyCode: 'SAR',
        accountId: 'account',
        categoryId: 'food',
        title: 'Food',
        occurredAt: Date.now()
      },
      firstAttemptAt: Date.now(),
      phase: 'unknown'
    }
  });
  repository.saveDraft(first);
  expect(() =>
    repository.saveDraft({
      ...first,
      submission: {
        ...first.submission!,
        operationId: '90000000-0000-4000-8000-000000000099'
      }
    })
  ).toThrow();
  expect(repository.loadDraft(first.id)?.submission?.operationId).toBe(
    '90000000-0000-4000-8000-000000000098'
  );
});

it('restores the frozen manual operation from SQLite after restart and ignores a late editing save', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of [
      'accounts',
      'transactions',
      'sync_conflicts',
      'corrections',
      'operations'
    ])
      db.exec(
        `CREATE TABLE finance_${name}(payload TEXT,transaction_id TEXT,operation_id TEXT,status TEXT)`
      );
    db.exec(
      'CREATE TABLE finance_drafts(id TEXT PRIMARY KEY,payload TEXT,status TEXT,updated_at INTEGER)'
    );
    db.exec(
      'CREATE TABLE finance_categories(id TEXT PRIMARY KEY,payload TEXT,parent_id TEXT,status TEXT,merged_into_id TEXT,updated_at INTEGER)'
    );
    jest.mocked(openDatabase).mockResolvedValue({
      getAllAsync: async (sql: string) => db.prepare(sql).all(),
      runAsync: async (sql: string, ...args: unknown[]) =>
        db.prepare(sql).run(...args),
      execAsync: async (sql: string) => {
        db.exec(sql);
      }
    } as never);
    const draft = {
      id: 'manual-entry',
      transactionType: 'expense' as const,
      amountText: '50',
      accountId: 'account',
      destinationAccountId: null,
      categoryId: 'food',
      merchant: null,
      notes: null,
      occurredAt: Date.now(),
      status: 'editing' as const,
      updatedAt: Date.now(),
      submission: {
        version: 1 as const,
        operationId: '90000000-0000-4000-8000-000000000099',
        input: {
          type: 'expense' as const,
          amountMinor: 5000,
          currencyCode: 'SAR',
          accountId: 'account',
          categoryId: 'food',
          title: 'Food',
          occurredAt: Date.now(),
          destinationAccountId: null,
          transferPurpose: null,
          feeMinor: 0,
          merchant: null,
          notes: null,
          originalTransactionId: null,
          obligationId: null
        },
        firstAttemptAt: Date.now(),
        phase: 'unknown' as const
      }
    };
    const first = new CoreFinanceRepository();
    await first.persistDraft(first.saveDraft(draftInputSchema.parse(draft)));
    const restored = new CoreFinanceRepository();
    await restored.hydrate();
    const saved = restored.loadDraft(draft.id)!;
    expect(saved.submission).toEqual(draft.submission);
    const { submission: _submission, ...editing } = saved;
    await restored.persistDraft(
      restored.saveDraft({ ...editing, amountText: '999' })
    );
    const restartedAgain = new CoreFinanceRepository();
    await restartedAgain.hydrate();
    expect(restartedAgain.loadDraft(draft.id)?.submission).toEqual(
      draft.submission
    );
    expect(restartedAgain.loadDraft(draft.id)?.amountText).toBe('50');
  } finally {
    db.close();
  }
});
