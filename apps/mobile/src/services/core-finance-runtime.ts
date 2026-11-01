import { randomUUID } from 'expo-crypto';
import { assertBenchmarkRead } from '@/config/client-runtime';
import {
  accountInputSchema,
  categoryInputSchema,
  emptyTransactionFilters,
  matchesFilters,
  projectTransactionEffects,
  projectTransactionEffect,
  safeMinorSum,
  transactionInputSchema,
  type AccountInput,
  type CategoryInput,
  type HomeSummary,
  type SyncConflict,
  type Transaction,
  type TransactionDraft,
  type TransactionFilterSet,
  type TransactionInput
} from '@/domain/core-finance';
import type {
  CoreFinanceService,
  CardPayoffInput,
  CategoryUsagePreview,
  DeleteResult,
  MutationResult
} from '@/services/contracts/core-finance-service';
import {
  CoreFinanceError,
  coreFinanceServiceCapability
} from '@/services/contracts/core-finance-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  registerRuntimeUserDataReset,
  registerRuntimeIdentityReset
} from '@/storage/runtime-user-data-reset';
import { SharedReadPool } from '@/services/live/shared-read';
import {
  assertReadActive,
  withReadContext,
  type ReadContext
} from '@/services/live/read-context';
import { createLocalExchangeRateService } from './local-exchange-rate-service';
import type { ExchangeRateService } from '@/services/contracts/core-finance-service';
import { createLiveAccountService } from '@/services/live/account-service';
import { createLiveCategoryLifecycleService } from '@/services/live/category-lifecycle-service';
import { captureLiveClerkOwner } from '@/services/live/auth-service';
import { HttpError } from '@/services/live/http-client';
import { calculateCreditCardPayoff } from '@/domain/credit-card-payoff';
import { createLiveLedgerService } from '@/services/live/core-finance-service';
import { ZodError } from 'zod';
import { readHomeTodayActivity } from '@/services/home-today-activity';
import { useAppShellStore } from '@/state/app-shell';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import type { DraftOwner } from '@/storage/transaction-draft-snapshots';
import { withTransactionDraftWrite } from '@/storage/transaction-draft-snapshots';
import type { TransactionEditGuard } from '@/storage/transaction-edit-journal';

