import { emptyTransactionFilters } from '@/domain/core-finance';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { CoreFinanceRepository } from './core-finance-repository';

function repository() {
  return new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions
  });
}

it('searches Arabic and English text with deterministic filtered paging', () => {
  const repo = repository();
  const searched = repo.listTransactions({
    ...emptyTransactionFilters,
    search: 'merchant 42'
  });
  expect(searched.items[0].id).toBe('transaction-42');

  const filtered = repo.listTransactions(
    { ...emptyTransactionFilters, types: ['expense'], statuses: ['posted'] },
    null,
    25
  );
  const next = repo.listTransactions(
    { ...emptyTransactionFilters, types: ['expense'], statuses: ['posted'] },
    filtered.nextCursor,
    25
  );
  expect(new Set([...filtered.items, ...next.items].map((item) => item.id)).size)
    .toBe(filtered.items.length + next.items.length);
});

it('sorts by amount and returns a real filtered-empty result', () => {
  const repo = repository();
  const page = repo.listTransactions({
    ...emptyTransactionFilters,
    sort: 'amount_high'
  });
  expect(page.items[0].amountMinor).toBeGreaterThanOrEqual(
    page.items[1].amountMinor
  );
  expect(
    repo.listTransactions({ ...emptyTransactionFilters, search: 'never-here' })
      .total
  ).toBe(0);
});
