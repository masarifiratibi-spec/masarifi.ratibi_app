import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TransactionEditRoute from '@app/transactions/[id]/edit';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

const mockRefetch = jest.fn();
const mockUseTransaction = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'transaction-1' })
}));

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useTransaction: (...args: unknown[]) => mockUseTransaction(...args)
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('offers retry when the transaction cannot be loaded', () => {
  mockUseTransaction.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    refetch: mockRefetch
  });

  renderWithProviders(<TransactionEditRoute />);
  fireEvent.press(screen.getByText(translate('coreFinance.action.retry')));

  expect(screen.getByText(translate('coreFinance.state.error'))).toBeTruthy();
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it('shows a safe back action when the transaction is missing', () => {
  mockUseTransaction.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: mockRefetch
  });

  renderWithProviders(<TransactionEditRoute />);
  fireEvent.press(screen.getByText(translate('appShell.navigation.back')));

  expect(
    screen.getByText(translate('coreFinance.transaction.missing'))
  ).toBeTruthy();
  expect(router.back).toHaveBeenCalledTimes(1);
});
