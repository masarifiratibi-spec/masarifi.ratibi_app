import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { PlanningConflictScreen } from './PlanningConflictScreen';
import { PlanningState } from './PlanningScaffold';
import { mapPlanningState, retryablePlanningState } from './planning-state';

it('maps degraded planning states honestly', () => {
  expect(mapPlanningState({ loading: true })).toBe('loading');
  expect(mapPlanningState({ error: true })).toBe('error');
  expect(mapPlanningState({ dataState: 'partial' })).toBe('partial');
  expect(mapPlanningState({ conflict: true })).toBe('conflict');
  expect(retryablePlanningState('offline')).toBe(true);
});

it('renders accessible loading, empty, partial, offline, and error states', () => {
  changeLocale('en');
  expect(
    renderWithProviders(
    <PlanningState state="loading" />
  ).getByText('Loading planning')).toBeTruthy();
  expect(
    renderWithProviders(<PlanningState state="empty" />).getByText(
      'No planning records yet'
    )
  ).toBeTruthy();
  expect(
    renderWithProviders(<PlanningState state="partial" />).getByText(
      'Some planning data is incomplete'
    )
  ).toBeTruthy();
  expect(
    renderWithProviders(<PlanningState state="offline" />).getByText(
      'Offline changes stay on this device'
    )
  ).toBeTruthy();
  expect(
    renderWithProviders(<PlanningState state="error" />).getByText(
      'Planning is unavailable'
    )
  ).toBeTruthy();
});

it('renders planning conflict local and later candidates before resolution', async () => {
  changeLocale('en');
  const screen = renderWithProviders(
    <PlanningConflictScreen conflictId="conflict-budget-jan" />
  );

  expect(await screen.findByText('Local version')).toBeTruthy();
  expect(await screen.findByText('Later version')).toBeTruthy();
  expect(await screen.findByLabelText('Keep this device version')).toBeTruthy();
  expect(await screen.findByLabelText('Keep later version')).toBeTruthy();
});
