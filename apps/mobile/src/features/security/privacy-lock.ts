import {
  pinCredentialSchema,
  type PinCredential,
  type PrivacyLockPreference
} from '@/domain/app-shell';
import { getRandomBytesAsync } from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const pinCredentialVersion = 'pbkdf2-sha256';
const pinKdfIterations = 120_000;
const pinSaltBytes = 16;
const pinHashBytes = 32;

type PinCredentialResult =
  { credential: PinCredential } | { error: 'invalid' | 'mismatch' };

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function createPinCredential(
  pin: string,
  confirmation: string,
  randomBytes: (length: number) => Promise<Uint8Array> = getRandomBytesAsync
): Promise<PinCredentialResult> {
  if (!isValidPin(pin)) return { error: 'invalid' };
  if (pin !== confirmation) return { error: 'mismatch' };

  const salt = await randomBytes(pinSaltBytes);
  const hash = await derivePinHash(pin, salt, pinKdfIterations);
  return {
    credential: `${pinCredentialVersion}:${pinKdfIterations}:${bytesToHex(salt)}:${bytesToHex(hash)}`
  };
}

export async function verifyPin(
  pin: string,
  credential: PinCredential
): Promise<boolean> {
  if (!isValidPin(pin) || !pinCredentialSchema.safeParse(credential).success)
    return false;

  const [, iterationsText, saltHex, hashHex] = credential.split(':');
  const actual = await derivePinHash(
    pin,
    hexToBytes(saltHex),
    Number(iterationsText)
  );
  return constantTimeEqual(actual, hexToBytes(hashHex));
}

async function derivePinHash(
  pin: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, pin, salt, {
    c: iterations,
    dkLen: pinHashBytes,
    asyncTick: 10
  });
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

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

export function createPinLock(_now = Date.now()): PrivacyLockPreference {
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
