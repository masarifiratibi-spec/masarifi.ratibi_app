import { Linking, Platform } from 'react-native';
import { startActivityAsync } from 'expo-intent-launcher';

import { openTrackingAutostartSettings } from './tracking-autostart-settings';

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: 0 }))
}));

const originalOS = Platform.OS;
const constants = Platform.constants;
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'constants', {
    configurable: true,
    value: { Manufacturer: 'Xiaomi' }
  });
  jest
    .mocked(startActivityAsync)
    .mockReset()
    .mockResolvedValue({ resultCode: 0 });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
});
afterEach(() => {
  Platform.OS = originalOS;
  Object.defineProperty(Platform, 'constants', {
    configurable: true,
    value: constants
  });
  jest.restoreAllMocks();
});

it.each(['Xiaomi', 'Redmi', 'POCO'])(
  'opens the verified %s autostart page without changing its settings',
  async (manufacturer) => {
    Object.defineProperty(Platform, 'constants', {
      configurable: true,
      value: { Manufacturer: manufacturer }
    });
    await expect(openTrackingAutostartSettings()).resolves.toBe('autostart');
    expect(startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.MAIN',
      expect.objectContaining({
        packageName: 'com.miui.securitycenter',
        className: 'com.miui.permcenter.autostart.AutoStartManagementActivity'
      })
    );
    expect(Linking.openSettings).not.toHaveBeenCalled();
  }
);

it('falls back to app settings when the OEM route is missing or blocked', async () => {
  jest
    .mocked(startActivityAsync)
    .mockRejectedValue(new Error('Activity not exported'));
  await expect(openTrackingAutostartSettings()).resolves.toBe('app_settings');
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});

it('uses app settings on other manufacturers rather than guessing an OEM activity', async () => {
  Object.defineProperty(Platform, 'constants', {
    configurable: true,
    value: { Manufacturer: 'Samsung' }
  });
  await expect(openTrackingAutostartSettings()).resolves.toBe('app_settings');
  expect(startActivityAsync).not.toHaveBeenCalled();
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});

it.each(['ios', 'web'] as const)(
  'reports unavailable on %s without opening settings',
  async (os) => {
    Platform.OS = os;
    await expect(openTrackingAutostartSettings()).resolves.toBe('unavailable');
    expect(startActivityAsync).not.toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  }
);

it('lets the guide report a retryable error when neither route works', async () => {
  jest.mocked(startActivityAsync).mockRejectedValue(new Error('No activity'));
  jest
    .mocked(Linking.openSettings)
    .mockRejectedValue(new Error('Settings unavailable'));
  await expect(openTrackingAutostartSettings()).rejects.toThrow(
    'Settings unavailable'
  );
});
