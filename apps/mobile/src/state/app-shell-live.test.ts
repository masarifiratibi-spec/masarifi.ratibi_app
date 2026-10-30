import { useAppShellStore } from './app-shell';
import { resetLocalUserData } from '@/storage/local-data-reset';
import { registerRuntimeIdentityReset } from '@/storage/runtime-user-data-reset';
import { usePreferenceStore } from './preferences';
import * as database from '@/storage/database';
import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { cacheLocalOwnerAccess } from '@/storage/app-shell-storage';
import type {
  AuthenticationSession,
  OnboardingProgress,
  PrivacyLockPreference
} from '@/domain/app-shell';

jest.mock('expo', () => {
  const actual = jest.requireActual('expo');
  return { ...actual, requireOptionalNativeModule: (name: string) => name === 'ExpoApplication' ? { applicationId: 'com.masarifi.mobile.dev' } : actual.requireOptionalNativeModule(name) };
});

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
  `pbkdf2-sha256:120000:${'01'.repeat(16)}:${'ab'.repeat(32)}`;
const pinLock: PrivacyLockPreference = {
    enabled: true,
    autoLockDuration: 'immediate',
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

test('restores only a completed cached real owner behind its configured native App Lock', async () => {
  const values = new Map<string, string>();
  secureGet.mockImplementation(async (key) => values.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      values.set(key, value);
    });
  jest.spyOn(database, 'configureDatabaseOwner').mockResolvedValue(undefined);
  await cacheLocalOwnerAccess(liveSession);
  values.set(
    `masarifi.appShell.pinCredential.${'a'.repeat(24)}`,
    JSON.stringify(credential)
  );
  values.set(
    `masarifi.appShell.privacyLock.${'a'.repeat(24)}`,
    JSON.stringify(pinLock)
  );
  await useAppShellStore.getState().hydrate(100_000);
  expect(useAppShellStore.getState()).toMatchObject({
    hydrated: true,
    session: { userId: liveSession.userId, restoration: 'local' },
    privacyLock: { enabled: true, appLockStatus: 'locked' },
    profileSetupStatus: 'complete'
  });
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
    enabled: true,
    autoLockDuration: 'immediate',
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

test('restores the owner-scoped native lock when authenticating a live session', async () => {
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
    privacyLock: {
    enabled: true,
    appLockStatus: 'locked'
}
  });
});


test.each([{ stored: true, wantEnabled: true }, { stored: false, wantEnabled: false }])('identified DEV hydration opens cached encrypted owner data without persisting a lock change (preference=$stored)', async ({ stored, wantEnabled }) => {
  const previous = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'development', EXPO_PUBLIC_CLIENT_MODE: 'live', EXPO_PUBLIC_APP_VARIANT: 'staging-development', EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' });
  const values = new Map<string, string>();
  secureGet.mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
  const configure = jest.spyOn(database, 'configureDatabaseOwner').mockResolvedValue(undefined);
  try {
    await cacheLocalOwnerAccess(liveSession);
    if (stored) values.set('masarifi.appShell.nativePrivacyLock.v1.' + 'a'.repeat(24), JSON.stringify({ enabled: true, autoLockDuration: 'immediate', appLockStatus: 'locked' }));
    const before = new Map(values);
    expect(jest.requireActual<typeof import('@/config/demo-mode')>('@/config/demo-mode').isDemoModeEnabled()).toBe(false);
    await useAppShellStore.getState().hydrate(100_000);
    expect(useAppShellStore.getState()).toMatchObject({ session: { userId: liveSession.userId, restoration: 'local' }, privacyLock: { enabled: wantEnabled, appLockStatus: 'unlocked' } });
    expect(values).toEqual(before);
    const { captureLiveClerkOwner } = jest.requireActual<typeof import('@/services/live/auth-service')>('@/services/live/auth-service');
    await expect(captureLiveClerkOwner()).resolves.toMatchObject({ userId: liveSession.userId });
  } finally {
    for (const key of ['NODE_ENV', 'EXPO_PUBLIC_CLIENT_MODE', 'EXPO_PUBLIC_APP_VARIANT', 'EXPO_PUBLIC_API_URL']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
    configure.mockRestore();
  }
});
