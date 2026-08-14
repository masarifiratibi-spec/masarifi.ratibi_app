import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

const input = (title: string, amountMinor: number) => ({
  type: 'expense' as const,
  amountMinor,
  currencyCode: 'SAR',
  accountId: 'account-bank',
  categoryId: 'food',
  title,
  occurredAt: Date.now()
});

it('creates a voice group atomically and idempotently', async () => {
  const service = createMockCoreFinanceService(new CoreFinanceRepository({
    accounts: fixtureAccounts, categories: fixtureCategories
  }));
  const first = await service.createTransactionsAtomically(
    [input('One', 1000), input('Two', 2000)], 'voice-group', 'voice'
  );
  const retry = await service.createTransactionsAtomically(
    [input('One', 1000), input('Two', 2000)], 'voice-group', 'voice'
  );
  expect(retry.value.map((item) => item.id)).toEqual(first.value.map((item) => item.id));
  expect((await service.listTransactions(emptyTransactionFilters)).total).toBe(2);
  expect(first.value.every((item) => item.source === 'voice')).toBe(true);
});

it('creates none when any selected input is invalid', async () => {
  const service = createMockCoreFinanceService(new CoreFinanceRepository({
    accounts: fixtureAccounts, categories: fixtureCategories
  }));
  await expect(service.createTransactionsAtomically(
    [input('Valid', 1000), { ...input('Invalid', 0), amountMinor: 0 }],
    'failed-group', 'voice'
  )).rejects.toBeDefined();
  expect((await service.listTransactions(emptyTransactionFilters)).total).toBe(0);
});
