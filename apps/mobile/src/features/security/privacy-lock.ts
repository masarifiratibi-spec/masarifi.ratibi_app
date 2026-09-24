import type { PrivacyLockPreference } from '@/domain/app-shell';

export function createBiometricLock(): PrivacyLockPreference {
  return {
    pinConfigured: false,
    biometricStatus: 'enabled',
    autoLockDuration: 'immediate',
    invalidAttempts: 0,
    lockedUntil: null,
    appLockStatus: 'unlocked'
  };
}
