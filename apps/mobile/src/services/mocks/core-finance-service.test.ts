import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

function service() {
  return createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 30)
    })
  );
}

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

  const first = await sut.createTransaction(input, 'assistant-op-1', 'platform_assisted');
  const replay = await sut.createTransaction({ ...input, amountMinor: 999999 }, 'assistant-op-1', 'platform_assisted');
  expect(replay.value).toEqual(first.value);
  expect((await sut.listTransactions(emptyTransactionFilters)).items.filter((item) => item.id === first.value.id)).toHaveLength(1);

  await sut.updateTransaction(first.value.id, { ...first.value, title: 'Owner update' });
  expect((await sut.getTransaction(first.value.id)).version).toBeGreaterThan(first.value.version);
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
