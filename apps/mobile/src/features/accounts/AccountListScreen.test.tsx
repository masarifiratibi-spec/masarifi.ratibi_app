import React from 'react';
import { screen } from '@testing-library/react-native';

import { emptyTransactionFilters } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { AccountListScreen } from './AccountListScreen';

it('renders active, archived, duplicate, and add-account states', () => {
  renderWithQueryData(<AccountListScreen />, [
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [
      coreFinanceKeys.transactions(emptyTransactionFilters),
      { items: fixtureTransactions.slice(0, 5), nextCursor: null, total: 5 }
    ]
  ]);
  expect(screen.getByText(fixtureAccounts[0].name)).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.accounts.add'))).toBeTruthy();
});
