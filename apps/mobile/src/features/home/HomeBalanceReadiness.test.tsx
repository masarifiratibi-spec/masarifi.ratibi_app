import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { changeLocale, translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { HomeScreen } from './HomeScreen';
import { invalidateCoreFinanceScopes } from '@/features/core-finance/core-finance-queries';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { bindLocalReadCache } from '@/services/local-read-cache';
import { emptyTransactionFilters } from '@/domain/core-finance';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));

afterEach(() => jest.restoreAllMocks());

it('shows the saved negative Home balance and activity before held live reads, then replaces them without remounting controls', async () => {
  changeLocale('en');
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2026-11-06T09:00:00.000Z'));
  useCoreFinanceViewState.getState().selectAccount(null);
  usePreferenceStore.setState({
    hideBalances: false,
    timeZone: 'Asia/Riyadh',
    baseCurrencyCode: 'SAR'
  });
  const previousSession = useAppShellStore.getState().session;
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'saved-home-owner',
      method: 'google',
      restoration: 'restored',
      issuedAt: 1,
      expiresAt: 9999999999999
    }
  });
  const account = {
    ...fixtureAccounts[0]!,
    currencyCode: 'SAR',
    status: 'active' as const
  };
  const savedBalance = {
    accountId: account.id,
    currencyCode: 'SAR',
    balanceMinor: -1600,
    asOf: 100
  };
  const savedActivity = [
    {
      transaction: makeTransaction(1, {
        accountId: account.id,
        title: 'Saved coffee',
        currencyCode: 'SAR',
        occurredAt: Date.now()
      }),
      group: 'expense' as const,
      sign: 'negative' as const
    }
  ];
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue([account]);
  let finishBalances!: (rows: (typeof savedBalance)[]) => void;
  jest.spyOn(coreFinanceService, 'listAccountBalances').mockImplementation(
    () =>
      new Promise((resolve) => {
        finishBalances = resolve;
      })
  );
  let finishActivity!: (rows: typeof savedActivity) => void;
  jest.spyOn(coreFinanceService, 'getHomeTodayActivity').mockImplementation(
    () =>
      new Promise((resolve) => {
        finishActivity = resolve;
      })
  );
  function SavedHome() {
    const client = useQueryClient();
    React.useEffect(
      () =>
        bindLocalReadCache(client, {
          current: () => ({ ownerId: 'saved-home-owner', locale: 'en' }),
          load: async () => [
            {
              key: [
                'core-finance',
                'home',
                'balance-source',
                { ownerId: 'saved-home-owner' }
              ],
              data: { accounts: [account], balances: [savedBalance] },
              updatedAt: 100
            },
            {
              key: [
                'core-finance',
                'transactions',
                'home-today',
                'Asia/Riyadh',
                {
                  ...emptyTransactionFilters,
                  periodStart: 1793912400000,
                  periodEnd: 1793998799999
                }
              ],
              data: savedActivity,
              updatedAt: 100
            }
          ],
          save: async () => {}
        }),
      [client]
    );
    return <HomeScreen />;
  }
  const view = renderWithProviders(<SavedHome />);
  try {
    expect(await screen.findByText('Saved coffee')).toBeOnTheScreen();
    expect(screen.getAllByText(/-16\.00/).length).toBeGreaterThan(0);
    const voice = screen.getByTestId('home-quick-action-voice');
    const card = screen.getByTestId('home-account-card');
    await act(async () => {
      finishBalances([{ ...savedBalance, balanceMinor: -1200 }]);
      finishActivity([
        {
          ...savedActivity[0]!,
          transaction: {
            ...savedActivity[0]!.transaction,
            title: 'Updated coffee'
          }
        }
      ]);
    });
    expect(await screen.findByText('Updated coffee')).toBeOnTheScreen();
    expect(screen.queryByText('Saved coffee')).toBeNull();
    expect(screen.getAllByText(/-12\.00/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('home-quick-action-voice')).toBe(voice);
    expect(screen.getByTestId('home-account-card')).toBe(card);
  } finally {
    view.unmount();
    useAppShellStore.setState({ session: previousSession });
  }
});

