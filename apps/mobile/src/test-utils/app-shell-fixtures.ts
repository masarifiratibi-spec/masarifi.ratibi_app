import type {
  AuthenticationSession,
  OnboardingProgress,
  PermissionState,
  PrivacyLockPreference,
  TrackingPreference
} from '@/domain/app-shell';

export const signedOutSession: AuthenticationSession = {
  status: 'signed_out',
  userId: null,
  method: null,
  issuedAt: null,
  expiresAt: null,
  restoration: 'idle'
};

export const authenticatedSession: AuthenticationSession = {
  status: 'authenticated',
  userId: 'mock-user',
  method: 'phone',
  issuedAt: 4_000_000_000_000,
  expiresAt: 4_000_003_600_000,
  restoration: 'restored'
};

export const expiredSession: AuthenticationSession = {
  ...authenticatedSession,
  status: 'expired'
};

export const automaticTrackingPreference: TrackingPreference = {
  mode: 'automatic_clear',
  selectedAt: 1_700_000_000_000,
  isRecommended: true
};

export const androidOnboarding: OnboardingProgress = {
  platformPath: 'android',
  status: 'in_progress',
  completedSteps: ['tracking_intro'],
  skippedSteps: [],
  currentStep: 'permission_education',
  permissionEducationSeen: false,
  trackingPreference: null,
  updatedAt: 1_700_000_000_000
};

export const iosOnboarding: OnboardingProgress = {
  platformPath: 'ios',
  status: 'in_progress',
  completedSteps: ['platform_explanation'],
  skippedSteps: [],
  currentStep: 'capture_options',
  permissionEducationSeen: false,
  trackingPreference: null,
  updatedAt: 1_700_000_000_000
};

export const conservativeOnboarding: OnboardingProgress = {
  platformPath: 'conservative',
  status: 'in_progress',
  completedSteps: ['platform_explanation'],
  skippedSteps: [],
  currentStep: 'manual_voice_demo',
  permissionEducationSeen: false,
  trackingPreference: null,
  updatedAt: 1_700_000_000_000
};

export const permissionStates: Record<PermissionState['status'], PermissionState> = {
  not_requested: {
    id: 'sms',
    status: 'not_requested',
    blocking: false,
    recoveryAction: 'request'
  },
  granted: {
    id: 'sms',
    status: 'granted',
    blocking: false,
    recoveryAction: 'continue'
  },
  denied: {
    id: 'sms',
    status: 'denied',
    blocking: false,
    recoveryAction: 'retry'
  },
  permanently_denied: {
    id: 'sms',
    status: 'permanently_denied',
    blocking: false,
    recoveryAction: 'open_settings'
  },
  revoked: {
    id: 'sms',
    status: 'revoked',
    blocking: false,
    recoveryAction: 'open_settings'
  },
  unavailable: {
    id: 'sms',
    status: 'unavailable',
    blocking: false,
    recoveryAction: 'continue'
  }
};

export const lockedPrivacy: PrivacyLockPreference = {
  pinConfigured: true,
  biometricStatus: 'disabled',
  autoLockDuration: 'immediate',
  invalidAttempts: 0,
  lockedUntil: null,
  appLockStatus: 'locked'
};

export const unlockedPrivacy: PrivacyLockPreference = {
  ...lockedPrivacy,
  appLockStatus: 'unlocked'
};
