import React from 'react';
import { screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { TransactionDetailScreen } from './TransactionDetailScreen';

it('shows financial fields, source, status, and eligible actions', () => {
  const item = fixtureTransactions[0];
  renderWithQueryData(<TransactionDetailScreen id={item.id} />, [
    [coreFinanceKeys.transaction(item.id), item],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(screen.getByText(item.title)).toBeTruthy();
  expect(
    screen.getByText(translate(`coreFinance.source.${item.source}` as never))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.transaction.delete'))
  ).toBeTruthy();
  expect(
    screen.getByText(
      fixtureAccounts.find((account) => account.id === item.accountId)!.name
    )
  ).toBeTruthy();
  expect(screen.queryByText(item.accountId)).toBeNull();
});

it('restores the undo window from a persisted deleted transaction', () => {
  const item = {
    ...fixtureTransactions[0],
    status: 'deleted' as const,
    deletedAt: Date.now(),
    undoExpiresAt: Date.now() + 20_000
  };
  renderWithQueryData(<TransactionDetailScreen id={item.id} />, [
    [coreFinanceKeys.transaction(item.id), item],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(
    screen.getByText(translate('coreFinance.transaction.deleted'))
  ).toBeTruthy();
  expect(screen.getByLabelText(translate('coreFinance.undo'))).toBeTruthy();
  expect(
    screen.queryByText(translate('coreFinance.transaction.delete'))
  ).toBeNull();
});
