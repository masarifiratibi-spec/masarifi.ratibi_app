import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { PlanningHomeCard } from './PlanningHomeCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('shows current planning progress and keeps the existing destinations', async () => {
  renderWithProviders(<PlanningHomeCard />);

  expect(
    await screen.findByText(translate('coreFinance.home.financialProgress'))
  ).toBeTruthy();
  await waitFor(() => {
    expect(
      screen.getAllByLabelText(new RegExp(translate('planning.field.progress')))
        .length
    ).toBeGreaterThan(0);
  });

  fireEvent.press(screen.getByText(translate('planning.budgets.title')));
  expect(router.push).toHaveBeenCalledWith('/budgets');
});
