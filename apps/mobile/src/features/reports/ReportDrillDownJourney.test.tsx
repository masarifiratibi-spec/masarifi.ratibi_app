import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { changeLocale } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { renderWithProviders } from '@/test-utils/render';
import { ReportDrillDownScreen } from './ReportDrillDownScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() }
}));

test('drill-down applies visible report filters before opening transactions', async () => {
  changeLocale('en');
  useCoreFinanceViewState.getState().clearFilters();
  const screen = renderWithProviders(<ReportDrillDownScreen />);

  expect(await screen.findByText('Report records')).toBeTruthy();
  expect(await screen.findByText('2026-08-01 - 2026-08-31')).toBeTruthy();
  fireEvent.press(await screen.findByLabelText('Charity'));
  expect(useCoreFinanceViewState.getState().filters.categoryIds).toEqual([
    'charity'
  ]);
  expect(useCoreFinanceViewState.getState().filters.periodStart).not.toBeNull();
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(tabs)/transactions',
    params: { returnTo: '/(tabs)/reports' }
  });
});
