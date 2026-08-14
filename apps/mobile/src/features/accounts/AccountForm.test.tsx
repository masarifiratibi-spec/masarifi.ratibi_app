import React, { useEffect, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Account } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { AccountForm } from './AccountForm';

it('validates required name and preserves type/currency fields', () => {
  renderWithProviders(<AccountForm />);
  fireEvent.press(screen.getByText(translate('coreFinance.accounts.save')));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByDisplayValue('SAR')).toBeTruthy();
});

it('fills edit fields when account data arrives after the first render', async () => {
  function Harness() {
    const [account, setAccount] = useState<Account | undefined>();
    useEffect(() => setAccount(fixtureAccounts[0]), []);
    return <AccountForm account={account} />;
  }

  renderWithProviders(<Harness />);

  await waitFor(() => expect(screen.getByDisplayValue('Daily account')).toBeTruthy());
  expect(screen.getByDisplayValue('SAR')).toBeTruthy();
  expect(screen.getByDisplayValue('8500')).toBeTruthy();
});
