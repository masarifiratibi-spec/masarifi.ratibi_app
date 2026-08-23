import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import {
  createDemoCoreFinanceService,
  createMockCoreFinanceService,
  createProductionCoreFinanceService
} from './core-finance-service';

function service() {
  return createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 30)
    })
  );
}

it('starts production with one zero-balance default account and no fixture transactions', async () => {
  const production = createProductionCoreFinanceService();

  expect(await production.listAccounts()).toEqual([
    expect.objectContaining({
      name: 'Masarifi',
      currencyCode: 'SAR',
      openingBalanceMinor: 0,
      isDefault: true,
      status: 'active'
    })
  ]);
  expect(
    (await production.listTransactions(emptyTransactionFilters, null, 50)).items
  ).toEqual([]);
  expect(await production.listCategories()).toHaveLength(19);
});

it('can start a client-demo ledger with showcase accounts and transactions', async () => {
  const demo = createDemoCoreFinanceService();

  const accounts = await demo.listAccounts();
  const transactions = await demo.listTransactions(
    emptyTransactionFilters,
    null,
    50
  );
  const summary = await demo.getHomeSummary('SAR');

  expect(accounts.length).toBeGreaterThanOrEqual(3);
  expect(accounts.some((account) => account.id === 'account-default')).toBe(
    true
  );
  expect(transactions.items.length).toBeGreaterThanOrEqual(8);
  expect(summary.dataState).toBe('ready');
  expect(summary.totalBalanceMinor).toBeGreaterThan(0);
  expect(summary.periodIncomeMinor).toBeGreaterThan(0);
  expect(summary.periodExpenseMinor).toBeGreaterThan(0);
});

it('uses client-demo data from production factory only when the demo flag is enabled', async () => {
  const previous = process.env.EXPO_PUBLIC_DEMO_MODE;
  try {
    delete process.env.EXPO_PUBLIC_DEMO_MODE;
    expect(
      (
        await createProductionCoreFinanceService().listTransactions(
          emptyTransactionFilters
        )
      ).items
    ).toEqual([]);

    process.env.EXPO_PUBLIC_DEMO_MODE = '1';
    expect(
      (
        await createProductionCoreFinanceService().listTransactions(
          emptyTransactionFilters
        )
      ).items.length
    ).toBeGreaterThan(0);
  } finally {
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_DEMO_MODE;
    } else {
      process.env.EXPO_PUBLIC_DEMO_MODE = previous;
    }
  }
});

it('derives Home from accounts and eligible ledger records', async () => {
  const summary = await service().getHomeSummary('SAR');
  expect(summary.activeAccountCount).toBe(3);
  expect(summary.recentTransactions).toHaveLength(5);
  expect(summary.totalBalanceMinor).toBeGreaterThan(0);
  expect(summary.isEstimated).toBe(true);
  expect(summary.reviewCount).toBeGreaterThan(0);
  expect(summary.pendingSyncCount).toBeGreaterThan(0);
  expect(summary.periodExpenseMinor).toBeGreaterThan(0);
});

it('filters Home period metrics and recent transactions through the shared ledger filters', async () => {
  const sut = service();
  const base = {
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'salary',
    title: 'January salary'
  };
  await sut.createTransaction({
    ...base,
    type: 'income',
    amountMinor: 1200,
    occurredAt: Date.UTC(2040, 0, 5)
  });
  await sut.createTransaction({
    ...base,
    categoryId: 'food',
    title: 'January lunch',
    type: 'expense',
    amountMinor: 500,
    occurredAt: Date.UTC(2040, 0, 6)
  });
  await sut.createTransaction({
    ...base,
    title: 'February salary',
    type: 'income',
    amountMinor: 900,
    occurredAt: Date.UTC(2040, 1, 5)
  });

  const summary = await sut.getHomeSummary('SAR', {
    ...emptyTransactionFilters,
    periodStart: Date.UTC(2040, 0, 1),
    periodEnd: Date.UTC(2040, 1, 1) - 1
  });

  expect(summary.periodIncomeMinor).toBe(1200);
  expect(summary.periodExpenseMinor).toBe(500);
  expect(summary.recentTransactions.map((item) => item.title)).toEqual([
    'January lunch',
    'January salary'
  ]);
});

