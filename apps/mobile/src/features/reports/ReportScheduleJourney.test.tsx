import React from 'react';

import { fireEvent, waitFor } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ReportScheduleScreen } from './ReportScheduleScreen';

test('schedule journey verifies an editable recipient before activation', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<ReportScheduleScreen />);

  expect(await screen.findByLabelText(/Monthly selected/)).toBeTruthy();
  fireEvent.changeText(await screen.findByLabelText('Recipient email'), 'reports@example.com');
  fireEvent.press(screen.getByText('Verify email'));
  expect(await screen.findByText('Email verified')).toBeTruthy();
  fireEvent.press(screen.getByText('Save schedule'));
  expect(await screen.findByText('Schedule active')).toBeTruthy();
  expect(screen.getByText('Covered period: Monthly')).toBeTruthy();
  fireEvent.press(screen.getByText('Detailed transactions'));
  expect(screen.getByText('Detailed email includes transaction rows and leaves the app.')).toBeTruthy();
  fireEvent.press(screen.getByText('Pause schedule'));
  await waitFor(() => expect(screen.getByText('Schedule paused')).toBeTruthy());
});
