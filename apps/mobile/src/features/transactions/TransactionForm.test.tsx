import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { TransactionForm } from './TransactionForm';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    loadDraft: jest.fn(async () => null),
    saveDraft: jest.fn(async (draft: unknown) => draft),
    discardDraft: jest.fn(async () => undefined),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn()
  }
}));

it('keeps amount-first entry values and shows localized validation before save', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await waitFor(() =>
    expect(screen.getByLabelText(translate('coreFinance.form.amount'))).toBeTruthy()
  );
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.form.title')),
    'Lunch'
  );
  fireEvent.press(screen.getByText(translate('coreFinance.form.save')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    translate('coreFinance.validation.required')
  );
  expect(screen.getByDisplayValue('Lunch')).toBeTruthy();
});
