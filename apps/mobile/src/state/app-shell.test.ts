import { useAppShellStore } from './app-shell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  AuthenticationSession,
  OnboardingProgress,
  PrivacyLockPreference
} from '@/domain/app-shell';

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

const session: AuthenticationSession = {
  status: 'authenticated',
  userId: 'mock-user',
  method: 'google',
  issuedAt: 10,
  expiresAt: 20,
  restoration: 'restored'
};

const onboarding: OnboardingProgress = {
  platformPath: 'android',
  status: 'completed',
  completedSteps: ['complete'],
  skippedSteps: [],
  currentStep: null,
  permissionEducationSeen: true,
  trackingPreference: null,
  updatedAt: 20
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
  useAppShellStore.getState().reset();
  secureGet.mockImplementation(async (key) =>
    key === 'masarifi.appShell.session'
      ? JSON.stringify(session)
      : JSON.stringify(lock)
  );
  asyncGet.mockImplementation(async (key) => {
    if (key === 'masarifi.appShell.onboarding') return JSON.stringify(onboarding);
    if (key === 'masarifi.appShell.pendingDestination') return '/reports';
    return null;
  });
});

describe('useAppShellStore', () => {
  it('hydrates session, onboarding, pending route, and lock atomically', async () => {
    await useAppShellStore.getState().hydrate(15);

    expect(useAppShellStore.getState()).toMatchObject({
      hydrated: true,
      session,
      onboarding,
      pendingDestination: '/reports',
      privacyLock: lock
    });
  });

  it('marks an expired persisted session before protected routes can render', async () => {
    await useAppShellStore.getState().hydrate(21);

    expect(useAppShellStore.getState().session?.status).toBe('expired');
  });

  it('fails closed instead of hanging when secure hydration rejects', async () => {
    secureGet.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await useAppShellStore.getState().hydrate(15);

    expect(useAppShellStore.getState()).toMatchObject({
      hydrated: true,
      session: { status: 'signed_out' },
      pendingDestination: null,
      privacyLock: null
    });
  });

  it('persists authentication, expiry, sign-out, onboarding, route, and lock actions', async () => {
    await useAppShellStore.getState().authenticate(session);
    await useAppShellStore.getState().expireSession();
    await useAppShellStore.getState().setOnboarding(onboarding);
    await useAppShellStore.getState().setTrackingPreference({
      mode: 'automatic_clear',
      selectedAt: 20,
      isRecommended: true
    });
    await useAppShellStore.getState().setPendingDestination('/(tabs)/home');
    await useAppShellStore.getState().setPrivacyLock(lock);
    await useAppShellStore.getState().configurePrivacyLock('pin:123456', 30);
    await useAppShellStore.getState().recordFailedUnlock(40);
    await useAppShellStore.getState().lockNow();
    await useAppShellStore.getState().unlock();
    await useAppShellStore.getState().resetPrivacyLock();
    await useAppShellStore.getState().signOut();

    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.session',
      JSON.stringify(session)
    );
    expect(useAppShellStore.getState().session?.status).toBe('signed_out');
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.onboarding',
      JSON.stringify(onboarding)
    );
    expect(asyncSet).toHaveBeenCalledWith(
      'masarifi.appShell.pendingDestination',
      '/(tabs)/home'
    );
    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.privacyLock',
      JSON.stringify(lock)
    );
    expect(secureSet).toHaveBeenCalledWith(
      'masarifi.appShell.pinCredential',
      JSON.stringify('pin:123456')
    );
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.pinCredential');
    expect(secureDelete).toHaveBeenCalledWith('masarifi.appShell.session');
  });

  it('does not duplicate locale or theme preference state', () => {
    const state = useAppShellStore.getState();

    expect('locale' in state).toBe(false);
    expect('theme' in state).toBe(false);
  });
});
