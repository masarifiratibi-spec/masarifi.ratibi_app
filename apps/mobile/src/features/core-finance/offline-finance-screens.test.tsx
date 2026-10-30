import React from 'react';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { createSeededCoreFinanceService } from '@/services/mocks/core-finance-service';
import { fixtureTransactions } from '@/test-utils/core-finance-fixtures';
import * as queries from './core-finance-queries';
import { AccountListScreen } from '@/features/accounts/AccountListScreen';
import { AccountDetailScreen } from '@/features/accounts/AccountDetailScreen';
import { TransactionDetailScreen } from '@/features/transactions/TransactionDetailScreen';

afterEach(() => jest.restoreAllMocks());
const snapshot = (data: unknown) => ({
  data,
  isLoading: false,
  isError: true,
  isFetching: false,
  dataUpdatedAt: 100,
  refetch: jest.fn()
});

it.each(['en', 'ar'] as const)(
  'retains saved accounts, balances and transaction details after a refresh error in %s',
  async (locale) => {
    changeLocale(locale);
    const coreFinanceService = createSeededCoreFinanceService();
    const accounts = await coreFinanceService.listAccounts(true);
    const balances = await coreFinanceService.listAccountBalances(true);
    jest
      .spyOn(queries, 'useAccounts')
      .mockReturnValue(snapshot(accounts) as never);
    jest
      .spyOn(queries, 'useAccountBalances')
      .mockReturnValue(snapshot(balances) as never);
    const list = renderWithProviders(<AccountListScreen />);
    expect(list.queryByText(translate('coreFinance.state.error'))).toBeNull();
    expect(
      list.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    list.unmount();
    jest
      .spyOn(queries, 'useAccount')
      .mockReturnValue(snapshot(accounts[0]) as never);
    const detail = renderWithProviders(
      <AccountDetailScreen id={accounts[0].id} />
    );
    expect(
      detail.getByTestId('account-detail-masthead-title')
    ).toHaveTextContent(accounts[0].name);
    expect(detail.queryByText(translate('coreFinance.state.error'))).toBeNull();
    detail.unmount();
    const transaction = await coreFinanceService.getTransaction(
      fixtureTransactions[0].id
    );
    jest
      .spyOn(queries, 'useTransaction')
      .mockReturnValue(snapshot(transaction) as never);
    const transactionScreen = renderWithProviders(
      <TransactionDetailScreen id={transaction.id} />
    );
    expect(transactionScreen.getByText(transaction.title)).toBeTruthy();
    expect(
      transactionScreen.queryByText(translate('coreFinance.state.error'))
    ).toBeNull();
  }
);
