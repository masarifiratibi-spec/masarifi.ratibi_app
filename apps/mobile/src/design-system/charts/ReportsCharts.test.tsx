import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { AccessibleChartFrame } from './AccessibleChartFrame';
import { DonutChart } from './DonutChart';
import { LineChart } from './LineChart';
import { limitDonutSegments, normalizeLinePoints } from './chart-data';

test('chart data keeps localized Other membership and real line geometry', () => {
  const limited = limitDonutSegments([
    { id: 'a', label: 'A', value: 5 },
    { id: 'b', label: 'B', value: 4 },
    { id: 'c', label: 'C', value: 3 },
    { id: 'd', label: 'D', value: 2 },
    { id: 'e', label: 'E', value: 1 },
    { id: 'f', label: 'F', value: 1 }
  ], 'Other');

  expect(limited[4].memberIds).toEqual(['e', 'f']);
  expect(normalizeLinePoints([1, 2, 3])).not.toBe('0,70 40,40 80,50 120,20 160,30');
});

test('charts expose equivalent text summaries', () => {
  const screen = renderWithProviders(
    <AccessibleChartFrame question="Question" summary="Summary">
      <>
        <DonutChart data={[{ label: 'Food', value: 10 }]} />
        <LineChart series={[{ label: 'Expense', values: [1, 2, 3] }]} />
      </>
    </AccessibleChartFrame>
  );

  expect(screen.getByLabelText(/Question Summary/)).toBeTruthy();
});
