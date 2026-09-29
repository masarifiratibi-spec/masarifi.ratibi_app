import { useAppShellStore } from './app-shell';
import { resetLocalUserData } from '@/storage/local-data-reset';
import { registerRuntimeIdentityReset } from '@/storage/runtime-user-data-reset';
import { usePreferenceStore } from './preferences';
import * as database from '@/storage/database';
import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  AuthenticationSession,
  OnboardingProgress,
  PinCredential,
  PrivacyLockPreference
} from '@/domain/app-shell';

jest.mock('@/storage/local-data-reset', () => ({
  resetLocalUserData: jest.fn(async () => ({
    deletedRows: 0,
    operationId: 'unused'
  }))
}));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn()
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'a'.repeat(64))
}));

const secureGet = jest.mocked(SecureStore.getItemAsync);

const liveSession: AuthenticationSession = {
  status: 'authenticated',
  userId: 'user_live_123456',
  method: 'google',
  issuedAt: 1_000,
  expiresAt: 61_000,
  restoration: 'restored'
};
const onboarding: OnboardingProgress = {
  platformPath: 'android',
  status: 'in_progress',
  completedSteps: ['tracking_intro'],
  skippedSteps: [],
  currentStep: 'permission_education',
  permissionEducationSeen: true,
  trackingPreference: null,
  updatedAt: 1_000
};
const credential =
  `pbkdf2-sha256:120000:${'01'.repeat(16)}:${'ab'.repeat(32)}` as PinCredential;
const pinLock: PrivacyLockPreference = {
  pinConfigured: true,
  biometricStatus: 'enabled',
  autoLockDuration: 'immediate',
  invalidAttempts: 0,
  lockedUntil: null,
  appLockStatus: 'unlocked'
};

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_DEMO_MODE;
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  jest.clearAllMocks();
  secureGet.mockResolvedValue(null);
  useAppShellStore.getState().reset();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_CLIENT_MODE;
});

test('rejects a synthetic authenticated session outside demo mode', async () => {
  await expect(
    useAppShellStore.getState().authenticate({
      ...liveSession,
      userId: 'mock-user'
    })
  ).rejects.toThrow('invalid live session');
  expect(useAppShellStore.getState().session).toBeNull();
});

test('sign-out hides the previous owner view while preserving its stored data', async () => {
  await AsyncStorage.setItem(
    'masarifi.tracking.smsImportQueue.v1',
    'private SMS'
  );
  const close = jest
    .spyOn(database, 'clearDatabaseOwner')
    .mockResolvedValue(undefined);
  const clearPrivateCache = jest.fn();
  const unregister = registerRuntimeIdentityReset(clearPrivateCache);
  useAppShellStore.setState({
    hydrated: true,
    session: liveSession,
    onboarding,
    pendingDestination: '/reports'
  });
  usePreferenceStore.setState({ locale: 'ar', baseCurrencyCode: 'SAR' });

  try {
    await useAppShellStore.getState().signOut();
    expect(close).toHaveBeenCalledWith(liveSession.userId);
  } finally {
    unregister();
    close.mockRestore();
  }

  expect(
    await AsyncStorage.getItem('masarifi.tracking.smsImportQueue.v1')
  ).toBeNull();

  expect(resetLocalUserData).not.toHaveBeenCalled();
  expect(clearPrivateCache).toHaveBeenCalledTimes(1);
  expect(usePreferenceStore.getState()).toMatchObject({
    locale: 'ar',
    baseCurrencyCode: 'SAR'
  });
  expect(useAppShellStore.getState()).toMatchObject({
    session: { status: 'signed_out' },
    onboarding: null,
    pendingDestination: null,
    privacyLock: null
  });
});

test('hides the previous owner before switching the live database owner', async () => {
  let releaseOwnerSwitch: (() => void) | undefined;
  const configureOwner = jest
    .spyOn(database, 'configureDatabaseOwner')
    .mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseOwnerSwitch = resolve;
        })
    );
  useAppShellStore.setState({
    hydrated: true,
    session: liveSession,
    onboarding,
    privacyLock: {
      pinConfigured: false,
      biometricStatus: 'enabled',
      autoLockDuration: 'immediate',
      invalidAttempts: 0,
      lockedUntil: null,
      appLockStatus: 'unlocked'
    }
  });

  const switching = useAppShellStore.getState().authenticate({
    ...liveSession,
    userId: 'user_live_654321'
  });
  await waitFor(() => expect(configureOwner).toHaveBeenCalled());

  expect(useAppShellStore.getState()).toMatchObject({
    hydrated: false,
    session: null,
    onboarding: null,
    privacyLock: null
  });

  releaseOwnerSwitch?.();
  await switching;
  configureOwner.mockRestore();
});

test('restores the owner-scoped PIN when authenticating a live session', async () => {
  const ownerSuffix = 'a'.repeat(24);
  secureGet.mockImplementation(async (key) => {
    if (key === `masarifi.appShell.privacyLock.${ownerSuffix}`)
      return JSON.stringify(pinLock);
    if (key === `masarifi.appShell.pinCredential.${ownerSuffix}`)
      return JSON.stringify(credential);
    return null;
  });
  const configureOwner = jest
    .spyOn(database, 'configureDatabaseOwner')
    .mockResolvedValue(undefined);

  try {
    await useAppShellStore.getState().authenticate(liveSession);
  } finally {
    configureOwner.mockRestore();
  }

  expect(useAppShellStore.getState()).toMatchObject({
    session: liveSession,
    pinCredential: credential,
    privacyLock: {
      pinConfigured: true,
      appLockStatus: 'locked'
    }
  });
});
