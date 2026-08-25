import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { CoreFinanceRepository } from './core-finance-repository';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { emptyTransactionFilters, type TransactionInput } from '@/domain/core-finance';
import {
  createDefaultAccount,
  createDefaultCategories,
  createDemoAccounts,
  createDemoTransactions
} from '@/domain/core-finance-seeds';

const mockRunAsync = jest.fn(async (..._arguments: unknown[]) => ({}));
const mockExecAsync = jest.fn(async (..._arguments: unknown[]) => undefined);
const mockGetAllAsync = jest.fn(
  async (..._arguments: unknown[]) => [] as unknown[]
);
interface MockDatabase {
  runAsync: typeof mockRunAsync;
  execAsync: typeof mockExecAsync;
  getAllAsync: typeof mockGetAllAsync;
  withExclusiveTransactionAsync: jest.Mock<
    Promise<void>,
    [(transaction: MockDatabase) => Promise<void>]
  >;
}
const mockDatabase: MockDatabase = {
  runAsync: mockRunAsync,
  execAsync: mockExecAsync,
  getAllAsync: mockGetAllAsync,
  withExclusiveTransactionAsync: jest.fn(
    async (task: (transaction: MockDatabase) => Promise<void>) =>
      task(mockDatabase)
  )
};

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(
    async (
      database: MockDatabase,
      task: (transaction: MockDatabase) => Promise<void>
    ) => database.withExclusiveTransactionAsync(task)
  )
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('restores ledger, draft, conflict metadata, and undo state after restart', async () => {
  const deletedTransaction = {
    ...fixtureTransactions[0],
    status: 'deleted' as const,
    deletedAt: 1_000,
    undoExpiresAt: 31_000
  };
  const draft = {
    id: 'draft',
    transactionType: 'expense' as const,
    amountText: '25',
    accountId: 'account-bank',
    destinationAccountId: null,
    categoryId: 'food',
    merchant: null,
    notes: null,
    occurredAt: null,
    status: 'editing' as const,
    updatedAt: 1_000
  };
  mockGetAllAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const sql = arguments_[0] as string;
    if (sql.includes('finance_accounts'))
      return [{ payload: JSON.stringify(fixtureAccounts[0]) }];
    if (sql.includes('finance_categories'))
      return [{ payload: JSON.stringify(fixtureCategories[0]) }];
    if (sql.includes('finance_transactions'))
      return [{ payload: JSON.stringify(deletedTransaction) }];
    if (sql.includes('finance_drafts'))
      return [{ payload: JSON.stringify(draft) }];
    if (sql.includes('finance_corrections'))
      return [
        {
          transaction_id: deletedTransaction.id,
          payload: JSON.stringify({ priorStatus: 'posted' }),
          status: 'undoable'
        }
      ];
    return [];
  });

  const repository = new CoreFinanceRepository();
  await repository.hydrate();

  expect(repository.loadDraft('draft')).toEqual(draft);
  expect(repository.undoDelete(deletedTransaction.id, 30_000).status).toBe(
    'posted'
  );
});

it('seeds an empty database atomically with foreign-key-safe upserts', async () => {
  mockGetAllAsync.mockResolvedValue([]);
  const repository = new CoreFinanceRepository({
    accounts: fixtureAccounts.slice(0, 1),
    categories: fixtureCategories.slice(0, 1),
    transactions: fixtureTransactions.slice(0, 1)
  });

  await repository.hydrate();

  expect(mockDatabase.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockExecAsync).toHaveBeenCalledWith(
    expect.stringContaining('PRAGMA defer_foreign_keys = ON')
  );
  expect(mockRunAsync.mock.calls.map(([sql]) => sql).join('\n')).toContain(
    'ON CONFLICT(id) DO UPDATE'
  );
});

it('restores a seeded default account when an existing ledger has no accounts', async () => {
  const defaultAccount = createDefaultAccount(1_000);
  mockGetAllAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const sql = arguments_[0] as string;
    if (sql.includes('finance_categories'))
      return [{ payload: JSON.stringify(fixtureCategories[0]) }];
    return [];
  });
  const repository = new CoreFinanceRepository({
    accounts: [defaultAccount],
    categories: fixtureCategories.slice(0, 1)
  });

  await repository.hydrate();

  expect(repository.listAccounts()).toEqual([defaultAccount]);
  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO finance_accounts'),
    defaultAccount.id,
    expect.any(String),
    'active',
    1,
    defaultAccount.updatedAt
  );
});

it('can replace the empty default-account ledger with explicit demo data', async () => {
  const defaultAccount = createDefaultAccount(1_000);
  const demoAccounts = createDemoAccounts();
  const demoCategories = createDefaultCategories();
  const demoTransactions = createDemoTransactions();
  mockGetAllAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const sql = arguments_[0] as string;
    if (sql.includes('finance_accounts'))
      return [{ payload: JSON.stringify(defaultAccount) }];
    if (sql.includes('finance_categories'))
      return demoCategories.map((item) => ({ payload: JSON.stringify(item) }));
    return [];
  });

  const repository = new CoreFinanceRepository({
    accounts: demoAccounts,
    categories: demoCategories,
    transactions: demoTransactions,
    replaceEmptyDefaultLedger: true
  });

  await repository.hydrate();

  expect(repository.listAccounts()).toEqual(demoAccounts);
  expect(repository.allTransactions()).toEqual(demoTransactions);
});

