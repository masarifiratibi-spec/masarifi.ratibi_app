import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { changeLocale } from '@/localization/i18n';
import { useReportsViewState } from '@/state/reports-view-state';
import { renderWithProviders } from '@/test-utils/render';
import { ReportsScreen } from './ReportsScreen';

test('reports screen replaces the tab placeholder with period summary actions', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<ReportsScreen />);

  expect(
    await screen.findByText(translate('appShell.tabs.reports'))
  ).toBeTruthy();
  expect(await screen.findByText('Preview report')).toBeTruthy();
  expect(screen.getByText('Savings rate')).toBeTruthy();
  expect(screen.getByText('Largest category')).toBeTruthy();
  expect(screen.getByText('Largest transaction')).toBeTruthy();
  expect(screen.getByText('Explain this report')).toBeTruthy();
  expect(screen.getByText('Why did spending increase?')).toBeTruthy();
  expect(screen.getByText('Where can I save?')).toBeTruthy();
  expect(screen.getByText('Compare this period')).toBeTruthy();
  expect(screen.getByText('Create a saving plan')).toBeTruthy();
});

test('2026-08-10 native regression preserves report scroll context after drill-down navigation', async () => {
  changeLocale('en');
  useReportsViewState.setState({ scrollOffset: 0 });
  const first = renderWithProviders(<ReportsScreen />);
  await first.findByText('Preview report');

  fireEvent(first.UNSAFE_getByType(ScrollView), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 0, y: 640 } }
  });
  expect(useReportsViewState.getState().scrollOffset).toBe(640);
  first.unmount();

  const returned = renderWithProviders(<ReportsScreen />);
  await returned.findByText('Preview report');
  expect(returned.UNSAFE_getByType(ScrollView).props.contentOffset).toEqual({
    x: 0,
    y: 640
  });
});
