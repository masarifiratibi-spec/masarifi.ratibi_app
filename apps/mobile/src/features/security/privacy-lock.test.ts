import { createBiometricLock } from './privacy-lock';

test('creates an enabled biometric lock without a PIN fallback', () => {
  expect(createBiometricLock()).toEqual({
    pinConfigured: false,
    biometricStatus: 'enabled',
    autoLockDuration: 'immediate',
    invalidAttempts: 0,
    lockedUntil: null,
    appLockStatus: 'unlocked'
  });
});
