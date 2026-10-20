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
import { makeTransaction } from '@/test-utils/core-finance-fixtures';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { AppState } from 'react-native';
import { InitialHomeLoadingBoundary } from '@/features/shell/InitialHomeLoadingBoundary';
import type { HomeTodayActivity } from '@/services/contracts/core-finance-service';

let mockLeaveHome: (() => void) | undefined;
const mockOnline = jest.fn(async () => true);
jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: true, isOnline: () => mockOnline() }
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/home',
  useFocusEffect: (callback: () => (() => void) | undefined) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockLeaveHome = callback();
      return mockLeaveHome;
    }, [callback]);
  }
}));

let mockRefreshHome: () => void;
const mockActivityQuery = {
  data: [
    {
      transaction: makeTransaction(1, { title: 'Cached coffee' }),
      group: 'expense',
      sign: 'negative'
    }
  ] as HomeTodayActivity[] | undefined,
  dataUpdatedAt: 100,
  isPending: false,
  isError: false,
  isFetching: false,
  error: null as CoreFinanceError | null,
  refetch: jest.fn(async () => undefined)
};

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
  error: null as CoreFinanceError | null,
  refetch: jest.fn()
};

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  ...jest.requireActual('@/features/core-finance/core-finance-queries'),
  useHomeBalanceSummary: () => {
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
  useHomeTodayActivity: () => mockActivityQuery
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
  mockHomeQuery.error = null;
  mockActivityQuery.isError = false;
  mockActivityQuery.isPending = false;
  mockActivityQuery.isFetching = false;
  mockActivityQuery.data = [{ transaction: makeTransaction(1, { title: 'Cached coffee' }), group: 'expense', sign: 'negative' }];
  mockActivityQuery.error = null;
  mockActivityQuery.refetch.mockClear();
  mockOnline.mockReset().mockResolvedValue(true);
});

function layoutInitialHome() {
  fireEvent(screen.getByTestId('initial-home-content', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 720 } }
  });
}

it('keeps the branded cover over partial first-page content until today activity is ready', () => {
  mockHomeQuery.isError = false;
  const activity = mockActivityQuery.data;
  mockActivityQuery.data = undefined;
  mockActivityQuery.isPending = true;
  renderWithProviders(<InitialHomeLoadingBoundary isHome><HomeScreen /></InitialHomeLoadingBoundary>);
  layoutInitialHome();
  expect(screen.getByTestId('startup-loading')).toBeTruthy();
  expect(screen.queryByTestId('home-account-card')).toBeNull();
  expect(screen.queryByText(translate('coreFinance.state.loading'))).toBeNull();
  act(() => {
    mockActivityQuery.data = activity;
    mockActivityQuery.isPending = false;
    mockRefreshHome();
  });
  expect(screen.queryByTestId('startup-loading')).toBeNull();
  expect(screen.getByTestId('home-account-card')).toBeTruthy();
  expect(screen.getByText('Cached coffee')).toBeTruthy();
});

it('reveals the complete cached page while its background reads are still fetching', () => {
  mockHomeQuery.isError = false;
  mockHomeQuery.isFetching = true;
  mockActivityQuery.isFetching = true;
  renderWithProviders(<InitialHomeLoadingBoundary isHome><HomeScreen /></InitialHomeLoadingBoundary>);
  layoutInitialHome();
  expect(screen.queryByTestId('startup-loading')).toBeNull();
  expect(screen.getByTestId('home-account-card')).toBeTruthy();
  expect(screen.getByText('Cached coffee')).toBeTruthy();
});

it('keeps the last same-day activity after a failed refresh with a truthful stale notice', () => {
  mockHomeQuery.isError = false;
  mockActivityQuery.isError = true;
  renderWithProviders(<HomeScreen />);
  expect(screen.getByText('Cached coffee')).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
  expect(screen.queryByText(translate('coreFinance.state.error'))).toBeNull();
});

it('recovers failed Home reads after connectivity returns, without refetching healthy reads', async () => {
  jest.useFakeTimers();
  const previousAppState = AppState.currentState;
  AppState.currentState = 'active';
  mockHomeQuery.isError = false;
  mockActivityQuery.isError = true;
  mockActivityQuery.error = new CoreFinanceError('offline', { status: 503 });
  mockOnline.mockResolvedValue(false);
  const view = renderWithProviders(<HomeScreen />);
  try {
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(mockActivityQuery.refetch).not.toHaveBeenCalled();
    mockOnline.mockResolvedValue(true);
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(mockActivityQuery.refetch).toHaveBeenCalledTimes(1);
    expect(mockActivityQuery.refetch).toHaveBeenCalledWith({
      cancelRefetch: false
    });
    expect(mockHomeQuery.refetch).not.toHaveBeenCalled();
    mockActivityQuery.isError = false;
    act(() => mockRefreshHome());
    await act(async () => jest.advanceTimersByTime(20_000));
    expect(mockActivityQuery.refetch).toHaveBeenCalledTimes(1);
    mockLeaveHome?.();
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(mockActivityQuery.refetch).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    AppState.currentState = previousAppState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  }
});

it.each([
  new CoreFinanceError('offline', { status: 401 }),
  new CoreFinanceError('unknown', { status: 403 }),
  new CoreFinanceError('validation', { status: 400 }),
  new CoreFinanceError('offline', { status: 429 }),
  new CoreFinanceError('unknown', { status: 502 }),
  new Error('unknown failure')
])(
  'does not repeatedly retry permanent or unclassified Home errors: %s',
  async (error) => {
    jest.useFakeTimers();
    const previousAppState = AppState.currentState;
    AppState.currentState = 'active';
    mockHomeQuery.isError = false;
    mockActivityQuery.isError = true;
    mockActivityQuery.error = error as CoreFinanceError;
    const view = renderWithProviders(<HomeScreen />);
    try {
      await act(async () => jest.advanceTimersByTime(30_000));
      expect(mockOnline).not.toHaveBeenCalled();
      expect(mockActivityQuery.refetch).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      AppState.currentState = previousAppState;
      jest.useRealTimers();
    }
  }
);

it.each(['blur', 'background'] as const)(
  'does not recover after %s while a connectivity probe is pending',
  async (leave) => {
    jest.useFakeTimers();
    const previousAppState = AppState.currentState;
    AppState.currentState = 'active';
    const appStateListeners: ((state: 'active' | 'background') => void)[] =
      [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListeners.push(listener);
        return { remove: jest.fn() };
      });
    let online!: (value: boolean) => void;
    mockOnline.mockReturnValue(
      new Promise<boolean>((resolve) => {
        online = resolve;
      })
    );
    mockHomeQuery.isError = false;
    mockActivityQuery.isError = true;
    mockActivityQuery.error = new CoreFinanceError('offline', { status: 503 });
    const view = renderWithProviders(<HomeScreen />);
    try {
      await act(async () => jest.advanceTimersByTime(10_000));
      expect(mockOnline).toHaveBeenCalledTimes(1);
      if (leave === 'blur') mockLeaveHome?.();
      else
        act(() =>
          appStateListeners.forEach((listener) => listener('background'))
        );
      await act(async () => {
        online(true);
      });
      await act(async () => jest.advanceTimersByTime(30_000));
      expect(mockActivityQuery.refetch).not.toHaveBeenCalled();
      expect(mockOnline).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      AppState.currentState = previousAppState;
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  }
);

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
