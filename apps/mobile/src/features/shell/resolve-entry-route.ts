import type {
  AuthenticationSession,
  OnboardingProgress,
  PrivacyLockPreference
} from '@/domain/app-shell';
import { sanitizeReturnRoute } from './navigation-context';

export interface EntryRouteInput {
  hydrated: boolean;
  now?: number;
  session: AuthenticationSession | null;
  privacyLock: PrivacyLockPreference | null;
  onboarding: OnboardingProgress | null;
  pendingDestination: string | null;
}

const homeRoute = '/(tabs)/home';

const onboardingRouteByStep: Record<string, string> = {
  tracking_intro: '/(onboarding)/tracking-intro',
  permission_education: '/(onboarding)/android-sms-permission',
  permission_request: '/(onboarding)/android-sms-permission',
  keywords: '/(onboarding)/tracking-keywords',
  preference: '/(onboarding)/tracking-preferences',
  demo: '/(onboarding)/tracking-demo',
  platform_explanation: '/(onboarding)/ios-capture-options',
  capture_options: '/(onboarding)/ios-capture-options',
  optional_automation: '/(onboarding)/ios-automation',
  manual_voice_demo: '/(onboarding)/tracking-demo',
  complete: '/(onboarding)/complete'
};

export function resolveEntryRoute(input: EntryRouteInput): string {
  if (!input.hydrated) return '/index';
  if (!isSessionValid(input.session, input.now ?? Date.now())) {
    return '/(public)/language';
  }
  if (input.privacyLock && input.privacyLock.appLockStatus !== 'unlocked') {
    return '/security/unlock';
  }
  if (
    input.onboarding &&
    input.onboarding.status !== 'completed' &&
    input.onboarding.status !== 'skipped'
  ) {
    return input.onboarding.currentStep
      ? onboardingRouteByStep[input.onboarding.currentStep]
      : '/(onboarding)/tracking-intro';
  }
  return sanitizeReturnRoute(input.pendingDestination) ?? homeRoute;
}

export function resolveProtectedAccessGate(
  input: EntryRouteInput
): string | null {
  const destination = resolveEntryRoute({ ...input, pendingDestination: null });
  if (destination === '/index') return '/';
  return destination === homeRoute ? null : destination;
}

function isSessionValid(
  session: AuthenticationSession | null,
  now: number
): session is AuthenticationSession & { status: 'authenticated' } {
  return (
    session?.status === 'authenticated' &&
    session.expiresAt !== null &&
    session.expiresAt > now
  );
}
