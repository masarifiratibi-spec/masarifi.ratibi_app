import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { PlanningHomeCard } from './PlanningHomeCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('hides budgets and goals while keeping salary and obligations available', async () => {
  renderWithProviders(<PlanningHomeCard />);

  expect(
    await screen.findByText(translate('coreFinance.home.financialProgress'))
  ).toBeTruthy();
  expect(screen.queryByText(translate('planning.budgets.title'))).toBeNull();
  expect(screen.queryByText(translate('planning.savings.title'))).toBeNull();
  fireEvent.press(screen.getByText(translate('planning.salary.title')));
  expect(router.push).toHaveBeenCalledWith('/salary');
  fireEvent.press(screen.getByText(translate('planning.obligations.title')));
  expect(router.push).toHaveBeenCalledWith('/obligations');
});