it('uses canonical confirmed effects for Home income and expense totals', async () => {
  const occurredAt = Date.UTC(2040, 0, 5);
  const originalExpense = makeTransaction(1, {
    id: 'original-expense',
    amountMinor: 100,
    occurredAt,
    reviewStatus: 'none'
  });
  const originalIncome = makeTransaction(2, {
    id: 'original-income',
    type: 'income',
    amountMinor: 200,
    occurredAt,
    reviewStatus: 'none'
  });
  const sut = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: [
        originalExpense,
        originalIncome,
        makeTransaction(3, {
          id: 'refund',
          type: 'refund',
          amountMinor: 40,
          originalTransactionId: originalExpense.id,
          occurredAt,
          reviewStatus: 'none'
        }),
        makeTransaction(4, {
          id: 'reversal',
          type: 'reversal',
          amountMinor: 200,
          originalTransactionId: originalIncome.id,
          occurredAt,
          reviewStatus: 'none'
        }),
        makeTransaction(5, {
          type: 'transfer',
          destinationAccountId: 'account-wallet',
          feeMinor: 5,
          occurredAt,
          reviewStatus: 'none'
        }),
        makeTransaction(6, {
          amountMinor: 500,
          status: 'pending',
          occurredAt,
          reviewStatus: 'none'
        }),
        makeTransaction(7, {
          id: 'duplicate-reversal',
          type: 'reversal',
          amountMinor: 200,
          originalTransactionId: originalIncome.id,
          occurredAt: occurredAt + 1,
          reviewStatus: 'none'
        })
      ]
    })
  );

  const summary = await sut.getHomeSummary('SAR', {
    ...emptyTransactionFilters,
    periodStart: Date.UTC(2040, 0, 1),
    periodEnd: Date.UTC(2040, 1, 1) - 1
  });

  expect(summary.periodIncomeMinor).toBe(0);
  expect(summary.periodExpenseMinor).toBe(60);
});

it('creates an idempotent manual transaction', async () => {
  const sut = service();
  const input = {
    type: 'expense' as const,
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food',
    title: 'Lunch',
    occurredAt: Date.now()
  };
  const first = await sut.createTransaction(input, 'operation-1');
  const second = await sut.createTransaction(input, 'operation-1');
  expect(second.value.id).toBe(first.value.id);
  expect(
    (await sut.listTransactions(emptyTransactionFilters)).items.filter(
      (item) => item.id === first.value.id
    )
  ).toHaveLength(1);
});

it('keeps assistant transaction operation IDs idempotent and owner versions enforced', async () => {
  const sut = service();
  const input = {
    type: 'expense' as const,
    amountMinor: 2500,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food',
    title: 'Assistant proposal',
    occurredAt: Date.now()
  };

  const first = await sut.createTransaction(
    input,
    'assistant-op-1',
    'platform_assisted'
  );
  const replay = await sut.createTransaction(
    { ...input, amountMinor: 999999 },
    'assistant-op-1',
    'platform_assisted'
  );
  expect(replay.value).toEqual(first.value);
  expect(
    (await sut.listTransactions(emptyTransactionFilters)).items.filter(
      (item) => item.id === first.value.id
    )
  ).toHaveLength(1);

  await sut.updateTransaction(first.value.id, {
    ...first.value,
    title: 'Owner update'
  });
  expect((await sut.getTransaction(first.value.id)).version).toBeGreaterThan(
    first.value.version
  );
});

it('keeps merge effects visible through the service', async () => {
  const sut = service();
  await sut.mergeCategory('food', 'restaurants');
  expect(
    (await sut.listCategories(true)).find((item) => item.id === 'food')?.status
  ).toBe('merged');
  expect(
    (await sut.listTransactions(emptyTransactionFilters)).items.some(
      (item) => item.categoryId === 'food'
    )
  ).toBe(false);
});
