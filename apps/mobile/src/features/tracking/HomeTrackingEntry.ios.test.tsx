import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { changeLocale, translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { HomeTrackingEntry } from './HomeTrackingEntry.ios';

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  useAppShellStore.setState({
    profileSetupStatus: 'complete',
    session: {
      status: 'authenticated',
      userId: 'ios-home-owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: Date.now() + 60000,
      restoration: 'restored'
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  changeLocale('ar');
  usePreferenceStore.setState({ theme: 'system' });
});

it.each([
  ['ar', 'light'],
  ['ar', 'dark'],
  ['en', 'light'],
  ['en', 'dark']
] as const)('opens the setup guide from the %s %s Home card without activating tracking', (locale, theme) => {
  changeLocale(locale);
  usePreferenceStore.setState({ theme });
  const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
  renderWithProviders(<HomeTrackingEntry />);

  expect(screen.getByText(translate('tracking.bankSms.homeTitle'))).toBeOnTheScreen();
  expect(screen.getByText(translate('tracking.bankSms.homeBody'))).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: translate('tracking.bankSms.homeAction') }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith('/capture/ios');
});

it('keeps setup private until sign-in and profile setup are complete', () => {
  useAppShellStore.setState({ profileSetupStatus: 'unknown' });
  const view = renderWithProviders(<HomeTrackingEntry />);
  expect(screen.queryByTestId('ios-tracking-home-card')).toBeNull();
  view.unmount();
  useAppShellStore.setState({ profileSetupStatus: 'complete', session: null });
  renderWithProviders(<HomeTrackingEntry />);
  expect(screen.queryByTestId('ios-tracking-home-card')).toBeNull();
});
