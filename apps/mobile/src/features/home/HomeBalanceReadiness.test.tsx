import React from 'react';
import { act, screen, waitFor } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { changeLocale, translate } from '@/localization/i18n';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { HomeScreen } from './HomeScreen';
import { invalidateCoreFinanceScopes } from '@/features/core-finance/core-finance-queries';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));

afterEach(() => jest.restoreAllMocks());

it('shows authoritative balances without waiting for the full transaction history', async () => {
  changeLocale('en');
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'SAR',
    status: 'active' as const
  };
  jest.spyOn(coreFinanceService, 'listAccounts').mockResolvedValue([account]);
  jest
    .spyOn(coreFinanceService, 'listAccountBalances')
    .mockResolvedValue([
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
  expect(screen.getAllByText(/1,823\.89/).length).toBeGreaterThan(0);
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
