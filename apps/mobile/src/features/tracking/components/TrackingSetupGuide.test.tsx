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
const enableSms = jest.fn(async () => undefined);
const enableNotifications = jest.fn(async () => undefined);
const openAlerts = jest.fn(async () => true);
const openAutostart = jest.fn<
  Promise<'autostart' | 'app_settings' | 'unavailable'>,
  []
>(async () => 'autostart');
const renderGuide = (
  enabled: { smsEnabled?: boolean; notificationEnabled?: boolean } = {}
) =>
  renderWithProviders(
    <TrackingSetupGuide
      smsAvailable
      notificationAvailable
      smsEnabled={enabled.smsEnabled ?? false}
      notificationEnabled={enabled.notificationEnabled ?? false}
      onEnableSmsTracking={enableSms}
      onEnableNotificationTracking={enableNotifications}
      onOpenAlertSettings={openAlerts}
      onOpenAutostartSettings={openAutostart}
    />
  );
beforeEach(() => {
  Platform.OS = 'android';
  changeLocale('en');
  enableSms.mockReset().mockResolvedValue(undefined);
  enableNotifications.mockReset().mockResolvedValue(undefined);
  openAlerts.mockReset().mockResolvedValue(true);
  openAutostart.mockReset().mockResolvedValue('autostart');
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
  expect(enableNotifications).not.toHaveBeenCalled();
  expect(enableSms).not.toHaveBeenCalled();
});

it.each(['sms', 'notification'] as const)(
  'shows an already enabled %s source as Enabled when its sheet opens',
  (source) => {
    renderGuide({
      smsEnabled: source === 'sms',
      notificationEnabled: source === 'notification'
    });
    fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
    fireEvent.press(screen.getByTestId(`tracking-guide-${source}`));
    const completed = screen.getByRole('button', { name: 'Enabled' });
    expect(completed).toBeDisabled();
    fireEvent.press(completed);
    expect(enableSms).not.toHaveBeenCalled();
    expect(enableNotifications).not.toHaveBeenCalled();
  }
);

it.each([
  ['sms', enableSms, 'Enable text message tracking', 'Enable SMS tracking'],
  [
    'notification',
    enableNotifications,
    'Track bank notifications',
    'Enable bank notification tracking'
  ],
  [
    'alerts',
    openAlerts,
    'Transaction alerts',
    'Open transaction alert settings'
  ]
] as const)(
  'opens the %s steps without changing permissions, then routes only its explicit action',
  async (id, action, title, actionLabel) => {
    renderGuide();
    fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
    fireEvent.press(screen.getByTestId(`tracking-guide-${id}`));
    expect(
      within(screen.getByTestId('app-sheet-modal')).getByLabelText(title)
    ).toBeOnTheScreen();
    expect(enableSms).not.toHaveBeenCalled();
    expect(enableNotifications).not.toHaveBeenCalled();
    expect(openAlerts).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: actionLabel }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
      [enableSms, enableNotifications, openAlerts].filter(
        (fn) => fn.mock.calls.length
      )
    ).toHaveLength(1);
  }
);

it('shows settings failures and allows retry without losing the selected steps', async () => {
  enableSms.mockRejectedValueOnce(new Error('Unavailable'));
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-sms'));
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  expect(
    await screen.findByText('Could not enable tracking. Try again.')
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  await waitFor(() =>
    expect(
      screen.queryByText('Could not enable tracking. Try again.')
    ).toBeNull()
  );
  expect(enableSms).toHaveBeenCalledTimes(2);
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
  expect(enableNotifications).not.toHaveBeenCalled();
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
        smsEnabled={false}
        notificationEnabled={false}
        onEnableSmsTracking={enableSms}
        onEnableNotificationTracking={enableNotifications}
        onOpenAlertSettings={openAlerts}
        onOpenAutostartSettings={openAutostart}
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
    expect(enableSms).not.toHaveBeenCalled();
    expect(enableNotifications).not.toHaveBeenCalled();
  }
);

it('offers autostart as the fourth help topic without making it a tracking prerequisite', async () => {
  renderGuide({ smsEnabled: true, notificationEnabled: true });
  expect(screen.queryByTestId('tracking-guide-autostart')).toBeNull();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  const topics = screen.getAllByTestId(
    /^tracking-guide-(sms|notification|alerts|autostart)$/
  );
  expect(topics.map((topic) => topic.props.testID)).toEqual([
    'tracking-guide-sms',
    'tracking-guide-notification',
    'tracking-guide-alerts',
    'tracking-guide-autostart'
  ]);
  fireEvent.press(screen.getByTestId('tracking-guide-autostart'));
  expect(
    screen.getByText(
      'After restarting your phone, unlock the screen once so tracking can start.'
    )
  ).toBeOnTheScreen();
  expect(openAutostart).not.toHaveBeenCalled();
  fireEvent.press(
    screen.getByRole('button', { name: 'Open autostart settings' })
  );
  await waitFor(() => expect(openAutostart).toHaveBeenCalledTimes(1));
  expect(enableSms).not.toHaveBeenCalled();
  expect(enableNotifications).not.toHaveBeenCalled();
});

it('keeps autostart help browseable while pending admission disables its action', () => {
  renderWithProviders(
    <TrackingSetupGuide
      actionsDisabled
      smsAvailable
      notificationAvailable
      smsEnabled={false}
      notificationEnabled={false}
      onEnableSmsTracking={enableSms}
      onEnableNotificationTracking={enableNotifications}
      onOpenAlertSettings={openAlerts}
      onOpenAutostartSettings={openAutostart}
    />
  );
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-autostart'));
  const action = screen.getByTestId('tracking-guide-open-settings');
  expect(action).toBeDisabled();
  fireEvent.press(action);
  expect(openAutostart).not.toHaveBeenCalled();
});

it('reports an autostart settings failure as an opening error and permits retry', async () => {
  openAutostart.mockRejectedValueOnce(new Error('Settings unavailable'));
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-autostart'));
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  expect(
    await screen.findByText('Could not open settings. Try again.')
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  await waitFor(() =>
    expect(screen.queryByText('Could not open settings. Try again.')).toBeNull()
  );
  expect(openAutostart).toHaveBeenCalledTimes(2);
});

it('explains the manual route when only app settings can open', async () => {
  openAutostart.mockResolvedValueOnce('app_settings');
  renderGuide();
  fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
  fireEvent.press(screen.getByTestId('tracking-guide-autostart'));
  fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
  expect(
    await screen.findByText(
      'App settings opened. Look for Autostart or Background activity; your phone may not have a separate autostart switch.'
    )
  ).toBeOnTheScreen();
});

it.each(['ios', 'web'] as const)(
  'does not offer an Android autostart action on %s',
  (os) => {
    Platform.OS = os;
    renderGuide();
    fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
    fireEvent.press(screen.getByTestId('tracking-guide-autostart'));
    expect(
      screen.getByText('Autostart settings are available on Android only.')
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('tracking-guide-open-settings')).toBeNull();
    expect(openAutostart).not.toHaveBeenCalled();
  }
);
