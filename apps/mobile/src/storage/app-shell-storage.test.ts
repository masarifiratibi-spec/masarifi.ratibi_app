import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAppShellStore } from '@/state/app-shell';
import { restoreAppShellSession } from '@/features/auth/session-controller';
import { syncFirstLogout } from '@/services/sync-first-logout';
import type { AuthService } from '@/services/contracts/app-shell-service';

import {
  clearAppShellStorageOwner,
  clearAppShellUserData,
  configureAppShellStorageOwner,
  createAppShellStorage,
  cacheLocalOwnerAccess,
  loadLocalOwnerAccess,
  clearLocalOwnerAccess
} from './app-shell-storage';
import type {
  AuthenticationSession,
  KeywordRule,
  OnboardingProgress,
  PrivacyLockPreference,
  TrackingPreference
} from '@/domain/app-shell';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn()
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
    value.includes('owner-b') ? 'b'.repeat(64) : 'a'.repeat(64)
  )
}));

const secureGet = jest.mocked(SecureStore.getItemAsync);
const secureSet = jest.mocked(SecureStore.setItemAsync);
const secureDelete = jest.mocked(SecureStore.deleteItemAsync);
const asyncGet = jest.mocked(AsyncStorage.getItem);
const asyncSet = jest.mocked(AsyncStorage.setItem);
const asyncRemove = jest.mocked(AsyncStorage.removeItem);
const session: AuthenticationSession = {
  status: 'authenticated',
  userId: 'mock-user',
  method: 'phone',
  issuedAt: 10,
  expiresAt: 20,
  restoration: 'restored'
};

const onboarding: OnboardingProgress = {
  platformPath: 'android',
  status: 'in_progress',
  completedSteps: ['tracking_intro'],
  skippedSteps: [],
  currentStep: 'permission_education',
  permissionEducationSeen: false,
  trackingPreference: null,
  updatedAt: 10
};

const keyword: KeywordRule = {
  id: 'kw-1',
  group: 'expense',
  language: 'en',
  value: 'Grocery',
  normalizedValue: 'grocery',
  origin: 'default',
  enabled: true
};

const tracking: TrackingPreference = {
  mode: 'automatic_clear',
  selectedAt: 10,
  isRecommended: true
};

const lock: PrivacyLockPreference = {
    enabled: true,
    autoLockDuration: 'immediate',
    appLockStatus: 'locked'
};

