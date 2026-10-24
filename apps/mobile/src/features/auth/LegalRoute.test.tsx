import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderWithProviders } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import LegalRoute from '@app/(public)/legal';

jest.mock('expo-router', () => ({ router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

it('returns a root-opened legal screen to app entry without an invalid back action', () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  renderWithProviders(<LegalRoute />);
  fireEvent.press(screen.getByRole('button', { name: translate('appShell.navigation.back') }));
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('preserves the previous screen when legal has navigation history', () => {
  jest.mocked(router.canGoBack).mockReturnValue(true);
  renderWithProviders(<LegalRoute />);
  fireEvent.press(screen.getByRole('button', { name: translate('appShell.navigation.back') }));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});
