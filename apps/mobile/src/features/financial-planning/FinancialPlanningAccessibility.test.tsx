import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { PlanningConflictScreen } from './PlanningConflictScreen';

it('exposes explicit conflict actions accessibly', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<PlanningConflictScreen conflictId="conflict-budget-jan" />);
  const keepLocal = await screen.findByLabelText('Keep this device version');
  expect(await screen.findByLabelText('Keep later version')).toBeTruthy();
  fireEvent.press(keepLocal);
  expect(await screen.findByText('Resolved')).toBeTruthy();
});