beforeEach(() => {
  clearAppShellStorageOwner();
  jest.clearAllMocks();
  secureGet.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createAppShellStorage', () => {
  it.each(['digest'] as const)(
    'does not restore owner access when %s finishes after unavailable-session suspension',
    async (stage) => {
      let finish!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      if (stage === 'digest')
        jest.mocked(Crypto.digestStringAsync).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = () => resolve('b'.repeat(64));
              entered();
            })
        );
      else
        secureGet.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = () => resolve(null);
              entered();
            })
        );
      await AsyncStorage.setItem(
        'masarifi.appShell.pendingDestination',
        '/welcome'
      );
      await AsyncStorage.setItem(
        `masarifi.appShell.pendingDestination.${'b'.repeat(24)}`,
        '/private'
      );
      const configuring = configureAppShellStorageOwner('owner-b');
      await started;
      process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
      jest.useFakeTimers();
      useAppShellStore.setState({ session: null });
      try {
        const auth = {
          restoreSession: () => new Promise(() => undefined)
        } as AuthService;
        const restoring = restoreAppShellSession(auth);
        const rejected = expect(restoring).rejects.toMatchObject({
          code: 'provider_unavailable',
          failureSource: 'timeout'
        });
        await jest.advanceTimersByTimeAsync(30_000);
        await rejected;
      } finally {
        jest.useRealTimers();
        delete process.env.EXPO_PUBLIC_CLIENT_MODE;
      }
      finish();
      await configuring;
      expect(await createAppShellStorage().loadPendingDestination()).toBe(
        '/welcome'
      );
    }
  );
  it('clears every native app-shell user record', async () => {
    await clearAppShellUserData();

    for (const key of [
      'masarifi.appShell.onboarding',
      'masarifi.appShell.keywords',
      'masarifi.appShell.trackingPreference',
      'masarifi.appShell.pendingDestination',
      'masarifi.appShell.profilePromptDismissed',
      'masarifi.appShell.trackingHomeCardDismissed'
    ]) {
      expect(asyncRemove).toHaveBeenCalledWith(key);
    }
    for (const key of [
      'masarifi.appShell.session',
      'masarifi.appShell.privacyLock',
      'masarifi.appShell.pinCredential'
    ]) {
      expect(secureDelete).toHaveBeenCalledWith(key);
    }
  });

  it('clears web fallback app-shell user records without SecureStore', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      await clearAppShellUserData();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform
      });
    }

    expect(asyncRemove).toHaveBeenCalledWith(
      'masarifi.appShell.preview.session'
    );
    expect(asyncRemove).toHaveBeenCalledWith(
      'masarifi.appShell.preview.privacyLock'
    );
    expect(asyncRemove).toHaveBeenCalledWith(
      'masarifi.appShell.preview.masarifi.appShell.pinCredential'
    );
    expect(secureDelete).not.toHaveBeenCalled();
  });

  it('stores native session and native lock preferences in SecureStore', async () => {
    const storage = createAppShellStorage();

    await storage.saveSession(session);
    await storage.savePrivacyLock(lock);
    await storage.clearSession();

    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.session',
      JSON.stringify(session)
    );
    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.nativePrivacyLock.v1',
      JSON.stringify(lock)
    );
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.session');
    expect(asyncSet).not.toHaveBeenCalledWith(
      'masarifi.appShell.session',
      expect.any(String)
    );
  });

  it('stores non-sensitive shell records in AsyncStorage', async () => {
    const storage = createAppShellStorage();

    await storage.saveOnboarding(onboarding);
    await storage.saveKeywords([keyword]);
    await storage.saveTrackingPreference(tracking);
    await storage.saveProfilePromptDismissed(true);
    await storage.saveTrackingHomeCardDismissed(true);
    await storage.savePendingDestination('/(tabs)/home');
    await storage.savePendingDestination(null);

    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.onboarding',
      JSON.stringify(onboarding)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.keywords',
      JSON.stringify([keyword])
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.trackingPreference',
      JSON.stringify(tracking)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.profilePromptDismissed',
      JSON.stringify(true)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.trackingHomeCardDismissed',
      JSON.stringify(true)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.pendingDestination',
      '/(tabs)/home'
    );
    expect(asyncRemove).toHaveBeenCalledWith(
      'masarifi.appShell.pendingDestination'
    );
  });

  it('uses distinct owner namespaces for local shell records', async () => {
    const storage = createAppShellStorage();
    await configureAppShellStorageOwner('user_owner-a');
    await storage.savePendingDestination('/reports');
    const ownerAKey = asyncSet.mock.calls.at(-1)?.[0];

    await configureAppShellStorageOwner('user_owner-b');
    await storage.savePendingDestination('/tracking');
    const ownerBKey = asyncSet.mock.calls.at(-1)?.[0];

    expect(ownerAKey).not.toBe(ownerBKey);
    expect(ownerAKey).toMatch(/^masarifi\.appShell\.pendingDestination\./);
    expect(ownerBKey).toMatch(/^masarifi\.appShell\.pendingDestination\./);
  });

  it('isolates the tracking-card dismissal between authenticated owners', async () => {
    const storage = createAppShellStorage();
    await configureAppShellStorageOwner('user_owner-a');
    await storage.saveTrackingHomeCardDismissed(true);
    const ownerAKey = asyncSet.mock.calls.at(-1)?.[0];

    await configureAppShellStorageOwner('user_owner-b');
    await storage.saveTrackingHomeCardDismissed(true);
    const ownerBKey = asyncSet.mock.calls.at(-1)?.[0];

    expect(ownerAKey).not.toBe(ownerBKey);
    expect(ownerAKey).toMatch(
      /^masarifi\.appShell\.trackingHomeCardDismissed\./
    );
    expect(ownerBKey).toMatch(
      /^masarifi\.appShell\.trackingHomeCardDismissed\./
    );
  });

  it('returns null or empty defaults for missing and corrupt records', async () => {
    const storage = createAppShellStorage();
    secureGet.mockResolvedValue('{bad json');
    asyncGet.mockResolvedValue('{bad json');

    await expect(storage.loadSession()).resolves.toBeNull();
    await expect(storage.loadOnboarding()).resolves.toBeNull();
    await expect(storage.loadKeywords()).resolves.toEqual(defaultKeywordRules);
    await expect(storage.loadTrackingPreference()).resolves.toBeNull();
    await expect(storage.loadPrivacyLock()).rejects.toThrow();
    await expect(storage.loadProfilePromptDismissed()).resolves.toBe(false);
    await expect(storage.loadTrackingHomeCardDismissed()).resolves.toBe(false);
  });

  it('uses explicit AsyncStorage preview fallback on web', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web'
    });
    const storage = createAppShellStorage();

    try {
      await storage.saveSession(session);
      await storage.savePrivacyLock(lock);
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform
      });
    }

    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.preview.session',
      JSON.stringify(session)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.preview.masarifi.appShell.nativePrivacyLock.v1',
      JSON.stringify(lock)
    );
    expect(secureSet).not.toHaveBeenCalled();
  });
});

