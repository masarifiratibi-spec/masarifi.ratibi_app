import { Linking, Platform } from 'react-native';
import { startActivityAsync } from 'expo-intent-launcher';

import { openTrackingAlertSettings } from './tracking-alert-settings';

jest.mock('expo-application', () => ({
  applicationId: 'com.masarifi.mobile.dev'
}));
jest.mock('expo-intent-launcher', () => ({
  ActivityAction: {
    APP_NOTIFICATION_SETTINGS: 'android.settings.APP_NOTIFICATION_SETTINGS'
  },
  startActivityAsync: jest.fn(async () => ({}))
}));

const originalOS = Platform.OS;
beforeEach(() => {
  Platform.OS = 'android';
  jest.mocked(startActivityAsync).mockResolvedValue({ resultCode: 0 });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
});
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('opens notification display settings for the running Android package', async () => {
  await expect(openTrackingAlertSettings()).resolves.toBe(true);
  expect(startActivityAsync).toHaveBeenCalledWith(
    'android.settings.APP_NOTIFICATION_SETTINGS',
    {
      extra: { 'android.provider.extra.APP_PACKAGE': 'com.masarifi.mobile.dev' }
    }
  );
  expect(Linking.openSettings).not.toHaveBeenCalled();
});

it('falls back to app settings when the device has no notification settings activity', async () => {
  jest.mocked(startActivityAsync).mockRejectedValue(new Error('No activity'));
  await expect(openTrackingAlertSettings()).resolves.toBe(true);
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});

it('opens app settings on iOS without launching an Android intent', async () => {
  Platform.OS = 'ios';
  await expect(openTrackingAlertSettings()).resolves.toBe(true);
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  expect(startActivityAsync).not.toHaveBeenCalled();
});

it('does not open settings on web', async () => {
  Platform.OS = 'web';
  await expect(openTrackingAlertSettings()).resolves.toBe(false);
  expect(Linking.openSettings).not.toHaveBeenCalled();
  expect(startActivityAsync).not.toHaveBeenCalled();
});

it('reports failure if neither system route can open', async () => {
  jest.mocked(startActivityAsync).mockRejectedValue(new Error('No activity'));
  jest
    .mocked(Linking.openSettings)
    .mockRejectedValue(new Error('Settings unavailable'));
  await expect(openTrackingAlertSettings()).rejects.toThrow(
    'Settings unavailable'
  );
});

it('still opens app settings when the installed binary has no intent launcher module', async () => {
  let openSettings: (() => Promise<boolean>) | undefined;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Linking, Platform }));
    jest.doMock('expo-intent-launcher', () => {
      throw new Error('Native module absent');
    });
    openSettings = jest.requireActual<
      typeof import('./tracking-alert-settings')
    >('./tracking-alert-settings').openTrackingAlertSettings;
  });
  await expect(openSettings!()).resolves.toBe(true);
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});
