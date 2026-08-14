import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from './core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';

it('pages 500 deterministic records without duplicates or omissions', () => {
  const repository = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions
  });
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page = repository.listTransactions(
      emptyTransactionFilters,
      cursor,
      50
    );
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(ids).toHaveLength(500);
  expect(new Set(ids).size).toBe(500);
});

it('pages 1,000 deterministic records in stable duplicate-free order', () => {
  const repository = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: Array.from({ length: 1_000 }, (_, index) => makeTransaction(index))
  });
  const ids: string[] = [];
  let cursor: string | null = null;
  const started = performance.now();

  do {
    const page = repository.listTransactions(emptyTransactionFilters, cursor, 100);
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor);

  expect(performance.now() - started).toBeLessThan(2_000);
  expect(ids).toHaveLength(1_000);
  expect(new Set(ids).size).toBe(1_000);
  expect(ids[0]).toBe('transaction-0');
  expect(ids.at(-1)).toBe('transaction-999');
});
