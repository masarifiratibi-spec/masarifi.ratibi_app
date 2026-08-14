import {
  resolveEntryRoute,
  resolveProtectedAccessGate
} from './resolve-entry-route';
import type {
  AuthenticationSession,
  OnboardingProgress,
  PrivacyLockPreference
} from '@/domain/app-shell';

const authenticatedSession: AuthenticationSession = {
  status: 'authenticated',
  userId: 'mock-user',
  method: 'phone',
  issuedAt: 10,
  expiresAt: 20,
  restoration: 'restored'
};

const unlocked: PrivacyLockPreference = {
  pinConfigured: true,
  biometricStatus: 'disabled',
  autoLockDuration: 'immediate',
  invalidAttempts: 0,
  lockedUntil: null,
  appLockStatus: 'unlocked'
};

const onboardingComplete: OnboardingProgress = {
  platformPath: 'android',
  status: 'completed',
  completedSteps: ['complete'],
  skippedSteps: [],
  currentStep: null,
  permissionEducationSeen: true,
  trackingPreference: null,
  updatedAt: 10
};

describe('resolveEntryRoute', () => {
  it('waits on hydration before every other gate', () => {
    expect(
      resolveEntryRoute({
        hydrated: false,
        now: 15,
        session: authenticatedSession,
        privacyLock: { ...unlocked, appLockStatus: 'locked' },
        onboarding: { ...onboardingComplete, status: 'in_progress' },
        pendingDestination: '/reports'
      })
    ).toBe('/index');
  });

  it('prioritizes account authentication over unlock and onboarding', () => {
    expect(
      resolveEntryRoute({
        hydrated: true,
        now: 15,
        session: null,
        privacyLock: { ...unlocked, appLockStatus: 'locked' },
        onboarding: { ...onboardingComplete, status: 'in_progress' },
        pendingDestination: '/reports'
      })
    ).toBe('/(public)/language');
  });

  it('prioritizes local unlock before incomplete onboarding', () => {
    expect(
      resolveEntryRoute({
        hydrated: true,
        now: 15,
        session: authenticatedSession,
        privacyLock: { ...unlocked, appLockStatus: 'locked' },
        onboarding: { ...onboardingComplete, status: 'in_progress' },
        pendingDestination: '/reports'
      })
    ).toBe('/security/unlock');
    expect(
      resolveEntryRoute({
        hydrated: true,
        now: 15,
        session: authenticatedSession,
        privacyLock: { ...unlocked, appLockStatus: 'temporarily_locked' },
        onboarding: onboardingComplete,
        pendingDestination: '/reports'
      })
    ).toBe('/security/unlock');
  });

  it('opens the earliest incomplete onboarding route before protected targets', () => {
    expect(
      resolveEntryRoute({
        hydrated: true,
        now: 15,
        session: authenticatedSession,
        privacyLock: unlocked,
        onboarding: {
          ...onboardingComplete,
          status: 'in_progress',
          currentStep: 'permission_education'
        },
        pendingDestination: '/reports'
      })
    ).toBe('/(onboarding)/android-sms-permission');
  });

  it('returns valid requested destinations and falls back to Home for invalid links', () => {
    const base = {
      hydrated: true,
      now: 15,
      session: authenticatedSession,
      privacyLock: unlocked,
      onboarding: onboardingComplete
    };

    expect(resolveEntryRoute({ ...base, pendingDestination: '/reports' })).toBe(
      '/reports'
    );
    expect(
      resolveEntryRoute({
        ...base,
        pendingDestination: '/(public)/otp?code=123456'
      })
    ).toBe('/(tabs)/home');
    expect(
      resolveEntryRoute({
        ...base,
        pendingDestination: '/assistant/conversation-1/actions/preview-1'
      })
    ).toBe('/assistant/conversation-1/actions/preview-1');
    expect(resolveEntryRoute({ ...base, pendingDestination: '/support/tickets/ticket-1' })).toBe(
      '/support/tickets/ticket-1'
    );
    expect(
      resolveEntryRoute({ ...base, pendingDestination: 'https://example.com/assistant' })
    ).toBe('/(tabs)/home');
  });

  it('keeps protected destinations behind unlock, then returns the safe destination', () => {
    const base = {
      hydrated: true,
      now: 15,
      session: authenticatedSession,
      onboarding: onboardingComplete,
      pendingDestination: '/notifications'
    };

    expect(
      resolveEntryRoute({ ...base, privacyLock: { ...unlocked, appLockStatus: 'locked' } })
    ).toBe('/security/unlock');
    expect(resolveEntryRoute({ ...base, privacyLock: unlocked })).toBe('/notifications');
    expect(
      resolveEntryRoute({ ...base, privacyLock: unlocked, pendingDestination: '/assistant/otp-123' })
    ).toBe('/(tabs)/home');
  });

  it('rejects an authenticated session after its expiry time', () => {
    expect(
      resolveEntryRoute({
        hydrated: true,
        now: 21,
        session: authenticatedSession,
        privacyLock: unlocked,
        onboarding: onboardingComplete,
        pendingDestination: '/reports'
      })
    ).toBe('/(public)/language');
  });

  it('returns only blocking gates for already-protected layouts', () => {
    const ready = {
      hydrated: true,
      now: 15,
      session: authenticatedSession,
      privacyLock: unlocked,
      onboarding: onboardingComplete,
      pendingDestination: null
    };

    expect(resolveProtectedAccessGate(ready)).toBeNull();
    expect(resolveProtectedAccessGate({ ...ready, session: null })).toBe(
      '/(public)/language'
    );
    expect(
      resolveProtectedAccessGate({
        ...ready,
        privacyLock: { ...unlocked, appLockStatus: 'locked' }
      })
    ).toBe('/security/unlock');
  });
});
