import React from 'react';
import { PixelRatio } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { AccountRow } from './AccountRow';
import { projectAccount } from './account-presentation';

it('renders account identity, status, and a single selectable row action', () => {
  const onPress = jest.fn();
  const account = { ...fixtureAccounts[0], isDefault: true };

  renderWithProviders(
    <AccountRow
      presentation={projectAccount(account, {
        accountId: account.id,
        balanceMinor: 10_00,
        currencyCode: account.currencyCode
      })}
      selected
      onPress={onPress}
    />
  );

  fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByText(account.name)).toBeTruthy();
  expect(screen.getByText(/Default account|الحساب الافتراضي/)).toBeTruthy();
  expect(
    screen.getByTestId('account-row-icon-accounts', {
      includeHiddenElements: true
    })
  ).toBeTruthy();
});

it('announces hidden account balance state without exposing the value', () => {
  const account = fixtureAccounts[0];

  renderWithProviders(
    <AccountRow
      presentation={projectAccount(
        account,
        {
          accountId: account.id,
          balanceMinor: 99_99,
          currencyCode: account.currencyCode
        },
        true
      )}
    />
  );

  expect(
    screen.getAllByLabelText(/Value hidden|القيمة مخفية/).length
  ).toBeGreaterThan(0);
  expect(screen.queryByText(/99\.99/)).toBeNull();
});

it('renders account balance with currency-owned precision', () => {
  const account = { ...fixtureAccounts[0], currencyCode: 'OMR' };

  renderWithProviders(
    <AccountRow
      presentation={projectAccount(account, {
        accountId: account.id,
        balanceMinor: 12_345,
        currencyCode: account.currencyCode
      })}
    />
  );

  expect(screen.getByText('12.345')).toBeTruthy();
});

it('stacks account identity and balance at 200% text', () => {
  const fontScale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  const account = fixtureAccounts[0];

  renderWithProviders(
    <AccountRow
      presentation={projectAccount(account, {
        accountId: account.id,
        balanceMinor: 99_99,
        currencyCode: account.currencyCode
      })}
    />
  );

  expect(screen.getByTestId('account-row')).toHaveStyle({
    flexDirection: 'column'
  });
  fontScale.mockRestore();
});
