import * as SecureStore from 'expo-secure-store';
import { privacyLockPreferenceSchema } from '@/domain/app-shell';
import { clearAppShellStorageOwner, configureAppShellStorageOwner, createAppShellStorage } from './app-shell-storage';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: jest.fn(async (_algorithm: string, owner: string) => owner === 'owner-a' ? 'a'.repeat(64) : 'b'.repeat(64)) }));

const legacy = { pinConfigured: true, biometricStatus: 'disabled', autoLockDuration: 'five_minutes', invalidAttempts: 5, lockedUntil: 123456, appLockStatus: 'temporarily_locked' };
const nativeLock = { enabled: true, autoLockDuration: 'five_minutes', appLockStatus: 'locked' } as const;
const suffix = 'a'.repeat(24);
let secureValues: Map<string, string>;

beforeEach(() => {
  clearAppShellStorageOwner();
  jest.clearAllMocks();
  secureValues = new Map();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => secureValues.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { secureValues.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { secureValues.delete(key); });
});

test('legacy PIN lock becomes native lock without retaining application PIN lockout', () => {
  expect(privacyLockPreferenceSchema.parse(legacy)).toEqual(nativeLock);
});

test('native lock schema does not accept a missing or nonboolean enabled preference', () => {
  expect(privacyLockPreferenceSchema.safeParse({ autoLockDuration: 'immediate', appLockStatus: 'locked' }).success).toBe(false);
  expect(privacyLockPreferenceSchema.safeParse({ enabled: 'false', autoLockDuration: 'immediate', appLockStatus: 'locked' }).success).toBe(false);
});

test.each(['invalid legacy secret', 'retained credential bytes'])('compatibility retains existing secrets byte-for-byte: %s', async secret => {
  secureValues.set('masarifi.appShell.privacyLock', JSON.stringify(legacy));
  secureValues.set('masarifi.appShell.pinCredential', secret);
  secureValues.set('masarifi.database.key.retained', 'existing database key');
  const before = new Map(secureValues);
  await configureAppShellStorageOwner('owner-a');
  await expect(createAppShellStorage().loadPrivacyLock()).resolves.toEqual(nativeLock);
  expect(secureValues).toEqual(before);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('explicit owner-native disabled preference wins over a legacy enabled lock', async () => {
  secureValues.set('masarifi.appShell.privacyLock.' + suffix, JSON.stringify(legacy));
  secureValues.set('masarifi.appShell.nativePrivacyLock.v1.' + suffix, JSON.stringify({ enabled: false, autoLockDuration: 'immediate', appLockStatus: 'unlocked' }));
  await configureAppShellStorageOwner('owner-a');
  await expect(createAppShellStorage().loadPrivacyLock()).resolves.toEqual({ enabled: false, autoLockDuration: 'immediate', appLockStatus: 'unlocked' });
});

test('native preference saves in its owner namespace without overwriting legacy material', async () => {
  secureValues.set('masarifi.appShell.privacyLock.' + suffix, JSON.stringify(legacy));
  const legacyBytes = secureValues.get('masarifi.appShell.privacyLock.' + suffix);
  await configureAppShellStorageOwner('owner-a');
  await createAppShellStorage().savePrivacyLock(nativeLock);
  expect(secureValues.get('masarifi.appShell.nativePrivacyLock.v1.' + suffix)).toBe(JSON.stringify(nativeLock));
  expect(secureValues.get('masarifi.appShell.privacyLock.' + suffix)).toBe(legacyBytes);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('owner B cannot inherit owner A native or legacy preference', async () => {
  secureValues.set('masarifi.appShell.nativePrivacyLock.v1.' + suffix, JSON.stringify(nativeLock));
  secureValues.set('masarifi.appShell.privacyLock.' + suffix, JSON.stringify(legacy));
  await configureAppShellStorageOwner('owner-b');
  await expect(createAppShellStorage().loadPrivacyLock()).resolves.toBeNull();
});
