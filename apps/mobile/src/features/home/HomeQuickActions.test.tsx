import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { HomeQuickActions } from './HomeQuickActions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('offers approved Home actions without receipt or camera capture', () => {
  renderWithProviders(<HomeQuickActions />);
  fireEvent.press(screen.getByText(translate('coreFinance.action.expense')));
  expect(router.push).toHaveBeenCalledWith('/(tabs)/add?type=expense');
  expect(screen.queryByText(/Camera|Receipt/)).toBeNull();
});
