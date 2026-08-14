import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { SavingsGoalDetailScreen } from './SavingsGoalDetailScreen';
import { SavingsGoalForm } from './SavingsGoalForm';
import { SavingsGoalsScreen } from './SavingsGoalsScreen';
import { SavingsMovementForm } from './SavingsMovementForm';

it('creates, pauses, and records progress for savings goals', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false });
  const form = renderWithProviders(<SavingsGoalForm />);
  fireEvent.changeText(await form.findByLabelText('Goal name'), 'Travel fund');
  fireEvent.changeText(form.getByLabelText('Target amount'), '5000');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  form.unmount();

  const overview = renderWithProviders(<SavingsGoalsScreen />);
  expect(await overview.findByText('Travel fund')).toBeTruthy();
  overview.unmount();

  const detail = renderWithProviders(<SavingsGoalDetailScreen goalId="goal-emergency" />);
  expect(await detail.findByText('Emergency fund')).toBeTruthy();
  fireEvent.press(detail.getByText('Pause goal'));
  expect(await detail.findByText('Paused')).toBeTruthy();
  detail.unmount();

  const movement = renderWithProviders(<SavingsMovementForm goalId="goal-emergency" />);
  fireEvent.changeText(await movement.findByLabelText('Movement amount'), '100');
  fireEvent.press(movement.getByText('Review movement'));
  expect(await movement.findByText('100.00 SAR')).toBeTruthy();
  fireEvent.press(movement.getByText('Confirm movement'));
  expect(await movement.findByText('Saved')).toBeTruthy();
  movement.unmount();
});
