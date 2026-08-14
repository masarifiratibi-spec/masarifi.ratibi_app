import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';
import { createTrackingPermissionService } from './tracking-permission-service';
import {
  createAndroidTrackingPermissionService,
  createTrackingPermissionService as createAndroidResolvedTrackingPermissionService
} from './tracking-permission-service.android';

jest.mock('react-native/Libraries/PermissionsAndroid/PermissionsAndroid', () => ({
  PERMISSIONS: { READ_SMS: 'android.permission.READ_SMS' },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again'
  },
  check: jest.fn(),
  request: jest.fn()
}));

describe('tracking permission services', () => {
  it.each([
    ['not_requested', 'request'],
    ['granted', 'continue'],
    ['denied', 'retry'],
    ['permanently_denied', 'open_settings'],
    ['revoked', 'open_settings'],
    ['unavailable', 'continue']
  ] as const)('maps mock %s state to one recovery action', async (status, recoveryAction) => {
    const service = createMockTrackingPermissionService(status);
    await expect(service.getState()).resolves.toMatchObject({
      status,
      recoveryAction
    });
  });

  it('requires education before requesting permission', async () => {
    const service = createMockTrackingPermissionService('not_requested');
    await expect(service.requestAfterEducation(false)).resolves.toMatchObject({
      status: 'not_requested'
    });
    await expect(service.requestAfterEducation(true)).resolves.toMatchObject({
      status: 'granted'
    });
  });

  it('keeps settings recovery non-blocking', async () => {
    const service = createMockTrackingPermissionService('permanently_denied');
    await service.openSettings();
    await expect(service.getState()).resolves.toMatchObject({
      status: 'revoked',
      blocking: false,
      recoveryAction: 'open_settings'
    });
  });

  it('maps iOS and web to unavailable without SMS capability', async () => {
    await expect(createTrackingPermissionService().getState()).resolves.toMatchObject({
      status: 'unavailable',
      recoveryAction: 'continue'
    });
  });

  it('maps Android permission results without reading SMS content', async () => {
    const check = jest.mocked(PermissionsAndroid.check);
    const request = jest.mocked(PermissionsAndroid.request);
    const getItem = jest.mocked(AsyncStorage.getItem);
    check.mockResolvedValue(false);
    getItem.mockResolvedValueOnce(null);
    request.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    const service = createAndroidTrackingPermissionService();

    await expect(service.getState()).resolves.toMatchObject({
      status: 'not_requested'
    });
    await expect(service.requestAfterEducation()).resolves.toMatchObject({
      status: 'permanently_denied'
    });
  });

  it('exports the Android platform factory under the shared service name', async () => {
    jest.mocked(PermissionsAndroid.check).mockResolvedValue(false);
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await expect(
      createAndroidResolvedTrackingPermissionService().getState()
    ).resolves.toMatchObject({ status: 'not_requested' });
  });

  it('recognizes a previously granted Android permission as revoked', async () => {
    jest.mocked(PermissionsAndroid.check).mockResolvedValue(false);
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('granted');

    await expect(
      createAndroidTrackingPermissionService().getState()
    ).resolves.toMatchObject({ status: 'revoked', recoveryAction: 'open_settings' });
  });
});
