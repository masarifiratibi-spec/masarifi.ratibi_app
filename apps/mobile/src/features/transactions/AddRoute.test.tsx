import React from 'react';
import { screen } from '@testing-library/react-native';

import AddRoute from '../../../app/(tabs)/add';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

const mockParams: { type?: string; accountId?: string } = {
  type: 'transfer',
  accountId: 'account-1'
};
const mockTransactionForm = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams
}));

jest.mock('@/features/transactions/TransactionForm', () => ({
  TransactionForm: (props: unknown) => mockTransactionForm(props)
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockParams, {
    type: 'transfer',
    accountId: 'account-1'
  });
});

it('exports the add tab route', () => {
  expect(typeof AddRoute).toBe('function');
});

it('renders only the manual transaction form and preserves supported prefills', () => {
  renderWithProviders(<AddRoute />);

  expect(screen.queryByText(translate('voice.mode.voice'))).toBeNull();
  expect(mockTransactionForm).toHaveBeenCalledWith({
    initialAccountId: 'account-1',
    initialType: 'transfer'
  });
});

it('falls back to expense for transaction types hidden from Add', () => {
  Object.assign(mockParams, { type: 'obligation_payment' });

  renderWithProviders(<AddRoute />);

  expect(mockTransactionForm).toHaveBeenCalledWith({
    initialAccountId: 'account-1',
    initialType: 'expense'
  });
});
