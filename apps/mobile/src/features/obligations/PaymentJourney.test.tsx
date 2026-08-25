import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ObligationPaymentScreen } from './ObligationPaymentScreen';
import { PaymentMatchReviewScreen } from './PaymentMatchReviewScreen';

it('previews and confirms a payment, then resolves a detected match', async () => {
  changeLocale('en');
  const payment = renderWithProviders(<ObligationPaymentScreen obligationId="obligation-car" />);
  expect(await payment.findByLabelText(/Funding account Masarifi/)).toBeTruthy();
  fireEvent.changeText(await payment.findByLabelText('Payment amount'), '100');
  fireEvent.press(payment.getByText('Review payment'));
  expect(await payment.findByText('Full payment')).toBeTruthy();
  fireEvent.press(payment.getByText('Confirm payment'));
  expect(await payment.findByText('Saved')).toBeTruthy();
  payment.unmount();

  const match = renderWithProviders(<PaymentMatchReviewScreen matchId="match-payment-car" />);
  expect(await match.findByText('Clear match')).toBeTruthy();
  fireEvent.press(match.getByText('Match payment: Car installment'));
  expect(await match.findByText('Resolved')).toBeTruthy();
  match.unmount();
});
