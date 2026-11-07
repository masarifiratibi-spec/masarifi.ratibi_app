import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Account, AccountBalanceProjection } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';

import { changeLocale } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { renderWithProviders } from '@/test-utils/render';
import { ObligationDetailScreen } from './ObligationDetailScreen';
import { ObligationPaymentScreen } from './ObligationPaymentScreen';
import { PaymentMatchReviewScreen } from './PaymentMatchReviewScreen';
import { usePreferenceStore } from '@/state/preferences';

it.each(['other-currency', 'closed'] as const)(
  'does not default a SAR payment to a first %s account',
  async (scenario) => {
    changeLocale('en');
    let queryClient: QueryClient | undefined;
    function QueryAccess() { queryClient = useQueryClient(); return null; }
    const screen = renderWithProviders(<><QueryAccess /><ObligationPaymentScreen obligationId="obligation-car" /></>);
    try {
      await screen.findByLabelText(/Funding account Masarifi/);
      if (!queryClient) throw new Error('PAYMENT_QUERY_CLIENT_REQUIRED');
      const key = coreFinanceKeys.accounts();
      const accounts = queryClient.getQueryData<Account[]>(key);
      const sample = accounts?.[0];
      if (!accounts || !sample) throw new Error('PAYMENT_ACCOUNT_FIXTURE_REQUIRED');
      const first: Account = {...sample, id:'ineligible-first', name:'Ineligible account', isDefault:true,
        currencyCode: scenario === 'other-currency' ? 'EGP' : 'SAR',
        status: scenario === 'closed' ? 'closed' : 'active'};
      await act(async () => { queryClient?.setQueryData(key, [first, ...accounts]); });
      expect(screen.queryByLabelText('Funding account Ineligible account')).toBeNull();
      fireEvent.changeText(screen.getByLabelText('Payment amount'), '50');
      fireEvent.press(screen.getByText('Review payment'));
      expect(await screen.findByText('Confirm payment')).toBeTruthy();
    } finally { screen.unmount(); }
  }
);

it.each(['2026-10-16T22:30:00Z', '2026-10-17T02:30:00Z'])(
  'records an early-morning payment at %s on the owner local day without a future ledger timestamp',
  async (now) => {
    jest.useFakeTimers({ now: Date.parse(now) });
    const previousZone = usePreferenceStore.getState().timeZone;
    usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' });
    changeLocale('en');
    const preview = jest.spyOn(
      financialPlanningService,
      'previewObligationPayment'
    );
    const payment = renderWithProviders(
      <ObligationPaymentScreen obligationId="obligation-car" />
    );
    try {
      fireEvent.changeText(
        await payment.findByLabelText('Payment amount'),
        '٥٠'
      );
      fireEvent.press(payment.getByText('Review payment'));
      await payment.findByText('Confirm payment');
      expect(preview).toHaveBeenCalledWith(
        expect.objectContaining({
          paidDate: '2026-10-17',
          transaction: expect.objectContaining({
            input: expect.objectContaining({
              occurredAt: Date.parse('2026-10-16T21:00:00Z')
            })
          })
        })
      );
    } finally {
      payment.unmount();
      preview.mockRestore();
      usePreferenceStore.setState({ timeZone: previousZone });
      jest.useRealTimers();
    }
  }
);