it('shows the existing Home controls and activity sections before initial financial reads resolve', async () => {
  changeLocale('en');
  useCoreFinanceViewState.getState().selectAccount(null);
  usePreferenceStore.setState({ hideBalances: false });
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'SAR',
    status: 'active' as const
  };
  let finishAccounts!: (accounts: typeof fixtureAccounts) => void;
  let finishBalances!: (
    balances: {
      accountId: string;
      currencyCode: string;
      balanceMinor: number;
      asOf: number;
    }[]
  ) => void;
  jest.spyOn(coreFinanceService, 'listAccounts').mockReturnValue(
    new Promise((resolve) => {
      finishAccounts = resolve;
    })
  );
  jest.spyOn(coreFinanceService, 'listAccountBalances').mockReturnValue(
    new Promise((resolve) => {
      finishBalances = resolve;
    })
  );
  jest
    .spyOn(coreFinanceService, 'getHomeTodayActivity')
    .mockImplementation(() => new Promise(() => {}));
  const view = renderWithProviders(<HomeScreen />);
  try {
    const card = screen.getByTestId('home-account-card');
    const voice = screen.getByTestId('home-quick-action-voice');
    expect(screen.getByTestId('home-quick-action-add')).toBeOnTheScreen();
    expect(screen.getByTestId('home-quick-action-reports')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('home-quick-action-reports'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/reports',
      params: { returnTo: '/(tabs)/home' }
    });
    expect(
      screen.getByTestId('home-expense-section-heading')
    ).toBeOnTheScreen();
    expect(screen.getByTestId('home-income-section-heading')).toBeOnTheScreen();
    expect(
      screen.queryByText(translate('coreFinance.state.loading'))
    ).toBeNull();
    expect(
      screen.queryByText(translate('coreFinance.home.todayEmpty'))
    ).toBeNull();
    expect(screen.queryByText(/0\.00\s+SAR/)).toBeNull();
    await act(async () => {
      finishAccounts([account]);
      finishBalances([
        {
          accountId: account.id,
          currencyCode: 'SAR',
          balanceMinor: 182389,
          asOf: Date.now()
        }
      ]);
    });
    await waitFor(() =>
      expect(screen.getAllByText(/1,823\.89/).length).toBeGreaterThan(0)
    );
    expect(screen.getByTestId('home-account-card')).toBe(card);
    expect(screen.getByTestId('home-quick-action-voice')).toBe(voice);
    expect(
      screen.queryByText(translate('coreFinance.state.loading'))
    ).toBeNull();
  } finally {
    view.unmount();
  }
});

