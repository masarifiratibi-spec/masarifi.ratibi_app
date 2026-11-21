import React from 'react';
import { BackHandler } from 'react-native';
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
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';

const mockDismissTo = jest.fn();
let mockParams: { returnTo?: string; accountId?: string } = {};

jest.mock('expo-router', () => ({
  router: {
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
    push: jest.fn()
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => (() => void) | undefined) =>
    jest.requireActual('react').useEffect(callback, [callback])
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

it('opens View all with the linked account selected', () => {
  const now = Date.UTC(2026, 7, 16, 12);
  jest.spyOn(Date, 'now').mockReturnValue(now);
  changeLocale('en');
  usePreferenceStore.setState({ baseCurrencyCode: 'SAR', timeZone: 'UTC' });
  useCoreFinanceViewState.getState().selectAccount(null);
  const account = fixtureAccounts[0];
  mockParams = { accountId: account.id };
  renderWithQueryData(<TransactionsRoute />, [
    [coreFinanceKeys.transactionPages({ ...emptyTransactionFilters, accountIds: [account.id] }),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    [coreFinanceKeys.home('SAR', { ...periodFilters(monthPeriod(now)), accountIds: [account.id] }), summary]
  ]);
  expect(screen.getAllByText(account.name).length).toBeGreaterThan(0);
  useCoreFinanceViewState.getState().selectAccount(null);
});

it('keeps contextual return navigation inside the transactions toolbar', () => {
  const back = jest.spyOn(BackHandler, 'addEventListener');
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
  expect(mockDismissTo).toHaveBeenCalledWith('/reports');
  const hardwareBack = back.mock.calls.find(([event]) => event === 'hardwareBackPress')?.[1];
  expect(hardwareBack?.()).toBe(true);
  back.mockRestore();
});
