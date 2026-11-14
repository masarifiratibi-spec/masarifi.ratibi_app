import React from 'react';
import {
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import { Platform } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { TrackingSetupGuide } from './TrackingSetupGuide';
import { resolveTheme } from '@/design-system/theme';

const originalOS = Platform.OS;
const openSms = jest.fn(async () => undefined);
const openListener = jest.fn(async () => undefined);
const openAlerts = jest.fn(async () => true);
const renderGuide = () =>
  renderWithProviders(
    <TrackingSetupGuide
      smsAvailable
      notificationAvailable
      onOpenSmsSettings={openSms}
      onOpenNotificationSettings={openListener}
      onOpenAlertSettings={openAlerts}
    />
  );
beforeEach(() => {
  Platform.OS = 'android';
  changeLocale('en');
  openSms.mockReset().mockResolvedValue(undefined);
  openListener.mockReset().mockResolvedValue(undefined);
  openAlerts.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  Platform.OS = originalOS;
});

it('keeps the settings shortcut visible while guide steps start collapsed', async () => {
  renderGuide();
  expect(screen.getByTestId('tracking-setup-toggle')).toHaveAccessibilityState({
    expanded: false
  });
  expect(screen.queryByTestId('tracking-guide-sms')).toBeNull();
  fireEvent.press(screen.getByTestId('tracking-alert-settings'));
  await waitFor(() => expect(openAlerts).toHaveBeenCalledTimes(1));
  expect(openListener).not.toHaveBeenCalled();
  expect(openSms).not.toHaveBeenCalled();
});

it.each([
  ['sms', openSms, 'Enable text message tracking'],
  ['notification', openListener, 'Track bank notifications'],
  ['alerts', openAlerts, 'Transaction alerts']
] as const)(
  'opens the %s steps without changing permissions, then routes only its explicit action',
  async (id, action, title) => {
    renderGuide();
    fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
    fireEvent.press(screen.getByTestId(`tracking-guide-${id}`));
    expect(
      within(screen.getByTestId('app-sheet-modal')).getByLabelText(title)
    ).toBeOnTheScreen();
    expect(openSms).not.toHaveBeenCalled();
    expect(openListener).not.toHaveBeenCalled();
    expect(openAlerts).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
      [openSms, openListener, openAlerts].filter((fn) => fn.mock.calls.length)
    ).toHaveLength(1);
  }
);

it('shows settings failures and allows retry without losing the selected steps', async () => {
  openSms.mockRejectedValueOnce(new Error('Unavailable'));
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-sms'));
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  expect(
    await screen.findByText('Could not open settings. Try again.')
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  await waitFor(() =>
    expect(screen.queryByText('Could not open settings. Try again.')).toBeNull()
  );
  expect(openSms).toHaveBeenCalledTimes(2);
});

it('resets restricted-settings help after dismissal and supports system back', () => {
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-sms'));
  fireEvent.press(screen.getByTestId('tracking-restricted-help'));
  expect(
    screen.getByTestId('tracking-restricted-help')
  ).toHaveAccessibilityState({ expanded: true });
  fireEvent(screen.getByTestId('app-sheet-modal'), 'requestClose');
  expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
  fireEvent.press(screen.getByTestId('tracking-guide-sms'));
  expect(
    screen.getByTestId('tracking-restricted-help')
  ).toHaveAccessibilityState({ expanded: false });
  fireEvent.press(
    screen.getByTestId('app-sheet-backdrop', { includeHiddenElements: true })
  );
  expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
});

it('explains Android-only capture on iOS without offering an unusable settings action', () => {
  Platform.OS = 'ios';
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-notification'));
  expect(
    screen.getByText(
      'Text message and bank notification tracking are available on Android.'
    )
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
  expect(openListener).not.toHaveBeenCalled();
});

it('mirrors Arabic rows, uses the selected theme and respects reduced motion', () => {
  changeLocale('ar');
  usePreferenceStore.setState({ theme: 'dark', reducedMotion: true });
  const view = renderGuide();
  expect(screen.getByTestId('tracking-setup-guide')).toHaveStyle({
    backgroundColor: resolveTheme('dark').colors.surfaces.brandSubtle
  });
  expect(screen.getByTestId('tracking-setup-toggle')).toHaveStyle({
    direction: 'ltr',
    flexDirection: 'row-reverse'
  });
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-alerts'));
  expect(screen.getByTestId('app-sheet-modal')).toHaveProp(
    'animationType',
    'none'
  );
  expect(
    within(screen.getByTestId('app-sheet-modal')).getByLabelText(
      'تنبيهات المعاملات'
    )
  ).toBeOnTheScreen();
  view.unmount();
  usePreferenceStore.setState({ theme: 'system', reducedMotion: false });
});

it('explains unavailable web settings instead of reporting a successful permission change', async () => {
  Platform.OS = 'web';
  openAlerts.mockResolvedValue(false);
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-alert-settings'));
  expect(
    await screen.findByText(
      'Open Masarifi on your phone to manage notification settings.'
    )
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-alerts'));
  expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
});

it.each(['sms', 'notification'] as const)(
  'explains unavailable %s capture on Android without opening settings',
  (topic) => {
    renderWithProviders(
      <TrackingSetupGuide
        smsAvailable={false}
        notificationAvailable={false}
        onOpenSmsSettings={openSms}
        onOpenNotificationSettings={openListener}
        onOpenAlertSettings={openAlerts}
      />
    );
    fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
    fireEvent.press(screen.getByTestId(`tracking-guide-${topic}`));
    expect(
      screen.getByText(
        'This tracking source is unavailable in this version of the app.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
    expect(openSms).not.toHaveBeenCalled();
    expect(openListener).not.toHaveBeenCalled();
  }
);
