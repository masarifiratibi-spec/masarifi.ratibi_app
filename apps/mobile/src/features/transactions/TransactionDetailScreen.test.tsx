import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { TransactionDetailScreen } from './TransactionDetailScreen';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';

beforeEach(() => usePreferenceStore.setState({ hideBalances: false }));

it('offers retry when loading the transaction fails', async () => {
  jest
    .spyOn(coreFinanceService, 'getTransaction')
    .mockRejectedValueOnce(new Error('offline'));

  renderWithProviders(<TransactionDetailScreen id="missing" />);

  expect(
    await screen.findByText(translate('coreFinance.state.error'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.action.retry'))
  ).toBeTruthy();
});

it('shows financial fields, source, status, and eligible actions', () => {
  usePreferenceStore.setState({ hideBalances: true });
  const item = fixtureTransactions[0];
  renderWithQueryData(<TransactionDetailScreen id={item.id} />, [
    [coreFinanceKeys.transaction(item.id), item],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(screen.getByText(item.title)).toBeTruthy();
  expect(
    screen.getByText(translate(`coreFinance.source.${item.source}` as never))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.transaction.delete'))
  ).toBeTruthy();
  expect(
    screen.getByText(
      fixtureAccounts.find((account) => account.id === item.accountId)!.name
    )
  ).toBeTruthy();
  expect(screen.queryByText(item.accountId)).toBeNull();
  expect(screen.getByText('•••• SAR')).toBeTruthy();
  expect(screen.getByText(translate('support.report.transaction'))).toBeTruthy();
  expect(screen.queryByText('support.report.transaction')).toBeNull();
  expect(
    screen.getByLabelText(translate('coreFinance.transaction.details'))
  ).toBeTruthy();
});

it('requires named confirmation before deleting a transaction', () => {
  const item = fixtureTransactions[0];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const remove = jest.spyOn(coreFinanceService, 'deleteTransaction');
  renderWithQueryData(<TransactionDetailScreen id={item.id} />, [
    [coreFinanceKeys.transaction(item.id), item],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  fireEvent.press(screen.getByText(translate('coreFinance.transaction.delete')));
  expect(alert).toHaveBeenCalledWith(
    translate('coreFinance.transaction.delete'),
    expect.stringContaining(item.title),
    expect.any(Array)
  );
  expect(remove).not.toHaveBeenCalled();
});

it('restores the undo window from a persisted deleted transaction', () => {
  const item = {
    ...fixtureTransactions[0],
    status: 'deleted' as const,
    deletedAt: Date.now(),
    undoExpiresAt: Date.now() + 20_000
  };
  renderWithQueryData(<TransactionDetailScreen id={item.id} />, [
    [coreFinanceKeys.transaction(item.id), item],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(
    screen.getByText(translate('coreFinance.transaction.deleted'))
  ).toBeTruthy();
  expect(screen.getByLabelText(translate('coreFinance.undo'))).toBeTruthy();
  expect(
    screen.queryByText(translate('coreFinance.transaction.delete'))
  ).toBeNull();
});
