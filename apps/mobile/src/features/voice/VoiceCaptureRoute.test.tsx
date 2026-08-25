import React from 'react';
import { screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AddRoute from '../../../app/(tabs)/add';
import { HomeQuickActions } from '@/features/home/HomeQuickActions';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({})
}));
beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps Add manual without exposing the legacy dedicated Voice route', () => {
  expect(typeof AddRoute).toBe('function');
  renderWithProviders(<HomeQuickActions />);
  expect(screen.queryByText(translate('coreFinance.action.voice'))).toBeNull();
  expect(router.push).not.toHaveBeenCalledWith('/(tabs)/voice');
});
