import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import TransactionsRoute from '../../../app/(tabs)/transactions';
import { emptyTransactionFilters, type HomeSummary } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { monthPeriod, periodFilters } from '@/features/filters/date-period';
import { changeLocale, translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { usePreferenceStore } from '@/state/preferences';

const mockNavigate = jest.fn();
let mockParams: { returnTo?: string } = {};

jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    push: jest.fn()
  },
  useLocalSearchParams: () => mockParams
}));

const summary: HomeSummary = {
  totalBalanceMinor: 0,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 12_345,
  periodExpenseMinor: 0,
  activeAccountCount: 0,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'empty'
};

it('keeps contextual return navigation inside the transactions toolbar', () => {
  const now = Date.UTC(2026, 7, 16, 12);
  jest.spyOn(Date, 'now').mockReturnValue(now);
  changeLocale('en');
  usePreferenceStore.setState({ baseCurrencyCode: 'SAR', timeZone: 'UTC' });
  mockParams = { returnTo: '/reports' };
  renderWithQueryData(<TransactionsRoute />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    [coreFinanceKeys.home('SAR', periodFilters(monthPeriod(now))), summary]
  ]);

  expect(screen.getByText('+123.45 SAR')).toBeTruthy();
  fireEvent.press(screen.getByLabelText(translate('appShell.navigation.back')));
  expect(mockNavigate).toHaveBeenCalledWith('/reports');
});
