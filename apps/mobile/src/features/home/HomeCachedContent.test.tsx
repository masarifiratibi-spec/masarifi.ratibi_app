import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { HomeSummary } from '@/domain/core-finance';
import { changeLocale, translate } from '@/localization/i18n';
import {
  fixtureAccounts as mockAccounts,
  fixtureCategories as mockCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { HomeScreen } from './HomeScreen';
import * as financialFormatting from '@/utils/format-financial-value';
import * as periods from '@/features/filters/date-period';

let mockRefreshHome: () => void;
const mockActivity: [] = [];

const snapshot: HomeSummary = {
  totalBalanceMinor: 125000,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 50000,
  periodExpenseMinor: 20000,
  activeAccountCount: 2,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};
const mockHomeQuery = {
  data: snapshot as HomeSummary | undefined,
  dataUpdatedAt: 100,
  isLoading: false,
  isError: true,
  isFetching: false,
  refetch: jest.fn()
};

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  ...jest.requireActual('@/features/core-finance/core-finance-queries'),
  useHomeSummary: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [, refresh] = React.useState(0);
    mockRefreshHome = () => refresh((revision) => revision + 1);
    return mockHomeQuery;
  },
  useAccounts: () => ({ data: mockAccounts }),
  useCategories: () => ({ data: mockCategories }),
  useAccountBalances: () => ({ data: [] })
}));
jest.mock('./useHomeTodayActivity', () => ({
  useHomeTodayActivity: () => ({
    data: mockActivity,
    isPending: false,
    isError: false
  })
}));
jest.mock('@/features/settings/settings-queries', () => ({
  useSettingsProfile: () => ({ data: { name: 'Dana' } })
}));

beforeEach(() => {
  mockHomeQuery.data = snapshot;
  mockHomeQuery.isError = true;
  mockHomeQuery.isFetching = false;
  mockHomeQuery.dataUpdatedAt = 100;
  mockHomeQuery.refetch.mockClear();
});

it.each(['ar', 'en'] as const)(
  'keeps cached Home content with a refresh-failed notice and retry in %s',
  (locale) => {
    changeLocale(locale);
    renderWithProviders(<HomeScreen />);
    expect(screen.getByTestId('home-account-card')).toBeTruthy();
    expect(
      screen.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    fireEvent.press(screen.getByText(translate('coreFinance.action.retry')));
    expect(mockHomeQuery.refetch).toHaveBeenCalledTimes(1);
  }
);

it('keeps the error and retry when no prior snapshot exists', () => {
  mockHomeQuery.data = undefined;
  mockHomeQuery.dataUpdatedAt = 0;
  renderWithProviders(<HomeScreen />);
  expect(screen.queryByTestId('home-account-card')).toBeNull();
  fireEvent.press(screen.getByText(translate('coreFinance.action.retry')));
  expect(mockHomeQuery.refetch).toHaveBeenCalledTimes(1);
});

it('shows cached content with a refreshing notice during revalidation', () => {
  mockHomeQuery.isError = false;
  mockHomeQuery.isFetching = true;
  renderWithProviders(<HomeScreen />);
  expect(screen.getByTestId('home-account-card')).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.state.refreshingSnapshot'))
  ).toBeTruthy();
  expect(screen.queryByText(translate('coreFinance.state.loading'))).toBeNull();
});

it('updates freshness feedback without repeating unchanged summary or header work', () => {
  mockHomeQuery.isError = false;
  const financial = jest.spyOn(
    financialFormatting,
    'formatFinancialDisplayValue'
  );
  const period = jest.spyOn(periods, 'formatPeriodLabel');
  const view = renderWithProviders(<HomeScreen />);
  try {
    financial.mockClear();
    period.mockClear();
    mockHomeQuery.isFetching = true;
    act(() => mockRefreshHome());
    expect(
      screen.getByText(translate('coreFinance.state.refreshingSnapshot'))
    ).toBeTruthy();
    expect(screen.getByTestId('home-account-card')).toBeTruthy();
    expect(financial).not.toHaveBeenCalled();
    expect(period).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    financial.mockRestore();
    period.mockRestore();
  }
});
