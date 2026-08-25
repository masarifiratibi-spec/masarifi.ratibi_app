import React from 'react';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { FinancialHorizonSurface } from './FinancialHorizonSurface';

it('renders reusable gradient artwork behind its content', () => {
  const screen = renderWithProviders(
    <FinancialHorizonSurface>
      <Text>Home</Text>
    </FinancialHorizonSurface>
  );

  expect(screen.getByTestId('financial-horizon-surface')).toBeTruthy();
  expect(screen.getByTestId('financial-horizon-gradient')).toBeTruthy();
  expect(screen.getByText('Home')).toBeTruthy();
});
