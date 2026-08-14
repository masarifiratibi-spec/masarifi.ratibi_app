import {
  accountInputSchema,
  categoryInputSchema,
  emptyTransactionFilters,
  transactionInputSchema,
  type AccountInput,
  type CategoryInput,
  type HomeSummary,
  type SyncConflict,
  type TransactionDraft,
  type TransactionFilterSet,
  type TransactionInput
} from '@/domain/core-finance';
import type {
  CoreFinanceService,
  DeleteResult,
  MutationResult
} from '@/services/contracts/core-finance-service';
import {
  coreFinanceServiceCapability
} from '@/services/contracts/core-finance-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createMockExchangeRateService } from './exchange-rate-service';

const scopes = {
  account: (id: string) => [
    'home.summary',
    'accounts.list',
    `accounts.detail.${id}`,
    'transactions.list'
  ],
  transaction: (id: string) => [
    'home.summary',
    'accounts.list',
    'transactions.list',
    `transactions.detail.${id}`
  ],
  category: (id: string) => [
    'categories.list',
    `categories.detail.${id}`,
    'transactions.list',
    'home.summary'
  ]
};

const derivedScopes = ['reports.live', 'assistant.context'] as const;

export function createMockCoreFinanceService(
  repository = new CoreFinanceRepository(),
  persistent = false
): CapabilityProviderHandle<CoreFinanceService> {
  const rates = createMockExchangeRateService();
  let hydration: Promise<void> | null = null;
  const ensureReady = () => {
    if (!persistent) return Promise.resolve();
    hydration ??= repository.hydrate();
    return hydration;
  };
  const read = async <T>(query: () => T | Promise<T>): Promise<T> => {
    await ensureReady();
    return query();
  };
  const mutate = async <T>(
    command: () => T,
    persist: (record: T) => Promise<void>,
    affectedScopes: (record: T) => readonly string[]
  ): Promise<MutationResult<T>> => {
    await ensureReady();
    const record = command();
    if (persistent) await persist(record);
    return result(record, affectedScopes(record));
  };
  return {
    metadata: {
      id: 'mock-core-finance',
      capability: coreFinanceServiceCapability.capability,
      majorVersion: coreFinanceServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    async getHomeSummary(profileCurrency): Promise<HomeSummary> {
      await ensureReady();
      const accounts = repository.listAccounts();
      const components = [];
      const excludedAccountIds: string[] = [];
      let totalBalanceMinor = 0;
      for (const account of accounts) {
        const originalMinor = repository.accountBalance(account.id);
        const rate = await rates.getRate(profileCurrency, account.currencyCode);
        if (rate.rate === null || rate.asOf === null) {
          excludedAccountIds.push(account.id);
          continue;
        }
        const convertedMinor = Math.round(originalMinor * rate.rate);
        totalBalanceMinor += convertedMinor;
        components.push({
          accountId: account.id,
          originalMinor,
          currencyCode: account.currencyCode,
          convertedMinor,
          rate: rate.rate,
          asOf: rate.asOf
        });
      }
      const transactions = repository.allTransactions();
      const active = transactions.filter(
        (item) =>
          item.status === 'posted' ||
          item.status === 'refunded' ||
          item.status === 'reversed'
      );
      const periodIncomeMinor = active
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + item.amountMinor, 0);
      const periodExpenseMinor = active
        .filter((item) =>
          ['expense', 'obligation_payment', 'recurring_payment'].includes(
            item.type
          )
        )
        .reduce((sum, item) => sum + item.amountMinor, 0);
      return {
        totalBalanceMinor,
        currencyCode: profileCurrency,
        isEstimated:
          components.some((item) => item.currencyCode !== profileCurrency) ||
          excludedAccountIds.length > 0,
        components,
        excludedAccountIds,
        periodIncomeMinor,
        periodExpenseMinor,
        activeAccountCount: accounts.length,
        recentTransactions: repository.listTransactions(
          emptyTransactionFilters,
          null,
          5
        ).items,
        reviewCount: transactions.filter(
          (item) => item.reviewStatus === 'required'
        ).length,
        pendingSyncCount: transactions.filter(
          (item) =>
            item.syncStatus === 'pending' ||
            item.syncStatus === 'failed' ||
            item.syncStatus === 'conflict'
        ).length,
        dataState:
          accounts.length === 0 && transactions.length === 0
            ? 'empty'
            : excludedAccountIds.length
              ? 'partial'
              : 'ready'
      };
    },
    async listAccounts(includeArchived) {
      return read(() => repository.listAccounts(includeArchived));
    },
    async getAccount(id) {
      return read(() => repository.requireAccount(id));
    },
    async createAccount(input: AccountInput) {
      return mutate(
        () => repository.saveAccount(accountInputSchema.parse(input)),
        () => repository.persistAccounts(),
        (account) => scopes.account(account.id)
      );
    },
    async updateAccount(id, input: AccountInput) {
      return mutate(
        () => repository.saveAccount(accountInputSchema.parse(input), id),
        () => repository.persistAccounts(),
        () => scopes.account(id)
      );
    },
    async archiveAccount(id) {
      return mutate(
        () => repository.archiveAccount(id),
        () => repository.persistAccounts(),
        () => scopes.account(id)
      );
    },
    async restoreAccount(id) {
      return mutate(
        () => repository.restoreAccount(id),
        () => repository.persistAccounts(),
        () => scopes.account(id)
      );
    },
    async listCategories(includeArchived) {
      return read(() => repository.listCategories(includeArchived));
    },
    async createCategory(input: CategoryInput) {
      return mutate(
        () => repository.saveCategory(categoryInputSchema.parse(input)),
        (category) => repository.persistCategory(category),
        (category) => scopes.category(category.id)
      );
    },
    async updateCategory(id, input: CategoryInput) {
      return mutate(
        () =>
          repository.saveCategory(
            categoryInputSchema.parse({ ...input, id }),
            id
          ),
        (category) => repository.persistCategory(category),
        () => scopes.category(id)
      );
    },
    async setCategoryStatus(id, status) {
      return mutate(
        () => repository.setCategoryStatus(id, status),
        (category) => repository.persistCategory(category),
        () => scopes.category(id)
      );
    },
    async mergeCategory(sourceId, targetId) {
      await ensureReady();
      const value = repository.mergeCategory(sourceId, targetId);
      if (persistent) await repository.persistCategoryMerge();
      return result(value, [
        ...scopes.category(sourceId),
        ...scopes.category(targetId)
      ]);
    },
    async listTransactions(filters: TransactionFilterSet, cursor, pageSize) {
      return read(() => repository.listTransactions(filters, cursor, pageSize));
    },
    async getTransaction(id) {
      return read(() => repository.requireTransaction(id));
    },
    async createTransaction(input: TransactionInput, operationId, source) {
      return mutate(
        () =>
          repository.saveTransaction(
            transactionInputSchema.parse(input),
            undefined,
            operationId,
            source
          ),
        (transaction) => repository.persistTransaction(transaction, operationId),
        (transaction) => scopes.transaction(transaction.id)
      );
    },
    async createTransactionsAtomically(inputs, operationId, source) {
      await ensureReady();
      const value = await repository.saveTransactionsAtomically(
        inputs,
        operationId,
        source,
        persistent
      );
      return result(
        value,
        value.flatMap((transaction) => scopes.transaction(transaction.id))
      );
    },
    async updateTransaction(id, input: TransactionInput) {
      return mutate(
        () =>
          repository.saveTransaction(transactionInputSchema.parse(input), id),
        (transaction) => repository.persistTransaction(transaction),
        () => scopes.transaction(id)
      );
    },
    async saveDraft(draft: TransactionDraft) {
      await ensureReady();
      const savedDraft = repository.saveDraft(draft);
      if (persistent) await repository.persistDraft(savedDraft);
      return savedDraft;
    },
    async loadDraft(id) {
      return read(() => repository.loadDraft(id));
    },
    async discardDraft(id) {
      await ensureReady();
      repository.discardDraft(id);
      if (persistent) await repository.removePersistedDraft(id);
    },
    async deleteTransaction(id): Promise<DeleteResult> {
      await ensureReady();
      const value = repository.deleteTransaction(id);
      if (persistent) await repository.persistDelete(value);
      return {
        value,
        undoExpiresAt: value.undoExpiresAt!,
        affectedScopes: uniqueScopes(scopes.transaction(id))
      };
    },
    async undoDelete(id) {
      await ensureReady();
      const value = repository.undoDelete(id);
      if (persistent) await repository.persistUndo(value);
      return result(value, scopes.transaction(id));
    },
    async getConflict(id) {
      return read(() => repository.requireConflict(id));
    },
    async resolveConflict(
      id,
      resolution: NonNullable<SyncConflict['resolution']>
    ) {
      await ensureReady();
      const value = repository.resolveConflict(id, resolution);
      if (persistent) await repository.persistConflictResolution(id);
      return result(value, scopes.transaction(value.id));
    }
  };
}

export function createSeededCoreFinanceService() {
  return createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions
    }),
    process.env.NODE_ENV !== 'test'
  );
}

export const coreFinanceService = createSeededCoreFinanceService();

function result<T>(
  value: T,
  affectedScopes: readonly string[]
): MutationResult<T> {
  return { value, affectedScopes: uniqueScopes(affectedScopes) };
}

function uniqueScopes(affectedScopes: readonly string[]) {
  return [...new Set([...affectedScopes, ...derivedScopes])];
}
