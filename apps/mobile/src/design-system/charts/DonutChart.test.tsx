import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { DonutChart } from './DonutChart';

describe('DonutChart', () => {
  it('renders five segments maximum with labels and non-color cues', () => {
    const screen = renderWithProviders(
      <DonutChart
        data={[
          { label: 'Food', value: 50 },
          { label: 'Rent', value: 30 },
          { label: 'Bills', value: 20 },
          { label: 'Transport', value: 10 },
          { label: 'Health', value: 5 },
          { label: 'Other raw', value: 5 }
        ]}
      />
    );

    expect(screen.getByText('Food 50')).toBeTruthy();
    expect(screen.getByText('Other 10')).toBeTruthy();
    expect(screen.queryByText('Other raw 5')).toBeNull();
  });
});
