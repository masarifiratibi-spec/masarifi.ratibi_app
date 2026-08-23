import type { AuthenticationSession, OnboardingProgress } from './app-shell';

export function createClientDemoSession(now: number): AuthenticationSession {
  return {
    status: 'authenticated',
    userId: 'client-demo',
    method: 'phone',
    issuedAt: Math.max(1, now),
    expiresAt: Date.UTC(2100, 0, 1),
    restoration: 'restored'
  };
}

export function createCompletedDemoOnboarding(now: number): OnboardingProgress {
  return {
    platformPath: 'conservative',
    status: 'completed',
    completedSteps: ['complete'],
    skippedSteps: [],
    currentStep: null,
    permissionEducationSeen: true,
    trackingPreference: {
      mode: 'review_all',
      selectedAt: Math.max(1, now),
      isRecommended: false
    },
    updatedAt: Math.max(1, now)
  };
}
