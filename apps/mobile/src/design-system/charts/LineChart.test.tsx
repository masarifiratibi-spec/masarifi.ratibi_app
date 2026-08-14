import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { LineChart } from './LineChart';

describe('LineChart', () => {
  it('renders four series maximum with line-style labels and RTL-safe summary', () => {
    const screen = renderWithProviders(
      <LineChart
        series={[
          { label: 'Income', values: [1, 2] },
          { label: 'Expense', values: [2, 3] },
          { label: 'Savings', values: [3, 4] },
          { label: 'Debt', values: [4, 5] },
          { label: 'Hidden', values: [5, 6] }
        ]}
      />
    );

    expect(screen.getByText('Income solid')).toBeTruthy();
    expect(screen.getByText('Debt dashDot')).toBeTruthy();
    expect(screen.queryByText('Hidden solid')).toBeNull();
  });
});
