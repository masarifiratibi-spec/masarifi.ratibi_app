import React from 'react';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { AccessibleChartFrame } from './AccessibleChartFrame';

describe('AccessibleChartFrame', () => {
  it('renders question, summary, empty state, drill-down, and accessible description', () => {
    const onDrillDown = jest.fn();
    const screen = renderWithProviders(
      <AccessibleChartFrame
        question="Where did money go?"
        summary="Food is highest"
        empty={false}
        drillDownLabel="Open food"
        onDrillDown={onDrillDown}
      >
        <Text>Chart body</Text>
      </AccessibleChartFrame>
    );

    expect(screen.getByLabelText('Where did money go? Food is highest')).toBeTruthy();
    expect(screen.getByText('Chart body')).toBeTruthy();
    expect(screen.getByText('Open food')).toBeTruthy();
  });
});