it('previews and confirms a payment, then resolves a detected match', async () => {
  changeLocale('en');
  const payment = renderWithProviders(
    <ObligationPaymentScreen obligationId="obligation-car" />
  );
  expect(
    await payment.findByLabelText(/Funding account Masarifi/)
  ).toBeTruthy();
  fireEvent.changeText(await payment.findByLabelText('Payment amount'), '100');
  fireEvent.press(payment.getByText('Review payment'));
  expect(await payment.findByText('Full payment')).toBeTruthy();
  expect(payment.getByText('Balance before payment')).toBeTruthy();
  expect(payment.getByText('Balance after payment')).toBeTruthy();
  expect(payment.getByText('Payment date')).toBeTruthy();
  fireEvent.press(payment.getByText('Confirm payment'));
  expect(await payment.findByText('Saved')).toBeTruthy();
  expect(payment.getByText('Confirm payment')).toBeDisabled();
  expect(payment.getByText('Edit')).toBeDisabled();
  payment.unmount();

  const detail = renderWithProviders(
    <ObligationDetailScreen obligationId="obligation-car" />
  );
  expect(await detail.findByLabelText(/Installment 1.*Paid/)).toBeTruthy();
  expect(detail.queryByTestId('obligation-detail-payment-history')).toBeNull();
  fireEvent.press(detail.getByRole('button', { name: 'Payment history' }));
  expect(detail.getByTestId('obligation-detail-payment-history')).toBeTruthy();
  detail.unmount();

  const match = renderWithProviders(
    <PaymentMatchReviewScreen matchId="match-payment-car" />
  );
  expect(await match.findByText('Clear match')).toBeTruthy();
  expect(match.getByText('Strong match')).toBeTruthy();
  expect(match.getAllByText('Demo Auto').length).toBeGreaterThan(0);
  expect(match.getByText('Remaining now')).toBeTruthy();
  expect(match.getByText('After matching')).toBeTruthy();
  fireEvent.press(match.getByText('Match payment'));
  expect(await match.findByText('Resolved')).toBeTruthy();
  match.unmount();
});

it('keeps the reviewed before and after balances stable when the receipt refreshes the account', async () => {
  changeLocale('en');
  let client!: QueryClient;
  function QueryAccess() {
    client = useQueryClient();
    return null;
  }
  const payment = renderWithProviders(<><QueryAccess /><ObligationPaymentScreen obligationId="obligation-car" /></>);
  const amountInput = await payment.findByLabelText('Payment amount');
  const balanceKey = coreFinanceKeys.accountBalances();
  const balances = client.getQueryData<AccountBalanceProjection[]>(balanceKey)!;
  expect(balances.length).toBeGreaterThan(0);
  act(() => client.setQueryData(balanceKey, balances.map(balance => ({ ...balance, balanceMinor: 100000 }))));
  fireEvent.changeText(amountInput, '100');
  fireEvent.press(payment.getByText('Review payment'));
  await payment.findByText('Confirm payment');
  expect(payment.getByText(/1,000\.00\sSAR/u)).toBeTruthy();
  expect(payment.getByText(/900\.00\sSAR/u)).toBeTruthy();
  await act(async () => {
    client.setQueryData(balanceKey, balances.map(balance => ({ ...balance, balanceMinor: 90000 })));
    // TanStack Query notifies its mounted observers on the next timer turn.
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(payment.getByText(/1,000\.00\sSAR/u)).toBeTruthy();
  expect(payment.getByText(/900\.00\sSAR/u)).toBeTruthy();
  expect(payment.queryByText(/800\.00\sSAR/u)).toBeNull();
});

it('keeps payment available and resolved matches terminal with the live provider', async () => {
  changeLocale('en');
  Object.assign(financialPlanningService.metadata, { kind: 'live' });
  try {
    const detail = renderWithProviders(
      <ObligationDetailScreen obligationId="obligation-car" />
    );
    expect(await detail.findByText('Record payment')).toBeTruthy();
    detail.unmount();

    const payment = renderWithProviders(
      <ObligationPaymentScreen obligationId="obligation-car" />
    );
    expect(await payment.findByText('Review payment')).toBeTruthy();
    payment.unmount();

    const match = renderWithProviders(
      <PaymentMatchReviewScreen matchId="match-payment-car" />
    );
    expect(await match.findByText('Resolved')).toBeTruthy();
    expect(match.queryByText('Match payment')).toBeNull();
    expect(match.queryByText('Ignore match')).toBeNull();
    match.unmount();
  } finally {
    Object.assign(financialPlanningService.metadata, { kind: 'mock' });
  }
});