it('serializes cached-owner writes so a delayed previous owner cannot replace current admission', async () => {
  const values = new Map<string, string>();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  secureSet.mockImplementation(async (key, value) => {
    if (key === 'masarifi.appShell.localOwner.v1' && first) {
      first = false;
      entered();
      await delayed;
    }
    values.set(key, value);
  });
  secureGet.mockImplementation(async (key) => values.get(key) ?? null);
  secureDelete.mockImplementation(async (key) => {
    values.delete(key);
  });
  try {
    await configureAppShellStorageOwner('user_owner-a');
    const a = cacheLocalOwnerAccess({ ...session, userId: 'user_owner-a' });
    await started;
    await configureAppShellStorageOwner('user_owner-b');
    const b = cacheLocalOwnerAccess({ ...session, userId: 'user_owner-b' });
    release();
    await Promise.all([a, b]);
    expect((await loadLocalOwnerAccess())?.userId).toBe('user_owner-b');
    await clearLocalOwnerAccess();
    expect(await loadLocalOwnerAccess()).toBeNull();
  } finally {
    secureSet.mockReset();
    secureGet.mockReset();
    secureDelete.mockReset();
  }
});

it('T04 interrupted accepted logout does not readmit cached owner after provider signout and purge failure', async () => {
  const previousMode = process.env.EXPO_PUBLIC_CLIENT_MODE;
  const previousDemo = process.env.EXPO_PUBLIC_DEMO_MODE;
  const values = new Map<string, string>();
  secureSet.mockImplementation(async (key, value) => { values.set(key, value); });
  secureGet.mockImplementation(async (key) => values.get(key) ?? null);
  secureDelete.mockImplementation(async (key) => { values.delete(key); });
  const owner = 'user_interrupted_logout';
  let providerSignedOut = false;
  try {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    process.env.EXPO_PUBLIC_DEMO_MODE = '0';
    await configureAppShellStorageOwner(owner);
    const storage = createAppShellStorage();
    await storage.savePrivacyLock(lock);
    await cacheLocalOwnerAccess({ ...session, userId: owner, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 });
    await expect(syncFirstLogout({
      logout: { ownerId: owner, sessionId: 'session-original', scope: 'local' },
      synchronize: async () => { throw new Error('offline'); },
      pending: async () => 1,
      confirmRemoval: async () => true,
      assertCurrent: () => undefined,
      signOut: async () => { providerSignedOut = true; },
      purge: async () => { throw new Error('PURGE_INTERRUPTED'); }
    })).rejects.toThrow('PURGE_INTERRUPTED');
    expect(providerSignedOut).toBe(true);
    // Reconstruct volatile shell/owner state; preserve the actual storage boundary.
    useAppShellStore.getState().reset();
    clearAppShellStorageOwner();
    await useAppShellStore.getState().hydrate();
    expect(useAppShellStore.getState().session?.userId).not.toBe(owner);
  } finally {
    if (previousMode === undefined) delete process.env.EXPO_PUBLIC_CLIENT_MODE; else process.env.EXPO_PUBLIC_CLIENT_MODE = previousMode;
    if (previousDemo === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE; else process.env.EXPO_PUBLIC_DEMO_MODE = previousDemo;
    useAppShellStore.getState().reset();
    clearAppShellStorageOwner();
  }
});
