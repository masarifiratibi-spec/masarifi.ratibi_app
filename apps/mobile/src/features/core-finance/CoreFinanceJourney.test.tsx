import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeConflict
} from '@/test-utils/core-finance-fixtures';

it('keeps Home, account, ledger, delete, merge, and conflict invariants aligned', () => {
  const repo = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions.slice(0, 30)
  });
  const before = repo.accountBalance('account-bank');
  const created = repo.saveTransaction({
    type: 'expense',
    amountMinor: 100,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food',
    title: 'Expense',
    occurredAt: 1
  });
  expect(repo.accountBalance('account-bank')).toBe(before - 100);
  repo.undoDelete(repo.deleteTransaction(created.id, 1).id, 2);
  expect(repo.requireTransaction(created.id).status).toBe('posted');
  repo.mergeCategory('food', 'restaurants');
  expect(
    repo.listTransactions(emptyTransactionFilters).items.some(
      (item) => item.categoryId === 'food'
    )
  ).toBe(false);
  const conflict = makeConflict(repo.requireTransaction('transaction-0'));
  repo.addConflict(conflict);
  repo.resolveConflict(conflict.id, 'keep_local');
  expect(repo.requireTransaction('transaction-0').syncStatus).toBe('pending');
});
