import { Platform } from 'react-native';
import {
  AndroidImportance,
  getNotificationChannelAsync,
  getPermissionsAsync
} from 'expo-notifications';
import { readTrackingAlertEnabled } from './tracking-alert-status';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { NONE: 2, DEFAULT: 5 },
  getPermissionsAsync: jest.fn(),
  getNotificationChannelAsync: jest.fn()
}));

const originalOS = Platform.OS;
const version = Object.getOwnPropertyDescriptor(Platform, 'Version');
beforeEach(() => {
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 34 });
  jest.resetAllMocks();
});
afterEach(() => {
  Platform.OS = originalOS;
  if (version) Object.defineProperty(Platform, 'Version', version);
  else Reflect.deleteProperty(Platform, 'Version');
});

it.each([
  [false, AndroidImportance.DEFAULT, false],
  [true, AndroidImportance.NONE, false],
  [true, AndroidImportance.DEFAULT, true],
  [true, null, true]
] as const)(
  'permission %p and save channel %p yield %p',
  async (granted, importance, expected) => {
    (getPermissionsAsync as jest.Mock).mockResolvedValue({ granted });
    (getNotificationChannelAsync as jest.Mock).mockResolvedValue(
      importance === null ? null : { importance }
    );
    await expect(readTrackingAlertEnabled()).resolves.toBe(expected);
    if (granted)
      expect(getNotificationChannelAsync).toHaveBeenCalledWith(
        'masarifi-tracking-saved-v1'
      );
    else expect(getNotificationChannelAsync).not.toHaveBeenCalled();
  }
);

it('does not show success when the system read fails', async () => {
  jest.mocked(getPermissionsAsync).mockRejectedValue(new Error('unavailable'));
  await expect(readTrackingAlertEnabled()).resolves.toBe(false);
});
