import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { createBiometricService } from './biometric-service';

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
  hasHardwareAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn()
}));

const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = jest.mocked(LocalAuthentication.isEnrolledAsync);
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const cancelAuthentication = jest.mocked(
  LocalAuthentication.cancelAuthenticate
);
const supportedTypes = jest.mocked(
  LocalAuthentication.supportedAuthenticationTypesAsync
);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValue(0);
});

describe('biometric service', () => {
  it('serves deterministic mock availability and results', async () => {
    const service = createMockBiometricService('supported', 'cancelled');
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'supported',
      kinds: ['fingerprint']
    });
    await expect(service.authenticate()).resolves.toEqual({
      status: 'cancelled'
    });
    await expect(service.cancel()).resolves.toBeUndefined();
  });

  it('coalesces concurrent authentication across service instances', async () => {
    let finish!: (result: { success: true }) => void;
    authenticate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const first = createBiometricService().authenticate();
    const second = createBiometricService().authenticate();
    await Promise.resolve();
    await Promise.resolve();
    finish({ success: true });

    await expect(first).resolves.toEqual({ status: 'authenticated' });
    await expect(second).resolves.toEqual({ status: 'authenticated' });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('maps native availability and authentication states', async () => {
    const service = createBiometricService();
    hasHardware.mockResolvedValue(false);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'unsupported'
    });

    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(false);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'not_enrolled'
    });

    isEnrolled.mockResolvedValue(true);
    authenticate.mockResolvedValue({ success: true });
    await expect(service.authenticate()).resolves.toEqual({
      status: 'authenticated'
    });

    authenticate.mockResolvedValue({ success: false, error: 'lockout' });
    await expect(service.authenticate()).resolves.toEqual({
      status: 'locked_out'
    });
  });

  it('cancels explicitly while retaining OS-managed device credential fallback', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    const service = createBiometricService();
    cancelAuthentication.mockResolvedValue();
    authenticate.mockResolvedValue({ success: false, error: 'app_cancel' });

    await expect(service.authenticate()).resolves.toEqual({
      status: 'cancelled'
    });
    expect(cancelAuthentication).not.toHaveBeenCalled();
    await service.cancel();
    expect(cancelAuthentication).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: false, biometricsSecurityLevel: 'strong' }));
    platform.restore();
  });

  it.each(['not_available', 'not_enrolled'] as const)(
    'maps native %s errors to unavailable',
    async (error) => {
      authenticate.mockResolvedValue({ success: false, error });

      await expect(createBiometricService().authenticate()).resolves.toEqual({
        status: 'unavailable'
      });
    }
  );

  it.each(['app_cancel', 'user_cancel', 'system_cancel'] as const)(
    'maps native %s errors to cancelled',
    async (error) => {
      authenticate.mockResolvedValue({ success: false, error });

      await expect(createBiometricService().authenticate()).resolves.toEqual({
        status: 'cancelled'
      });
    }
  );

  it('maps lockout and allows a later retry after the request settles', async () => {
    authenticate
      .mockResolvedValueOnce({ success: false, error: 'lockout' })
      .mockResolvedValueOnce({ success: true });
    const service = createBiometricService();

    await expect(service.authenticate()).resolves.toEqual({
      status: 'locked_out'
    });
    await expect(service.authenticate()).resolves.toEqual({
      status: 'authenticated'
    });
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it('reports the supported biometric kinds when available', async () => {
    const service = createBiometricService();

    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([1, 2]);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'supported',
      kinds: ['fingerprint', 'face'],
      deviceCredential: true
    });

    supportedTypes.mockResolvedValue([2]);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'supported',
      kinds: ['face'],
      deviceCredential: true
    });

    supportedTypes.mockResolvedValue([1]);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'supported',
      kinds: ['fingerprint'],
      deviceCredential: true
    });
  });

  it('omits biometric kinds when hardware is unsupported or not enrolled', async () => {
    const service = createBiometricService();

    hasHardware.mockResolvedValue(false);
    supportedTypes.mockResolvedValue([1, 2]);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'unsupported'
    });

    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(false);
    await expect(service.getAvailability()).resolves.toEqual({
      status: 'not_enrolled'
    });
  });
});


describe('OS-managed App Lock authentication', () => {
  it('permits device credentials in the native system prompt', async () => {
    authenticate.mockResolvedValue({ success: true });
    await expect(createBiometricService().authenticate()).resolves.toEqual({ status: 'authenticated' });
    expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: false, biometricsSecurityLevel: 'strong' }));
  });
  it('supports an Android device credential without enrolled biometrics', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      hasHardware.mockResolvedValue(false);
      isEnrolled.mockResolvedValue(false);
      jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValue(1);
      supportedTypes.mockResolvedValue([]);
      await expect(createBiometricService().getAvailability()).resolves.toEqual({ status: 'supported', kinds: [], deviceCredential: true });
    } finally { platform.restore(); }
  });
  it('keeps missing OS credentials unavailable', async () => {
    authenticate.mockResolvedValue({ success: false, error: 'passcode_not_set' });
    await expect(createBiometricService().authenticate()).resolves.toEqual({ status: 'unavailable' });
  });
});


test('a native prompt started for another owner cannot unlock the next owner', async () => {
  let finish!: (value: { success: true }) => void;
  authenticate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ success: true });
  const first = createBiometricService('owner-a').authenticate();
  const nextOwner = createBiometricService('owner-b');
  const stale = nextOwner.authenticate();
  finish({ success: true });
  await expect(first).resolves.toEqual({ status: 'authenticated' });
  await expect(stale).resolves.toEqual({ status: 'cancelled' });
  await expect(nextOwner.authenticate()).resolves.toEqual({ status: 'authenticated' });
  expect(authenticate).toHaveBeenCalledTimes(2);
});
