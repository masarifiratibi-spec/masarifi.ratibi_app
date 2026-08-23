import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountPickerRoute from '../../../app/modals/account-picker';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { renderWithProviders } from '@/test-utils/render';

const mockParams: {
  draft?: string;
  field?: 'accountId' | 'destinationAccountId';
} = { draft: 'manual', field: 'accountId' };

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams
}));
jest.mock('@/design-system/components/overlays/RouteModalContainer', () => ({
  RouteModalContainer: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock('@/features/transactions/AccountPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AccountPicker: ({
      onSelect
    }: {
      onSelect: (value: { id: string }) => void;
    }) => (
      <Pressable onPress={() => onSelect({ id: 'account-wallet' })}>
        <Text>Choose account</Text>
      </Pressable>
    )
  };
});
jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    loadDraft: jest.fn(),
    saveDraft: jest.fn()
  }
}));

const draft = {
  id: 'manual-entry',
  transactionType: 'expense' as const,
  amountText: '25',
  accountId: 'account-bank',
  destinationAccountId: null,
  categoryId: 'housing',
  merchant: 'Lunch',
  notes: null,
  occurredAt: 1_723_939_200_000,
  status: 'editing' as const,
  updatedAt: 1_723_939_200_000
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockParams, { draft: 'manual', field: 'accountId' });
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(draft);
  jest
    .mocked(coreFinanceService.saveDraft)
    .mockImplementation(async (value) => value);
});

it('stores the selected account field in the manual draft before returning', async () => {
  Object.assign(mockParams, { field: 'destinationAccountId' });
  renderWithProviders(<AccountPickerRoute />);

  fireEvent.press(screen.getByText('Choose account'));

  await waitFor(() =>
    expect(coreFinanceService.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ destinationAccountId: 'account-wallet' })
    )
  );
  expect(router.back).toHaveBeenCalledTimes(1);
});
