import React from 'react';

import { fireEvent } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ReportsScreen } from './ReportsScreen';

test('all approved net worth timeframes are visible and selectable', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<ReportsScreen />);

  await screen.findByText('Net worth');
  for (const timeframe of ['1W', '1M', '3M', '1Y', 'All']) {
    const button = screen.getByRole('button', { name: timeframe });
    fireEvent.press(button);
    expect(button.props.accessibilityState).toEqual({ selected: true });
  }
});
