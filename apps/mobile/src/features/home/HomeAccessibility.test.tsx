import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';

import type { HomeSummary } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { HomeScreen } from './HomeScreen';

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useHomeSummary: () => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() })
}));

const summary: HomeSummary = {
  totalBalanceMinor: 125000,
  currencyCode: 'SAR',
  isEstimated: true,
  components: [],
  excludedAccountIds: ['account-usd'],
  periodIncomeMinor: 50000,
  periodExpenseMinor: 20000,
  activeAccountCount: 2,
  recentTransactions: [],
  reviewCount: 1,
  pendingSyncCount: 1,
  dataState: 'partial'
};

it('keeps hidden values and non-color status text available', async () => {
  renderWithProviders(<HomeScreen summary={summary} />);
  expect(screen.getAllByText('•••• SAR').length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(screen.getByText(translate('coreFinance.home.estimated'))).toBeTruthy();
    expect(screen.getByText(`${translate('coreFinance.home.pendingSync')} 1`)).toBeTruthy();
  });
});