it('removes only unchanged legacy fixture ledger records during explicit persistent cleanup', async () => {
  const modifiedAccount = { ...fixtureAccounts[0], name: 'Renamed account' };
  const unrelatedAccount = { ...fixtureAccounts[1], id: 'account-user' };
  const modifiedTransaction = {
    ...fixtureTransactions[0],
    title: 'Edited fixture transaction'
  };
  const unrelatedTransaction = {
    ...makeTransaction(999),
    id: 'transaction-user'
  };
  const persisted = {
    accounts: [fixtureAccounts[3], modifiedAccount, unrelatedAccount],
    categories: fixtureCategories,
    transactions: [fixtureTransactions[1], modifiedTransaction, unrelatedTransaction]
  };
  mockGetAllAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const sql = arguments_[0] as string;
    if (sql.includes('finance_accounts'))
      return persisted.accounts.map((item) => ({ payload: JSON.stringify(item) }));
    if (sql.includes('finance_categories'))
      return persisted.categories.map((item) => ({ payload: JSON.stringify(item) }));
    if (sql.includes('finance_transactions'))
      return persisted.transactions.map((item) => ({ payload: JSON.stringify(item) }));
    return [];
  });
  mockRunAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const [sql, id] = arguments_ as [string, string];
    if (sql.includes('DELETE FROM finance_transactions'))
      persisted.transactions = persisted.transactions.filter((item) => item.id !== id);
    if (sql.includes('DELETE FROM finance_accounts'))
      persisted.accounts = persisted.accounts.filter((item) => item.id !== id);
    return {};
  });

  const repository = new CoreFinanceRepository({ cleanupLegacyFixtures: true });
  await repository.hydrate();

  expect(repository.listAccounts(true)).toEqual([modifiedAccount, unrelatedAccount]);
  expect(repository.allTransactions()).toEqual([
    modifiedTransaction,
    unrelatedTransaction
  ]);
  expect(repository.listCategories()).toEqual(fixtureCategories);

  const deletesAfterFirstCleanup = mockRunAsync.mock.calls.filter(([sql]) =>
    (sql as string).startsWith('DELETE FROM')
  );
  await new CoreFinanceRepository({ cleanupLegacyFixtures: true }).hydrate();
  expect(mockRunAsync.mock.calls.filter(([sql]) => (sql as string).startsWith('DELETE FROM'))).toEqual(
    deletesAfterFirstCleanup
  );
});

it('replays a durable create operation after restart without creating another transaction', async () => {
  const created = makeTransaction(900, { id: 'transaction-created-by-op' });
  mockGetAllAsync.mockImplementation(async (...arguments_: unknown[]) => {
    const sql = arguments_[0] as string;
    if (sql.includes('finance_accounts')) return [{ payload: JSON.stringify(fixtureAccounts[0]) }];
    if (sql.includes('finance_categories')) return [{ payload: JSON.stringify(fixtureCategories[0]) }];
    if (sql.includes('finance_transactions')) return [{ payload: JSON.stringify(created) }];
    if (sql.includes('finance_operations'))
      return [
        {
          operation_id: 'op-create-durable',
          payload: JSON.stringify(created),
          status: 'succeeded'
        }
      ];
    return [];
  });

  const repository = new CoreFinanceRepository();
  await repository.hydrate();
  const replay = repository.saveTransaction(toInput(created), undefined, 'op-create-durable');

  expect(replay).toEqual(created);
  expect(repository.allTransactions()).toHaveLength(1);
});

it('handles concurrent same-operation creates with one owner effect', async () => {
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts.slice(0, 1),
      categories: fixtureCategories,
      transactions: []
    })
  );
  const input = toInput(makeTransaction(902));

  const [first, second] = await Promise.all([
    service.createTransaction(input, 'op-create-concurrent'),
    service.createTransaction(input, 'op-create-concurrent')
  ]);

  expect(first.value).toEqual(second.value);
  const page = await service.listTransactions(emptyTransactionFilters, null, 10);
  expect(page.items).toHaveLength(1);
});

function toInput(transaction: ReturnType<typeof makeTransaction>): TransactionInput {
  return {
    accountId: transaction.accountId,
    amountMinor: transaction.amountMinor,
    categoryId: transaction.categoryId,
    currencyCode: transaction.currencyCode,
    destinationAccountId: transaction.destinationAccountId,
    feeMinor: transaction.feeMinor,
    merchant: transaction.merchant,
    notes: transaction.notes,
    occurredAt: transaction.occurredAt,
    title: transaction.title,
    type: transaction.type
  };
}
