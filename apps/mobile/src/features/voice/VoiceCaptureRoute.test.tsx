import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AddRoute from '../../../app/(tabs)/add';
import { HomeQuickActions } from '@/features/home/HomeQuickActions';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ mode: 'manual' })
}));

it('exports Add and opens its voice mode from Home', () => {
  expect(typeof AddRoute).toBe('function');
  renderWithProviders(<HomeQuickActions />);
  fireEvent.press(screen.getByText(translate('coreFinance.action.voice')));
  expect(router.push).toHaveBeenCalledWith('/(tabs)/add?mode=voice');
});
