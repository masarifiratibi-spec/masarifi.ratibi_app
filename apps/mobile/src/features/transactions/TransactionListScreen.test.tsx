import React from 'react';
import { screen } from '@testing-library/react-native';

import { emptyTransactionFilters } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { currentLocale } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { TransactionListScreen } from './TransactionListScreen';

it('renders populated ledger rows from the service query', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactions(emptyTransactionFilters),
      { items: fixtureTransactions.slice(0, 2), nextCursor: null, total: 2 }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  const transaction = fixtureTransactions[0];
  const account = fixtureAccounts.find(
    (item) => item.id === transaction.accountId
  )!;
  const category = fixtureCategories.find(
    (item) => item.id === transaction.categoryId
  )!;
  expect(screen.getByText(transaction.title)).toBeTruthy();
  expect(screen.getAllByText(account.name).length).toBeGreaterThan(0);
  expect(
    screen.getByText(
      currentLocale() === 'ar' ? category.labelAr : category.labelEn
    )
  ).toBeTruthy();
  expect(screen.queryByText(transaction.accountId)).toBeNull();
});

it('keeps dense transaction list useful and mounted rows bounded', () => {
  const dense = Array.from({ length: 1_000 }, (_, index) => makeTransaction(index));
  const started = performance.now();
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactions(emptyTransactionFilters),
      { items: dense, nextCursor: null, total: 1_000 }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  expect(performance.now() - started).toBeLessThan(2_000);
  expect(screen.getByText(dense[0].title)).toBeTruthy();
  expect(screen.queryByText(dense[999].title)).toBeNull();
  expect(screen.UNSAFE_getAllByType(require('@/design-system/components/financial/TransactionRow').TransactionRow).length).toBeLessThan(100);
});
