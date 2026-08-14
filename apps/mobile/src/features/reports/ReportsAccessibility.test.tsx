import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { ReportsScreen } from './ReportsScreen';

test('report primary controls expose button roles', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: true });
  const screen = renderWithProviders(<ReportsScreen />);

  expect(await screen.findByLabelText('Schedule')).toBeTruthy();
  expect(await screen.findByLabelText('Preview report')).toBeTruthy();
  expect(screen.queryByText(/416545/)).toBeNull();
  expect(screen.queryByLabelText(/416545/)).toBeNull();
});
