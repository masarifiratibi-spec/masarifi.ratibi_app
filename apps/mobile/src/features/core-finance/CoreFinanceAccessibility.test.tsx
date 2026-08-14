import React from 'react';
import { screen } from '@testing-library/react-native';

import { TransactionRow } from '@/design-system/components/financial/TransactionRow';
import { renderWithProviders } from '@/test-utils/render';

it('combines financial row meaning into one accessible announcement and hides values', () => {
  renderWithProviders(
    <TransactionRow
      title="Market"
      category="Food"
      date="8 Aug"
      account="Daily"
      source="Manual"
      meaning="expense"
      statusLabel="Pending"
      amount={10}
      currency="SAR"
    />
  );
  expect(
    screen.getByLabelText('Market, Food, 8 Aug, Daily, Manual, Pending')
  ).toBeTruthy();
  expect(screen.getByText('•••• SAR')).toBeTruthy();
});
