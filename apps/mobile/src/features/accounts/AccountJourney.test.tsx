import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';

it('creates, selects, adjusts, archives, and preserves historical visibility', () => {
  const repo = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions.slice(0, 3)
  });
  const account = repo.saveAccount({
    name: 'Reserve',
    type: 'savings',
    currencyCode: 'SAR',
    openingBalanceMinor: 100,
    isDefault: true
  });
  repo.saveTransaction({
    type: 'adjustment',
    amountMinor: 50,
    currencyCode: 'SAR',
    accountId: account.id,
    categoryId: null,
    title: 'Adjustment',
    occurredAt: 1
  });
  repo.archiveAccount(account.id);
  expect(repo.listAccounts(true).find((item) => item.id === account.id)?.status)
    .toBe('archived');
  expect(repo.listTransactions(emptyTransactionFilters).total).toBeGreaterThan(0);
});
