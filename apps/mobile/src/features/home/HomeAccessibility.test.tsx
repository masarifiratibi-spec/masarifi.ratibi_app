import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { HomeScreen } from './HomeScreen';

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useHomeSummary: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  }),
  useAccounts: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    data: require('@/test-utils/core-finance-fixtures').fixtureAccounts,
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  }),
  useAccountBalances: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  })
}));
jest.mock('@/features/settings/settings-queries', () => ({
  useSettingsProfile: () => ({ data: { name: 'Dana', email: null } })
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

it('keeps hidden values and the retained non-color estimate status available', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(<HomeScreen summary={summary} />);
  expect(screen.getAllByText('•••• SAR').length).toBeGreaterThan(0);
  expect(
    screen.getByText(translate('coreFinance.home.estimated'))
  ).toBeTruthy();
  expect(
    screen.queryByText(`${translate('coreFinance.home.pendingSync')} 1`)
  ).toBeNull();
});

it('gives Home quick actions accessible touch targets and exposes the Accounts modal', () => {
  usePreferenceStore.setState({ hideBalances: false, locale: 'en', direction: 'ltr' });
  renderWithProviders(<HomeScreen summary={summary} />);

  for (const action of ['add', 'voice', 'reports', 'accounts']) {
    expect(screen.getByTestId(`home-quick-action-${action}`)).toHaveStyle({
      minHeight: 48,
      minWidth: 48
    });
  }

  fireEvent.press(screen.getByTestId('home-quick-action-accounts'));
  expect(screen.getByTestId('app-sheet-modal')).toBeTruthy();
  expect(
    screen.getByLabelText(translate('coreFinance.home.accountScope.title'))
  ).toHaveProp('accessibilityViewIsModal', true);
  expect(
    screen.getByTestId('account-scope-all')
  ).toHaveProp('accessibilityState', { selected: true });
  for (const label of [
    translate('coreFinance.home.manageAccounts'),
    translate('coreFinance.cancel')
  ]) {
    expect(screen.getByLabelText(label)).toBeTruthy();
  }
});
