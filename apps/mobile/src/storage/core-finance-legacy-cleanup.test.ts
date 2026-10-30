import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { CoreFinanceRepository } from './core-finance-repository';
import {
  TRANSACTION_EDIT_JOURNAL_PREFIX,
  writeTransactionEditJournal,
  deleteTransactionEditJournal,
  readTransactionEditJournal
} from './transaction-edit-journal';
import { transactionInputSchema } from '@/domain/core-finance';

type NativeSqlite = {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: unknown[]): unknown[];
    run(...values: unknown[]): { changes: number | bigint };
  };
};

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => NativeSqlite;
};

class ForeignKeySqlite {
  private readonly database = new DatabaseSync(':memory:');

  constructor() {
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE finance_accounts (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        status TEXT,
        is_default INTEGER,
        updated_at INTEGER
      );
      CREATE TABLE finance_categories (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        parent_id TEXT,
        status TEXT,
        merged_into_id TEXT,
        updated_at INTEGER
      );
      CREATE TABLE finance_transactions (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES finance_accounts(id),
        destination_account_id TEXT REFERENCES finance_accounts(id),
        category_id TEXT REFERENCES finance_categories(id),
        occurred_at INTEGER,
        type TEXT,
        source TEXT,
        status TEXT,
        sync_status TEXT,
        review_status TEXT,
        normalized_title TEXT,
        amount_minor INTEGER,
        updated_at INTEGER
      );
      CREATE TABLE finance_drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT, updated_at INTEGER);
      CREATE TABLE sync_mutation_queue (operation_id TEXT PRIMARY KEY, domain TEXT, resource_type TEXT, resource_id TEXT, status TEXT);
      CREATE TABLE finance_sync_conflicts (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id),
        payload TEXT NOT NULL
      );
      CREATE TABLE finance_corrections (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id),
        payload TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE finance_operations (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id),
        payload TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE planning_salary_receipts (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id)
      );
      CREATE TABLE planning_obligation_payments (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id)
      );
      CREATE TABLE planning_goal_movements (
        id TEXT PRIMARY KEY,
        linked_transaction_id TEXT REFERENCES finance_transactions(id)
      );
      CREATE TABLE tracking_feedback (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES finance_transactions(id)
      );
    `);
  }

  async getAllAsync<T>(sql: string, ...values: unknown[]): Promise<T[]> {
    return this.database.prepare(sql).all(...values) as T[];
  }

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getFirstAsync<T>(sql: string, ...values: unknown[]): Promise<T | null> {
    return (this.database.prepare(sql).all(...values)[0] as T) ?? null;
  }

  async runAsync(
    sql: string,
    ...values: unknown[]
  ): Promise<{ changes: number }> {
    const result = this.database.prepare(sql).run(...values);
    return { changes: Number(result.changes) };
  }

  async withExclusiveTransactionAsync(
    operation: (database: this) => Promise<void>
  ) {
    this.database.exec('BEGIN');
    try {
      await operation(this);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

let mockDatabase: ForeignKeySqlite;

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(
    async (
      sqlite: ForeignKeySqlite,
      operation: (transaction: ForeignKeySqlite) => Promise<void>
    ) => sqlite.withExclusiveTransactionAsync(operation)
  )
}));

beforeEach(async () => {
  mockDatabase = new ForeignKeySqlite();
  await mockDatabase.runAsync(
    'INSERT INTO finance_accounts (id, payload) VALUES (?, ?)',
    fixtureAccounts[0].id,
    JSON.stringify(fixtureAccounts[0])
  );
  await mockDatabase.runAsync(
    'INSERT INTO finance_categories (id, payload) VALUES (?, ?)',
    fixtureTransactions[0].categoryId,
    JSON.stringify(
      fixtureCategories.find(
        (category) => category.id === fixtureTransactions[0].categoryId
      )
    )
  );
  await mockDatabase.runAsync(
    'INSERT INTO finance_transactions (id, payload, account_id, category_id) VALUES (?, ?, ?, ?)',
    fixtureTransactions[0].id,
    JSON.stringify(fixtureTransactions[0]),
    fixtureTransactions[0].accountId,
    fixtureTransactions[0].categoryId
  );
});

afterEach(() => mockDatabase.close());

test.each([
  [
    'finance correction',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO finance_corrections (id, transaction_id, payload, status) VALUES (?, ?, ?, ?)',
        'correction-legacy',
        fixtureTransactions[0].id,
        JSON.stringify({ priorStatus: 'posted' }),
        'undoable'
      )
  ],
  [
    'finance operation',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO finance_operations (id, operation_id, transaction_id, payload, status) VALUES (?, ?, ?, ?, ?)',
        'operation-legacy',
        'operation-legacy',
        fixtureTransactions[0].id,
        JSON.stringify(fixtureTransactions[0]),
        'succeeded'
      )
  ],
  [
    'sync conflict',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO finance_sync_conflicts (id, transaction_id, payload) VALUES (?, ?, ?)',
        'conflict-legacy',
        fixtureTransactions[0].id,
        JSON.stringify({})
      )
  ],
  [
    'salary receipt',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO planning_salary_receipts (id, transaction_id) VALUES (?, ?)',
        'salary-legacy',
        fixtureTransactions[0].id
      )
  ],
  [
    'obligation payment',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO planning_obligation_payments (id, transaction_id) VALUES (?, ?)',
        'payment-legacy',
        fixtureTransactions[0].id
      )
  ],
  [
    'goal movement',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO planning_goal_movements (id, linked_transaction_id) VALUES (?, ?)',
        'movement-legacy',
        fixtureTransactions[0].id
      )
  ],
  [
    'tracking feedback',
    () =>
      mockDatabase.runAsync(
        'INSERT INTO tracking_feedback (id, transaction_id) VALUES (?, ?)',
        'feedback-legacy',
        fixtureTransactions[0].id
      )
  ]
])(
  'retains an exact fixture transaction referenced by a persisted %s',
  async (_name, seedDependency) => {
    await seedDependency();

    const repository = new CoreFinanceRepository({
      cleanupLegacyFixtures: true
    });
    await repository.hydrate();

    expect(repository.requireTransaction(fixtureTransactions[0].id)).toEqual(
      fixtureTransactions[0]
    );
    expect(repository.requireAccount(fixtureAccounts[0].id)).toEqual(
      fixtureAccounts[0]
    );
  }
);

it('preserves edit journals through ordinary hydration, replacement, save and discard', async () => {
  const owner = {
    userId: 'fixture-owner',
    assertCurrent: async () => undefined
  };
  const journal = {
    version: 1 as const,
    resourceId: '74000000-0000-4000-8000-000000000003',
    operationId: '74000000-0000-4000-8000-000000000004',
    input: transactionInputSchema.parse(fixtureTransactions[0]),
    body: {
      expectedVersion: 1,
      reason: 'Mobile edit' as const,
      note: 'Frozen wire note'
    }
  };
  await writeTransactionEditJournal(owner, journal);
  const repository = new CoreFinanceRepository();
  await repository.hydrate();
  const draft = {
    id: 'ordinary-draft',
    transactionType: 'expense' as const,
    amountText: '5',
    accountId: null,
    destinationAccountId: null,
    categoryId: null,
    merchant: null,
    notes: null,
    occurredAt: null,
    status: 'editing' as const,
    updatedAt: 1
  };
  repository.saveDraft(draft);
  await repository.persistDraft(draft);
  await repository.persistAll();
  expect(repository.loadDraft(draft.id)?.amountText).toBe('5');
  expect(await readTransactionEditJournal(owner, journal.resourceId)).toEqual(
    journal
  );
  const reservedId = TRANSACTION_EDIT_JOURNAL_PREFIX + journal.resourceId;
  expect(() => repository.saveDraft({ ...draft, id: reservedId })).toThrow();
  expect(() => repository.discardDraft(reservedId)).toThrow();
  await expect(
    repository.persistDraft({ ...draft, id: reservedId })
  ).rejects.toThrow();
  await expect(repository.removePersistedDraft(reservedId)).rejects.toThrow();
  repository.discardDraft(draft.id);
  await repository.removePersistedDraft(draft.id);
  expect(await readTransactionEditJournal(owner, journal.resourceId)).toEqual(
    journal
  );
});
it.each(['write', 'delete'] as const)(
  'rolls back journal %s when its initiating owner changes before commit',
  async (operation) => {
    let current = true;
    const owner = {
      userId: 'owner-a',
      assertCurrent: async () => {
        if (!current) throw new Error('owner changed');
      }
    };
    const journal = {
      version: 1 as const,
      resourceId: '74000000-0000-4000-8000-000000000003',
      operationId: '74000000-0000-4000-8000-000000000004',
      input: transactionInputSchema.parse(fixtureTransactions[0]),
      body: {
        expectedVersion: 1,
        reason: 'Mobile edit' as const,
        note: 'Frozen note'
      }
    };
    if (operation === 'delete')
      await writeTransactionEditJournal(owner, journal);
    const originalRun = mockDatabase.runAsync.bind(mockDatabase);
    const run = jest
      .spyOn(mockDatabase, 'runAsync')
      .mockImplementation(async (sql, ...args) => {
        const receipt = await originalRun(sql, ...args);
        if (
          sql.startsWith(
            operation === 'write'
              ? 'INSERT INTO finance_drafts'
              : 'DELETE FROM finance_drafts'
          )
        )
          current = false;
        return receipt;
      });
    try {
      await expect(
        operation === 'write'
          ? writeTransactionEditJournal(owner, journal)
          : deleteTransactionEditJournal(owner, journal)
      ).rejects.toThrow('owner changed');
      current = true;
      expect(
        await readTransactionEditJournal(owner, journal.resourceId)
      ).toEqual(operation === 'write' ? null : journal);
    } finally {
      run.mockRestore();
    }
  }
);
