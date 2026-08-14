import React from 'react';

import { fireEvent, waitFor } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ReportsScreen } from './ReportsScreen';

test('all required period selectors are visible and selectable', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<ReportsScreen />);

  fireEvent.press(await screen.findByText('3 months'));
  await waitFor(() => expect(screen.getByLabelText('3 months').props.accessibilityState.selected).toBe(true));
  fireEvent.press(screen.getByText('Half-year'));
  await waitFor(() => expect(screen.getByLabelText('Half-year').props.accessibilityState.selected).toBe(true));
  fireEvent.press(screen.getByText('Annual'));
  await waitFor(() => expect(screen.getByLabelText('Annual').props.accessibilityState.selected).toBe(true));
  expect(screen.getByText('Monthly')).toBeTruthy();
  screen.unmount();
});
