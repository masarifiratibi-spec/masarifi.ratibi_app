import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { readBankSmsSetup } from '@/services/platform/bank-sms-setup.ios';

import { changeLocale, translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { HomeTrackingEntry } from './HomeTrackingEntry.ios';

jest.mock('@/services/platform/bank-sms-setup.ios', () => ({
  readBankSmsSetup: jest.fn()
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));
const readStatus = jest.mocked(readBankSmsSetup);

beforeEach(() => {
  jest.clearAllMocks();
  readStatus.mockReset().mockResolvedValue({ enabled: false, pending: 0, setupCompleted: false });
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
] as const)('opens the setup guide from the %s %s Home card without activating tracking', async (locale, theme) => {
  changeLocale(locale);
  usePreferenceStore.setState({ theme });
  const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
  renderWithProviders(<HomeTrackingEntry />);
  await act(async () => { await Promise.resolve(); });

  expect(screen.getByText(translate('tracking.bankSms.homeTitle'))).toBeOnTheScreen();
  expect(screen.getByText(translate('tracking.bankSms.homeBody'))).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getAllByTestId('ios-tracking-home-card')).toHaveLength(1);
  expect(screen.queryByTestId('home-setup-cards-rail')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: translate('tracking.bankSms.homeAction') }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith('/capture/ios');
});

it('keeps the card visible after consent until all guide steps are completed', async () => {
  readStatus.mockResolvedValue({ enabled: true, pending: 0, setupCompleted: false });
  renderWithProviders(<HomeTrackingEntry />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByTestId('ios-tracking-home-card')).toBeOnTheScreen();
});

it('hides the completed setup after a fresh mount and shows it again if tracking is disabled', async () => {
  readStatus.mockResolvedValue({ enabled: true, pending: 0, setupCompleted: true });
  const listener = jest.spyOn(AppState, 'addEventListener');
  renderWithProviders(<HomeTrackingEntry />);
  await waitFor(() => expect(screen.queryByTestId('ios-tracking-home-card')).toBeNull());
  readStatus.mockResolvedValue({ enabled: false, pending: 0, setupCompleted: true });
  await act(async () => {
    for (const [event, onChange] of listener.mock.calls)
      if (event === 'change') onChange('active');
  });
  expect(screen.getByTestId('ios-tracking-home-card')).toBeOnTheScreen();
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