const scopes = {
  account: (id: string) => [
    'home.summary',
    'accounts.list',
    'accounts.balances',
    `accounts.detail.${id}`,
    'transactions.list'
  ],
  transaction: (id: string) => [
    'home.summary',
    'accounts.list',
    'accounts.balances',
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

export function createLocalCoreFinanceService(
  repository = new CoreFinanceRepository(),
  {
    persistent = false,
    registerForReset = false,
    rates = createLocalExchangeRateService()
  }: {
    persistent?: boolean;
    registerForReset?: boolean;
    rates?: ExchangeRateService;
  } = {}
): CapabilityProviderHandle<CoreFinanceService> {
  let hydration: Promise<void> | null = null;
  const ensureReady = () => {
    if (!persistent) return Promise.resolve();
    hydration ??= repository.hydrate();
    return hydration;
  };
  const assertCategoryUsage = async (
    id: string,
    preview?: CategoryUsagePreview
  ) => {
    if (!preview) return;
    await ensureReady();
    const category = repository
      .listCategories(true)
      .find((item) => item.id === id && item.kind === 'custom');
    if (
      !category ||
      category.updatedAt !== preview.version ||
      repository.countTransactionsForCategory(id) !==
        preview.linkedTransactionCount
    )
      throw new CoreFinanceError('conflict');
  };
  if (registerForReset)
    registerRuntimeUserDataReset(() => {
      repository.reset();
      hydration = null;
    });
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
    async getHomeTodayActivity(filters, signal) {
      await ensureReady();
      return readHomeTodayActivity({
        filters,
        signal,
        listTransactions: async (dayFilters, cursor, size) =>
          repository.listTransactions(dayFilters, cursor, size),
        readSignedEffect: async (transaction) => {
          const original = transaction.originalTransactionId
            ? repository.requireTransaction(transaction.originalTransactionId)
            : null;
          if (original?.type === 'transfer') return null;
          const committedOriginal =
            original &&
            ['posted', 'refunded', 'reversed'].includes(original.status)
              ? { ...original, status: 'posted' as const }
              : original;
          return projectTransactionEffect(
            { ...transaction, status: 'posted' },
            transaction.accountId,
            committedOriginal
          ).confirmed.accountDeltaMinor;
        }
      });
    },
    async getHomeSummary(
      profileCurrency,
      filters = emptyTransactionFilters
    ): Promise<HomeSummary> {
      await ensureReady();
      const accounts = repository
        .listAccounts()
        .filter(
          (account) =>
            !filters.accountIds.length ||
            filters.accountIds.includes(account.id)
        );
      const components = [];
      const excludedAccountIds: string[] = [];
      let totalBalanceMinor = 0;
      for (const account of accounts) {
        const originalMinor = repository.accountBalance(account.id);
        const rate = await rates.getRate(account.currencyCode, profileCurrency);
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
      const periodTransactions = transactions.filter((transaction) =>
        matchesFilters(transaction, filters)
      );
      const comparableTransactions = periodTransactions.filter(
        (transaction) => transaction.currencyCode === profileCurrency
      );
      const projections = projectTransactionEffects(transactions, null);
      const periodTotals = comparableTransactions.reduce(
        (totals, transaction) => {
          const confirmed = projections.get(transaction.id)!.confirmed;
          return {
            incomeMinor: totals.incomeMinor + confirmed.incomeMinor,
            expenseMinor: totals.expenseMinor + confirmed.expenseMinor
          };
        },
        { incomeMinor: 0, expenseMinor: 0 }
      );
      return {
        totalBalanceMinor,
        currencyCode: profileCurrency,
        isEstimated:
          components.some((item) => item.currencyCode !== profileCurrency) ||
          excludedAccountIds.length > 0 ||
          comparableTransactions.length !== periodTransactions.length,
        components,
        excludedAccountIds,
        periodIncomeMinor: periodTotals.incomeMinor,
        periodExpenseMinor: periodTotals.expenseMinor,
        activeAccountCount: accounts.length,
        recentTransactions: selectHomeTransactions(
          repository.listTransactions(filters, null, periodTransactions.length)
            .items
        ),
        reviewCount: periodTransactions.filter(
          (item) => item.reviewStatus === 'required'
        ).length,
        pendingSyncCount: periodTransactions.filter(
          (item) =>
            item.syncStatus === 'pending' ||
            item.syncStatus === 'failed' ||
            item.syncStatus === 'conflict'
        ).length,
        dataState:
          accounts.length === 0 && transactions.length === 0
            ? 'empty'
            : excludedAccountIds.length ||
                comparableTransactions.length !== periodTransactions.length
              ? 'partial'
              : 'ready'
      };
    },
    async listAccounts(includeArchived) {
      return read(() => repository.listAccounts(includeArchived));
    },
    async listAccountBalances(includeArchived, _context, accountIds) {
      return read(() =>
        repository
          .listAccounts(includeArchived)
          .filter((account) => !accountIds || accountIds.includes(account.id))
          .map((account) => ({
            accountId: account.id,
            balanceMinor: repository.accountBalance(account.id),
            currencyCode: account.currencyCode
          }))
      );
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
        () => repository.saveAccount(input, id),
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
    async calculateCreditCardPayoff(
      input: Parameters<typeof calculateCreditCardPayoff>[0]
    ) {
      return calculateCreditCardPayoff(input);
    },
    async listCategories(includeArchived) {
      return read(() => repository.listCategories(includeArchived));
    },
    async getCategoryUsage(id) {
      await ensureReady();
      const category = repository
        .listCategories(true)
        .find((item) => item.id === id && item.kind === 'custom');
      if (!category || category.status === 'merged')
        throw new CoreFinanceError('not_found');
      return {
        linkedTransactionCount: repository.countTransactionsForCategory(id),
        version: category.updatedAt
      };
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
    async setCategoryStatus(id, status, preview?: CategoryUsagePreview) {
      await assertCategoryUsage(id, preview);
      return mutate(
        () => repository.setCategoryStatus(id, status),
        (category) => repository.persistCategory(category),
        () => scopes.category(id)
      );
    },
    async mergeCategory(sourceId, targetId, preview?: CategoryUsagePreview) {
      await ensureReady();
      await assertCategoryUsage(sourceId, preview);
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
    async getRemainingRefundableMinor(originalTransactionId, excludedRefundId) {
      return read(() =>
        repository.getRemainingRefundableMinor(
          originalTransactionId,
          excludedRefundId
        )
      );
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
        (transaction) =>
          repository.persistTransaction(transaction, operationId),
        (transaction) => scopes.transaction(transaction.id)
      );
    },
    async createCardPayoff(input: CardPayoffInput, operationId) {
      return mutate(
        () => repository.createCardPayoff(input, operationId),
        (transaction) =>
          repository.persistTransaction(transaction, operationId),
        (transaction) => [
          ...scopes.transaction(transaction.id),
          ...scopes.account(transaction.accountId),
          ...scopes.account(transaction.destinationAccountId!)
        ]
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

export function createLiveCoreFinanceService(
  options: Parameters<typeof createLiveAccountService>[0] = {}
): CapabilityProviderHandle<CoreFinanceService> {
  const available = Boolean(options.baseUrl ?? process.env.EXPO_PUBLIC_API_URL);
  const localOwners = new Map<
    string,
    {
      repository: CoreFinanceRepository;
      service: CoreFinanceService;
      ready: Promise<void>;
    }
  >();
  registerRuntimeIdentityReset(() => localOwners.clear());
  const localMethods = new Set([
    'getHomeSummary',
    'getHomeTodayActivity',
    'listAccounts',
    'listAccountBalances',
    'getAccount',
    'listCategories',
    'getCategoryUsage',
    'listTransactions',
    'getTransaction',
    'getRemainingRefundableMinor',
    'calculateCreditCardPayoff',
    'saveDraft',
    'loadDraft',
    'discardDraft'
  ]);
  const queuedReadMethods = new Set([
    'getTransaction',
    'listTransactions',
    'getHomeSummary',
    'getHomeTodayActivity',
    'listAccountBalances'
  ]);
  const localCall = async (
    property: PropertyKey,
    args: unknown[],
    owner: DraftOwner,
    assertSafe: TransactionEditGuard = owner.assertCurrent
  ) => {
    let local = localOwners.get(owner.userId);
    if (!local) {
      const repository = new CoreFinanceRepository();
      repository.bindOwner(owner.userId);
      local = {
        repository,
        service: createLocalCoreFinanceService(repository),
        ready: repository.hydrate()
      };
      localOwners.set(owner.userId, local);
    }
    try {
      await local.ready;
    } catch (error) {
      if (localOwners.get(owner.userId) === local)
        localOwners.delete(owner.userId);
      throw error;
    }
    await owner.assertCurrent();
    await local.repository.hydrate({ preserveDrafts: true });
    await owner.assertCurrent();
    let value: unknown;
    if (property === 'createTransaction') {
      const transaction = await local.repository.queueTransactionCreate(
        args[0] as TransactionInput,
        (args[1] as string | undefined) ?? randomUUID(),
        (args[2] as Transaction['source'] | undefined) ?? 'manual',
        assertSafe
      );
      value = result(transaction, scopes.transaction(transaction.id));
    } else if (property === 'updateTransaction') {
      const transaction = await local.repository.queueTransactionEdit(
        args[0] as string,
        args[1] as TransactionInput,
        randomUUID(),
        assertSafe
      );
      value = result(transaction, scopes.transaction(transaction.id));
    } else if (typeof property === 'string' && localMethods.has(property)) {
      // Reuse the local repository behavior without demo seeds or fabricated exchange rates.
      if (property === 'saveDraft') {
        value = local.repository.saveDraft(args[0] as TransactionDraft);
        await local.repository.persistDraft(value as TransactionDraft);
      } else if (property === 'discardDraft') {
        local.repository.discardDraft(args[0] as string);
        await local.repository.removePersistedDraft(args[0] as string);
      } else {
        value = await Reflect.apply(
          Reflect.get(local.service, property),
          local.service,
          args
        );
      }
    } else throw new CoreFinanceError('offline');
    await owner.assertCurrent();
    return value;
  };
  const accounts = createLiveAccountService(options);
  const categories = createLiveCategoryLifecycleService(options);
  const sharedReads = new SharedReadPool();
  registerRuntimeIdentityReset(() => sharedReads.clear());
  registerRuntimeUserDataReset(() => sharedReads.clear());
  const share = <T>(
    key: string,
    context: ReadContext | undefined,
    action: (signal: AbortSignal) => Promise<T>
  ) =>
    withReadContext(context, async (signal) => {
      const owner = await captureLiveClerkOwner();
      assertReadActive(signal);
      const value = await sharedReads.read(
        owner.userId + ':' + key,
        signal,
        action
      );
      await owner.assertCurrent();
      assertReadActive(signal);
      return value;
    });
  const readBalance = (
    account: { id: string; currencyCode: string },
    context?: ReadContext
  ) =>
    share(
      'balance:' + account.id + ':' + account.currencyCode,
      context,
      (signal) =>
        accounts.getAccountBalance(account.id, account.currencyCode, { signal })
    );

  const pending = new Map<
    string,
    {
      operationId: string;
      expectedVersion?: number;
      linkedTransactionCount?: number;
    }
  >();
  const mutate = async <T>(
    key: string,
    prepare: () =>
      | Promise<{ expectedVersion?: number; linkedTransactionCount?: number }>
      | { expectedVersion?: number; linkedTransactionCount?: number },
    command: (state: {
      operationId: string;
      expectedVersion?: number;
      linkedTransactionCount?: number;
    }) => Promise<T>
  ): Promise<T> => {
    let state = pending.get(key);
    if (!state) {
      state = { operationId: randomUUID(), ...(await prepare()) };
      if (pending.size >= 256) pending.delete(pending.keys().next().value!);
      pending.set(key, state);
    }
    try {
      const value = await command(state);
      pending.delete(key);
      return value;
    } catch (error) {
      if (
        !(error instanceof HttpError) ||
        ![
          'provider_unavailable',
          'internal_error',
          'contract_mismatch'
        ].includes(error.code)
      )
        pending.delete(key);
      throw error;
    }
  };
  const target = {
    metadata: {
      id: available ? 'phase04-core-finance-http' : 'unavailable-core-finance',
      capability: coreFinanceServiceCapability.capability,
      majorVersion: coreFinanceServiceCapability.majorVersion,
      kind: 'live' as const,
      availability: available
        ? ('available' as const)
        : ('unavailable' as const)
    },
    async listAccounts(includeArchived = false, context?: ReadContext) {
      const values = await share(
        'accounts:' + includeArchived,
        context,
        (signal) => accounts.listAccounts(includeArchived, { signal })
      );
      return values.map((account) => ({ ...account, openingBalanceMinor: 0 }));
    },
    async listAccountBalances(
      includeArchived = false,
      context?: ReadContext,
      accountIds?: readonly string[]
    ) {
      const values = await target.listAccounts(includeArchived, context);
      return Promise.all(
        values
          .filter((account) => !accountIds || accountIds.includes(account.id))
          .map((account) => readBalance(account, context))
      );
    },
    async getAccount(id: string) {
      return { ...(await accounts.getAccount(id)), openingBalanceMinor: 0 };
    },
    async createAccount(input: AccountInput) {
      const parsed = accountInputSchema.parse(input);
      const value = await mutate(
        `account:create:${JSON.stringify(parsed)}`,
        () => ({}),
        ({ operationId }) => accounts.createAccount(parsed, operationId)
      );
      return result(
        { ...value, openingBalanceMinor: input.openingBalanceMinor },
        scopes.account(value.id)
      );
    },
    async updateAccount(id: string, input: AccountInput) {
      const parsed = accountInputSchema.parse(input);
      const value = await mutate(
        `account:update:${id}:${JSON.stringify(parsed)}`,
        async () => ({
          expectedVersion: (await accounts.getAccount(id)).version
        }),
        ({ operationId, expectedVersion }) =>
          accounts.updateAccount(id, parsed, expectedVersion!, operationId)
      );
      return result({ ...value, openingBalanceMinor: 0 }, scopes.account(id));
    },
    async archiveAccount(id: string) {
      await mutate(
        `account:archive:${id}`,
        async () => ({
          expectedVersion: (await accounts.getAccount(id)).version
        }),
        ({ operationId, expectedVersion }) =>
          accounts.archiveAccount(id, expectedVersion!, operationId)
      );
      const value = await accounts.getAccount(id);
      return result({ ...value, openingBalanceMinor: 0 }, scopes.account(id));
    },
    async restoreAccount(id: string) {
      const value = await mutate(
        `account:restore:${id}`,
        async () => ({
          expectedVersion: (await accounts.getAccount(id)).version
        }),
        ({ operationId, expectedVersion }) =>
          accounts.restoreAccount(id, expectedVersion!, operationId)
      );
      return result({ ...value, openingBalanceMinor: 0 }, scopes.account(id));
    },
    async calculateCreditCardPayoff(
      input: Parameters<typeof calculateCreditCardPayoff>[0]
    ) {
      const value = await accounts.calculateCreditCardPayoff({
        balanceMinor: Number(input.balanceMinor),
        monthlyInterestRateBasisPoints: Number(
          input.monthlyInterestRateBasisPoints
        ),
        paymentMinor: Number(input.paymentMinor)
      });
      return value.status === 'payoff'
        ? {
            ...value,
            totalInterestMinor: BigInt(value.totalInterestMinor),
            totalPaidMinor: BigInt(value.totalPaidMinor),
            finalPaymentMinor: BigInt(value.finalPaymentMinor)
          }
        : {
            ...value,
            monthlyInterestMinor: BigInt(value.monthlyInterestMinor)
          };
    },
    listCategories: (includeArchived?: boolean) =>
      categories.listCategories(includeArchived),
    async getCategoryUsage(id: string) {
      return categories.getCategoryUsage(id);
    },
    async createCategory(input: CategoryInput) {
      const parsed = categoryInputSchema.parse(input);
      const value = await mutate(
        `category:create:${JSON.stringify(parsed)}`,
        () => ({}),
        ({ operationId }) => categories.createCategory(parsed, operationId)
      );
      return result(value, scopes.category(value.id));
    },
    async updateCategory(id: string, input: CategoryInput) {
      const parsed = categoryInputSchema.parse(input);
      const value = await mutate(
        `category:update:${id}:${JSON.stringify(parsed)}`,
        async () => {
          const current = (await categories.listCategories(true)).find(
            (category) => category.id === id
          );
          if (!current) throw new CoreFinanceError('not_found');
          return { expectedVersion: current.version };
        },
        ({ operationId, expectedVersion }) =>
          categories.updateCategory(id, parsed, expectedVersion!, operationId)
      );
      return result(value, scopes.category(id));
    },
    async setCategoryStatus(
      id: string,
      status: 'active' | 'archived',
      preview?: CategoryUsagePreview
    ) {
      await mutate(
        `category:status:${id}:${status}`,
        async () => {
          const current = preview ?? (await categories.getCategoryUsage(id));
          return {
            expectedVersion: current.version,
            linkedTransactionCount: current.linkedTransactionCount
          };
        },
        ({ operationId, expectedVersion, linkedTransactionCount }) =>
          categories.setCategoryStatus(
            id,
            status,
            {
              version: expectedVersion!,
              linkedTransactionCount: linkedTransactionCount!
            },
            operationId
          )
      );
      const value = (await categories.listCategories(true)).find(
        (category) => category.id === id
      );
      if (!value) throw new CoreFinanceError('not_found');
      return result(value, scopes.category(id));
    },
    async mergeCategory(
      sourceId: string,
      targetId: string,
      preview?: CategoryUsagePreview
    ) {
      await mutate(
        `category:merge:${sourceId}:${targetId}`,
        async () => {
          const current =
            preview ?? (await categories.getCategoryUsage(sourceId));
          return {
            expectedVersion: current.version,
            linkedTransactionCount: current.linkedTransactionCount
          };
        },
        ({ operationId, expectedVersion, linkedTransactionCount }) =>
          categories.mergeCategory(
            sourceId,
            targetId,
            {
              version: expectedVersion!,
              linkedTransactionCount: linkedTransactionCount!
            },
            operationId
          )
      );
      const value = (await categories.listCategories(true)).find(
        (category) => category.id === sourceId
      );
      if (!value) throw new CoreFinanceError('not_found');
      return result(value, [
        ...scopes.category(sourceId),
        `categories.detail.${targetId}`
      ]);
    }
  };
  const ledger = createLiveLedgerService({
    ...options,
    offlineUpdate: async (id, input, owner, assertSafe) => {
      if (!(await confirmedOffline())) return null;
      await assertSafe();
      try {
        return (await localCall(
          'updateTransaction',
          [id, input],
          owner,
          assertSafe
        )) as MutationResult<Transaction>;
      } catch (error) {
        if (error instanceof CoreFinanceError || error instanceof HttpError)
          throw error;
        throw new CoreFinanceError('unknown', {
          domainCode: 'LOCAL_PERSISTENCE_FAILED',
          uncertain: false
        });
      }
    },
    categoryIds: {
      prepare: categories.prepareCategoryIds,
      toServer: categories.serverCategoryId,
      toLocal: categories.localCategoryId
    }
  });
  Object.assign(target, ledger, {
    async getHomeSummary(
      profileCurrency: string,
      filters: TransactionFilterSet = emptyTransactionFilters,
      context?: ReadContext
    ): Promise<HomeSummary> {
      return withReadContext(context, async (signal) => {
        const owner = await captureLiveClerkOwner();
        const readTransactions = async () => {
          const transactions: Transaction[] = [];
          let cursor: string | null = null;
          const cursors = new Set<string>();
          do {
            await owner.assertCurrent();
            const page = await ledger.listTransactions(
              filters,
              cursor,
              100,
              signal
            );
            await owner.assertCurrent();
            transactions.push(...page.items);
            cursor = page.nextCursor;
            if (cursor && cursors.has(cursor))
              throw new CoreFinanceError('unknown');
            if (cursor) cursors.add(cursor);
          } while (cursor);
          return transactions;
        };
        const [accountData, transactions] = await Promise.all([
          target.listAccounts(false, { signal }).then(async (liveAccounts) => ({
            liveAccounts,
            balances: await Promise.all(
              liveAccounts
                .filter(
                  (account) =>
                    !filters.accountIds.length ||
                    filters.accountIds.includes(account.id)
                )
                .map((account) => readBalance(account, { signal }))
            )
          })),
          readTransactions()
        ]);
        await owner.assertCurrent();
        const { liveAccounts, balances } = accountData;
        const selectedAccounts = liveAccounts.filter(
          (account) =>
            !filters.accountIds.length ||
            filters.accountIds.includes(account.id)
        );
        const balanceByAccount = new Map(
          balances.map((balance) => [balance.accountId, balance])
        );
        const hasUnreconciledBalance = balances.some(
          (balance) => balance.asOf === null
        );
        const components = selectedAccounts
          .filter((account) => account.currencyCode === profileCurrency)
          .flatMap((account) => {
            const balance = balanceByAccount.get(account.id);
            return balance
              ? [
                  {
                    accountId: account.id,
                    originalMinor: balance.balanceMinor,
                    currencyCode: account.currencyCode,
                    convertedMinor: balance.balanceMinor,
                    rate: 1,
                    asOf: balance.asOf ?? account.updatedAt
                  }
                ]
              : [];
          });
        const excludedAccountIds = selectedAccounts
          .filter((account) => account.currencyCode !== profileCurrency)
          .map((account) => account.id);
        const comparableTransactions = transactions.filter(
          (transaction) => transaction.currencyCode === profileCurrency
        );
        const projections = projectTransactionEffects(transactions, null);
        const periodTotals = comparableTransactions.reduce(
          (totals, transaction) => {
            const confirmed = projections.get(transaction.id)?.confirmed;
            const incomeMinor = safeMinorSum(
              totals.incomeMinor,
              confirmed?.incomeMinor ?? 0
            );
            const expenseMinor = safeMinorSum(
              totals.expenseMinor,
              confirmed?.expenseMinor ?? 0
            );
            if (incomeMinor === null || expenseMinor === null)
              throw new CoreFinanceError('unknown');
            return {
              incomeMinor,
              expenseMinor
            };
          },
          { incomeMinor: 0, expenseMinor: 0 }
        );
        return {
          totalBalanceMinor: components.reduce((total, component) => {
            const sum = safeMinorSum(total, component.convertedMinor);
            if (sum === null) throw new CoreFinanceError('unknown');
            return sum;
          }, 0),
          currencyCode: profileCurrency,
          isEstimated:
            hasUnreconciledBalance ||
            excludedAccountIds.length > 0 ||
            comparableTransactions.length !== transactions.length,
          components,
          excludedAccountIds,
          periodIncomeMinor: periodTotals.incomeMinor,
          periodExpenseMinor: periodTotals.expenseMinor,
          activeAccountCount: selectedAccounts.length,
          recentTransactions: selectHomeTransactions(transactions),
          reviewCount: transactions.filter(
            (transaction) => transaction.reviewStatus === 'required'
          ).length,
          pendingSyncCount: transactions.filter(
            (transaction) => transaction.syncStatus !== 'synced'
          ).length,
          dataState:
            selectedAccounts.length === 0 && transactions.length === 0
              ? 'empty'
              : excludedAccountIds.length > 0
                ? 'partial'
                : 'ready'
        };
      });
    }
  });
  return new Proxy(
    target as unknown as CapabilityProviderHandle<CoreFinanceService>,
    {
      get(provider, property) {
        const mutation = !localMethods.has(String(property)) ||
          ['saveDraft', 'discardDraft'].includes(String(property));
        if (!available && property !== 'metadata')
          return async () => {
            if (mutation || property === 'calculateCreditCardPayoff') assertBenchmarkRead('POST');
            throw new CoreFinanceError('offline');
          };
        if (property in provider) {
          const value = Reflect.get(provider, property);
          if (typeof value !== 'function') return value;
          const invoke = async (...args: unknown[]) => {
            if (property === 'calculateCreditCardPayoff') assertBenchmarkRead('POST');
            try {
              if (
                property !== 'updateTransaction' &&
                (property === 'createTransaction' ||
                  localMethods.has(String(property)) ||
                  useAppShellStore.getState().session?.restoration === 'local')
              ) {
                const owner = await captureLiveClerkOwner();
                if (await confirmedOffline()) {
                  try {
                    return await localCall(property, args, owner);
                  } catch (error) {
                    if (
                      property === 'createTransaction' &&
                      !(error instanceof CoreFinanceError) &&
                      !(error instanceof HttpError) &&
                      !(error instanceof ZodError)
                    )
                      throw new CoreFinanceError('offline', {
                        domainCode: 'LOCAL_PERSISTENCE_FAILED',
                        uncertain: false
                      });
                    throw error;
                  }
                }
                await owner.assertCurrent();
                if (queuedReadMethods.has(String(property))) {
                  const repository = new CoreFinanceRepository();
                  repository.bindOwner(owner.userId);
                  const pending = await repository.hasPendingTransactionEdits(
                    property === 'getTransaction'
                      ? (args[0] as string)
                      : undefined
                  );
                  await owner.assertCurrent();
                  if (pending) return await localCall(property, args, owner);
                }
              }
              return await Reflect.apply(value, provider, args);
            } catch (error) {
              throw coreFinanceError(error);
            }
          };
          return mutation
            ? async (...args: unknown[]) => {
                assertBenchmarkRead('POST');
                return withTransactionDraftWrite(() => invoke(...args));
              }
            : invoke;
        }
        return async () => {
          throw new CoreFinanceError('offline');
        };
      }
    }
  );
}

async function confirmedOffline(): Promise<boolean> {
  if (useAppShellStore.getState().session?.restoration === 'local') return true;
  if (!readRecoveryNetwork.available) return false;
  try {
    return (await readRecoveryNetwork.isOnline()) === false;
  } catch {
    return false;
  }
}

function coreFinanceError(error: unknown): CoreFinanceError {
  if (error instanceof CoreFinanceError) return error;
  if (error instanceof ZodError) return new CoreFinanceError('validation');
  if (!(error instanceof HttpError)) return new CoreFinanceError('unknown');
  const metadata = {
    domainCode: error.domainCode,
    status: error.status,
    requestId: error.requestId,
    uncertain:
      ['provider_unavailable', 'internal_error', 'contract_mismatch'].includes(
        error.code
      ) ||
      error.domainCode === 'IDEMPOTENCY_IN_PROGRESS' ||
      error.domainCode === 'LEDGER_BUSY'
  };
  if (error.code === 'validation_error')
    return new CoreFinanceError('validation', metadata);
  if (error.code === 'not_found')
    return new CoreFinanceError('not_found', metadata);
  if (error.code === 'conflict')
    return new CoreFinanceError('conflict', metadata);
  if (error.code === 'gone') return new CoreFinanceError('expired', metadata);
  if (
    error.code === 'provider_unavailable' ||
    error.code === 'session_expired' ||
    error.code === 'rate_limited'
  )
    return new CoreFinanceError('offline', metadata);
  return new CoreFinanceError('unknown', metadata);
}

function result<T>(
  value: T,
  affectedScopes: readonly string[]
): MutationResult<T> {
  return { value, affectedScopes: uniqueScopes(affectedScopes) };
}

function uniqueScopes(affectedScopes: readonly string[]) {
  return [...new Set([...affectedScopes, ...derivedScopes])];
}

// Home renders two expenses and two incomes. Reserve those before its shared bound.
function selectHomeTransactions(ordered: Transaction[]): Transaction[] {
  const selected = new Set<string>();
  for (const type of ['expense', 'income'] as const) {
    ordered
      .filter((item) => item.type === type)
      .slice(0, 2)
      .forEach((item) => selected.add(item.id));
  }
  for (const item of ordered) {
    if (selected.size >= 5) break;
    selected.add(item.id);
  }
  return ordered.filter((item) => selected.has(item.id));
}
