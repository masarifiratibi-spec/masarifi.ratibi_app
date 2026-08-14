import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ObligationDetailScreen } from './ObligationDetailScreen';
import { ObligationForm } from './ObligationForm';
import { ObligationOverviewScreen } from './ObligationOverviewScreen';

it('renders obligation overview, form, and detail states', async () => {
  changeLocale('en');
  const form = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(await form.findByLabelText('Title'), 'Home appliance');
  fireEvent.changeText(form.getByLabelText('Contracted total'), '1200');
  fireEvent.changeText(form.getByLabelText('Installment amount'), '100');
  fireEvent.changeText(form.getByLabelText('Number of installments'), '12');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  form.unmount();

  const overview = renderWithProviders(<ObligationOverviewScreen />);
  expect(await overview.findByText('Home appliance')).toBeTruthy();
  overview.unmount();

  const detail = renderWithProviders(<ObligationDetailScreen obligationId="obligation-car" />);
  expect(await detail.findByText('Car installment')).toBeTruthy();
  fireEvent.press(detail.getByText('Pause obligation'));
  expect(await detail.findByText('Paused')).toBeTruthy();
  detail.unmount();
});
