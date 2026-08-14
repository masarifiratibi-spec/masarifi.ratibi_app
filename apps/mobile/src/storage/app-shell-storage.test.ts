import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createAppShellStorage } from './app-shell-storage';
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
  pinConfigured: true,
  biometricStatus: 'disabled',
  autoLockDuration: 'immediate',
  invalidAttempts: 0,
  lockedUntil: null,
  appLockStatus: 'locked'
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createAppShellStorage', () => {
  it('stores native session and privacy lock records in SecureStore', async () => {
    const storage = createAppShellStorage();

    await storage.saveSession(session);
    await storage.savePrivacyLock(lock);
    await storage.savePinCredential('pin:123456');
    await storage.clearSession();
    await storage.clearPrivacyLock();
    await storage.clearPinCredential();

    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.session',
      JSON.stringify(session)
    );
    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.privacyLock',
      JSON.stringify(lock)
    );
    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.pinCredential',
      JSON.stringify('pin:123456')
    );
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.session');
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.privacyLock');
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.pinCredential');
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
      'masarifi.appShell.pendingDestination',
      '/(tabs)/home'
    );
    expect(asyncRemove).toHaveBeenCalledWith(
      'masarifi.appShell.pendingDestination'
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
    await expect(storage.loadPrivacyLock()).resolves.toBeNull();
    await expect(storage.loadPinCredential()).resolves.toBeNull();
    await expect(storage.loadProfilePromptDismissed()).resolves.toBe(false);
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
      'masarifi.appShell.preview.privacyLock',
      JSON.stringify(lock)
    );
    expect(secureSet).not.toHaveBeenCalled();
  });
});
