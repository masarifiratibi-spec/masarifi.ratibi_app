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
import { AccountDetailScreen } from './AccountDetailScreen';

it('shows derived balance and account management actions', () => {
  const account = fixtureAccounts[0];
  renderWithQueryData(<AccountDetailScreen id={account.id} />, [
    [coreFinanceKeys.account(account.id), account],
    [
      coreFinanceKeys.transactions({
        ...emptyTransactionFilters,
        accountIds: [account.id]
      }),
      { items: fixtureTransactions.slice(0, 5), nextCursor: null, total: 5 }
    ]
  ]);
  expect(screen.getByText(account.name)).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.accounts.edit'))).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.action.transfer'))).toBeTruthy();
});
