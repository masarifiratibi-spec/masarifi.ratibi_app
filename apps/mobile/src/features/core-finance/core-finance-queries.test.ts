import { coreFinanceKeys, scopeToKey } from './core-finance-queries';
import { emptyTransactionFilters } from '@/domain/core-finance';

it('creates stable isolated query keys', () => {
  expect(coreFinanceKeys.home('SAR')).toEqual(['core-finance', 'home', 'SAR']);
  expect(coreFinanceKeys.transactions(emptyTransactionFilters)).toEqual([
    'core-finance',
    'transactions',
    emptyTransactionFilters
  ]);
  expect(coreFinanceKeys.account('a1')).not.toEqual(coreFinanceKeys.accounts());
});

it.each([
  ['home.summary', ['core-finance', 'home']],
  ['accounts.list', ['core-finance', 'accounts']],
  ['accounts.detail.a1', ['core-finance', 'account', 'a1']],
  ['transactions.detail.t1', ['core-finance', 'transaction', 't1']],
  ['categories.list', ['core-finance', 'categories']],
  ['conflicts.detail.c1', ['core-finance']]
] as const)('maps %s to the narrow invalidation root', (scope, expected) => {
  expect(scopeToKey(scope)).toEqual(expected);
});

it('builds selector and conflict detail keys without durable data in Zustand', () => {
  expect(coreFinanceKeys.categories(true)).toEqual([
    'core-finance',
    'categories',
    true
  ]);
  expect(coreFinanceKeys.conflict('c1')).toEqual([
    'core-finance',
    'conflict',
    'c1'
  ]);
});
