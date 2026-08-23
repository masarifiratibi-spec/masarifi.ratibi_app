import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Account } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { AccountForm } from './AccountForm';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() }
}));

describe('AccountForm', () => {
  it('validates required name and shows hero card with currency', () => {
    renderWithProviders(<AccountForm initialType="bank" />);

    // Step 2 indicator and title
    expect(screen.getByText(translate('coreFinance.accounts.step2Of2'))).toBeTruthy();
    expect(screen.getByText(translate('coreFinance.accounts.setup.introTitle'))).toBeTruthy();

    // Bank hero card title is present
    expect(screen.getByText(translate('coreFinance.accounts.typeSelect.bank'))).toBeTruthy();

    // Attempt save with empty name
    fireEvent.press(screen.getByText(translate('coreFinance.accounts.create')));
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders credit card specific fields for credit_card type', () => {
    renderWithProviders(<AccountForm initialType="credit_card" />);

    expect(screen.getByText(translate('coreFinance.accounts.typeSelect.credit_card'))).toBeTruthy();
    expect(screen.getByText(translate('coreFinance.accounts.setup.creditLimit'))).toBeTruthy();
    expect(screen.getByText(translate('coreFinance.accounts.setup.dueDay'))).toBeTruthy();
  });

  it('renders streamlined fields for cash type', () => {
    renderWithProviders(<AccountForm initialType="cash" />);

    expect(screen.getByText(translate('coreFinance.accounts.typeSelect.cash'))).toBeTruthy();
    expect(screen.getByText(translate('coreFinance.accounts.name'))).toBeTruthy();
    expect(screen.getByText(translate('coreFinance.accounts.openingBalance'))).toBeTruthy();
    // Bank education tip should not appear in cash flow
    expect(screen.queryByText(translate('coreFinance.accounts.setup.educationTitle'))).toBeNull();
  });

  it('fills edit fields when account data arrives after the first render', async () => {
    function Harness() {
      const [account, setAccount] = useState<Account | undefined>();
      useEffect(() => setAccount(fixtureAccounts[0]), []);
      return <AccountForm account={account} />;
    }

    renderWithProviders(<Harness />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('Daily account')).toBeTruthy()
    );
    expect(screen.getByText('SAR')).toBeTruthy();
    expect(screen.getByDisplayValue('8500')).toBeTruthy();
  });

  it('confirms before discarding a dirty account draft', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    renderWithProviders(<AccountForm initialType="bank" />);

    fireEvent.changeText(
      screen.getByLabelText(translate('coreFinance.accounts.name')),
      'Cash box'
    );
    fireEvent.press(screen.getByLabelText(translate('common.back')));

    expect(alert).toHaveBeenCalledWith(
      translate('coreFinance.accounts.discardChanges'),
      translate('coreFinance.accounts.discardChangesBody'),
      expect.any(Array)
    );
    expect(router.back).not.toHaveBeenCalled();
  });
});
