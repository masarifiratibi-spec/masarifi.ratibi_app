import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { TransactionRow } from './TransactionRow';

describe('transaction row', () => {
  it('renders source, financial meaning, status, metadata, and amount', () => {
    const screen = renderWithProviders(
      <TransactionRow
        title="Market"
        category="Groceries"
        date="6 Aug"
        account="Main account"
        source="Manual"
        meaning="expense"
        statusLabel="Needs review"
        amount={85}
        currency="EGP"
      />
    );

    expect(screen.getByText('Market')).toBeTruthy();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('6 Aug')).toBeTruthy();
    expect(screen.getByText('Main account')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.getByText('•••• EGP')).toBeTruthy();
  });
});