it('keeps Home mounted and immediately shows only the selected native-currency account while activity refreshes', async () => {
  changeLocale('en');
  const accounts = [
    {
      ...fixtureAccounts[0],
      id: 'sar-account',
      currencyCode: 'SAR',
      status: 'active' as const
    },
    {
      ...fixtureAccounts[1],
      id: 'egp-account',
      currencyCode: 'EGP',
      status: 'active' as const
    }
  ];
  const day = [
    {
      transaction: makeTransaction(1, {
        accountId: 'sar-account',
        title: 'SAR coffee',
        occurredAt: Date.now()
      }),
      group: 'expense' as const,
      sign: 'negative' as const
    },
    {
      transaction: makeTransaction(2, {
        accountId: 'egp-account',
        currencyCode: 'EGP',
        title: 'EGP salary',
        type: 'income',
        occurredAt: Date.now()
      }),
      group: 'income' as const,
      sign: 'positive' as const
    }
  ];
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue(accounts);
  const balances = jest
    .spyOn(coreFinanceService, 'listAccountBalances')
    .mockResolvedValue([
      {
        accountId: 'sar-account',
        currencyCode: 'SAR',
        balanceMinor: 12500,
        asOf: 1
      },
      {
        accountId: 'egp-account',
        currencyCode: 'EGP',
        balanceMinor: 100,
        asOf: 1
      }
    ]);
  const activity = jest
    .spyOn(coreFinanceService, 'getHomeTodayActivity')
    .mockResolvedValue(day);
  useCoreFinanceViewState.getState().selectAccount(null);
  usePreferenceStore.setState({ hideBalances: false });
  const view = renderWithProviders(<HomeScreen />);
  try {
    await screen.findByText('SAR coffee');
    const card = screen.getByTestId('home-account-card');
    activity.mockImplementation(() => new Promise(() => {}));
    act(() => useCoreFinanceViewState.getState().selectAccount('egp-account'));
    expect(screen.getByTestId('home-account-card')).toBe(card);
    expect(
      screen.getByLabelText(
        new RegExp(`${translate('coreFinance.home.balance')}.*1\\.00\\s+EGP`)
      )
    ).toBeTruthy();
    expect(screen.getByText('EGP salary')).toBeTruthy();
    expect(screen.queryByText('SAR coffee')).toBeNull();
    expect(
      screen.queryByText(translate('coreFinance.state.loading'))
    ).toBeNull();
    expect(balances).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    useCoreFinanceViewState.getState().selectAccount(null);
  }
});

it('shows authoritative balances without waiting for the full transaction history', async () => {
  changeLocale('en');
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'SAR',
    status: 'active' as const
  };
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue([account]);
  jest.spyOn(coreFinanceService, 'listAccountBalances').mockResolvedValue([
    {
      accountId: account.id,
      currencyCode: 'SAR',
      balanceMinor: 182389,
      asOf: Date.now()
    }
  ]);
  const history = jest
    .spyOn(coreFinanceService, 'getHomeSummary')
    .mockImplementation(() => new Promise(() => {}));
  renderWithProviders(<HomeScreen />);
  expect(await screen.findByTestId('home-account-card')).toBeTruthy();
  expect(screen.getByTestId('home-quick-action-voice')).toBeTruthy();
  await waitFor(() =>
    expect(screen.getAllByText(/1,823\.89/).length).toBeGreaterThan(0)
  );
  expect(history).not.toHaveBeenCalled();
});

it('refreshes the balance automatically once after a financial receipt', async () => {
  changeLocale('en');
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'SAR',
    status: 'active' as const
  };
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue([account]);
  let balanceMinor = 182389;
  const balances = jest
    .spyOn(coreFinanceService, 'listAccountBalances')
    .mockImplementation(async () => [
      {
        accountId: account.id,
        currencyCode: 'SAR',
        balanceMinor,
        asOf: Date.now()
      }
    ]);
  let client: QueryClient;
  function WithClient() {
    client = useQueryClient();
    return <HomeScreen />;
  }
  renderWithProviders(<WithClient />);
  await waitFor(() =>
    expect(screen.getAllByText(/1,823\.89/).length).toBeGreaterThan(0)
  );
  balanceMinor = 182289;
  await act(async () =>
    invalidateCoreFinanceScopes(client!, ['home.summary', 'accounts.balances'])
  );
  await waitFor(() =>
    expect(screen.getAllByText(/1,822\.89/).length).toBeGreaterThan(0)
  );
  expect(screen.queryByText(/1,823\.89/)).toBeNull();
  expect(balances).toHaveBeenCalledTimes(2);
});

it('does not display an invented balance when authoritative balance retrieval fails', async () => {
  jest
    .spyOn(coreFinanceService, 'listAccountBalances')
    .mockRejectedValue(new Error('Unavailable'));
  renderWithProviders(<HomeScreen />);
  expect(
    await screen.findByRole('button', {
      name: translate('coreFinance.action.retry')
    })
  ).toBeTruthy();
  expect(screen.queryByTestId('home-account-card')).toBeNull();
});
