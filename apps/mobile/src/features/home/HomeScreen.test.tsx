import React from 'react';
import { screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/domain/core-finance';
import { renderWithProviders } from '@/test-utils/render';
import { HomeScreen } from './HomeScreen';

const summary: HomeSummary = {
  totalBalanceMinor: 125000,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 50000,
  periodExpenseMinor: 20000,
  activeAccountCount: 2,
  recentTransactions: [],
  reviewCount: 1,
  pendingSyncCount: 1,
  dataState: 'ready'
};

it('shows the financial hierarchy while masking values by default', () => {
  renderWithProviders(<HomeScreen summary={summary} />);
  expect(screen.getByText('•••• SAR')).toBeTruthy();
  expect(screen.getAllByText(/Expense|مصروف/).length).toBeGreaterThan(0);
});
