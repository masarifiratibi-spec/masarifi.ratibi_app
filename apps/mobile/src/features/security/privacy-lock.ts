import type { PrivacyLockPreference } from '@/domain/app-shell';

type PinCredentialResult =
  | { hash: string; error?: never }
  | { error: 'invalid' | 'mismatch'; hash?: never };

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function createPinCredential(
  pin: string,
  confirmation: string
): PinCredentialResult {
  if (!isValidPin(pin)) return { error: 'invalid' as const };
  if (pin !== confirmation) return { error: 'mismatch' as const };
  return { hash: `pin:${pin}` };
}

export function verifyPin(pin: string, expectedHash: string): boolean {
  return isValidPin(pin) && expectedHash === `pin:${pin}`;
}

export function resetLock(_now: number): PrivacyLockPreference {
  return {
    pinConfigured: true,
    biometricStatus: 'disabled',
    autoLockDuration: 'immediate',
    invalidAttempts: 0,
    lockedUntil: null,
    appLockStatus: 'locked'
  };
}

export function failUnlock(
  lock: PrivacyLockPreference,
  now: number
): PrivacyLockPreference {
  const invalidAttempts = Math.min(lock.invalidAttempts + 1, 5);
  return {
    ...lock,
    invalidAttempts,
    lockedUntil: invalidAttempts >= 5 ? now + 30_000 : lock.lockedUntil,
    appLockStatus: invalidAttempts >= 5 ? 'temporarily_locked' : 'locked'
  };
}
