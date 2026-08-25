import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { AccountPicker } from './AccountPicker';

it('searches active accounts and disambiguates duplicate names', () => {
  const onSelect = jest.fn();
  renderWithQueryData(
    <AccountPicker selectedId="account-bank" onSelect={onSelect} />,
    [
      [
        coreFinanceKeys.accounts(true),
        [
          ...fixtureAccounts,
          { ...fixtureAccounts[0], id: 'account-bank-2', lastFour: '9999' }
        ]
      ],
      [
        coreFinanceKeys.accountBalances(true),
        fixtureAccounts.map((account) => ({
          accountId: account.id,
          balanceMinor: account.openingBalanceMinor,
          currencyCode: account.currencyCode
        }))
      ],
      [coreFinanceKeys.categories(true), fixtureCategories]
    ]
  );
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.accounts.search')),
    '2048'
  );
  fireEvent.press(screen.getByText(/2048/));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'account-bank' })
  );
  expect(screen.queryByText(/0019/)).toBeNull();
});

it('distinguishes no eligible accounts from no search matches', () => {
  const first = renderWithQueryData(<AccountPicker />, [
    [coreFinanceKeys.accounts(true), [fixtureAccounts[3]]],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(screen.getByText(translate('coreFinance.accounts.noEligible'))).toBeTruthy();
  first.unmount();

  renderWithQueryData(<AccountPicker />, [
    [coreFinanceKeys.accounts(true), fixtureAccounts.slice(0, 1)],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.accounts.search')),
    'missing'
  );
  expect(screen.getByText(translate('coreFinance.accounts.noSearchResults'))).toBeTruthy();
});
