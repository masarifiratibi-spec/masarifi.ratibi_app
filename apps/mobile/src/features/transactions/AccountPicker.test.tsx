import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { AccountPicker, AccountScopePicker } from './AccountPicker';

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

it('filters incompatible currencies but retains the existing selection', () => {
  const seeds = [
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ] as const;
  const filtered = renderWithQueryData(
    <AccountPicker currencyCode="SAR" />,
    seeds
  );

  expect(screen.getByText('Wallet')).toBeTruthy();
  expect(screen.queryByText('Travel')).toBeNull();
  filtered.unmount();

  renderWithQueryData(
    <AccountPicker currencyCode="SAR" selectedId="account-usd" />,
    seeds
  );
  expect(screen.getByText('Travel')).toBeTruthy();
});

function renderWarmScopePicker(currencyCode = 'SAR') {
  const account = { ...fixtureAccounts[0], currencyCode: 'SAR' };
  const archived = { ...account, id: 'unused-archived', status: 'archived' as const };
  return renderWithQueryData(<AccountScopePicker />, [
    [coreFinanceKeys.accounts(true), [account, archived]],
    [coreFinanceKeys.homeBalanceSource(), {
      accounts: [account],
      balances: [{ accountId: account.id, currencyCode, balanceMinor: 12345, asOf: Date.now() }]
    }]
  ]);
}

it('shows matching Home balances immediately and refreshes only active balances', async () => {
  const read = jest.spyOn(coreFinanceService, 'listAccountBalances').mockResolvedValue([{
    accountId: fixtureAccounts[0].id, currencyCode: 'SAR', balanceMinor: 67890
  }]);
  const view = renderWarmScopePicker();
  try {
    const label = () => view.getByTestId('account-row').props.accessibilityLabel;
    expect(label()).toContain('123.45');
    await waitFor(() => expect(label()).toContain('678.90'));
    expect(read.mock.calls.map(([includeArchived]) => includeArchived)).toEqual([false]);
  } finally {
    view.unmount();
    read.mockRestore();
  }
});

it('withholds a mismatched currency and removes rows after an authoritative denial', async () => {
  const read = jest.spyOn(coreFinanceService, 'listAccountBalances').mockRejectedValue({ status: 403 });
  const view = renderWarmScopePicker('USD');
  try {
    expect(view.getByTestId('account-row').props.accessibilityLabel)
      .toContain(translate('coreFinance.accounts.balanceUnknown'));
    await waitFor(() => expect(view.queryByTestId('account-row')).toBeNull());
    expect(view.getByText(translate('coreFinance.action.retry'))).toBeOnTheScreen();
  } finally {
    view.unmount();
    read.mockRestore();
  }
});
