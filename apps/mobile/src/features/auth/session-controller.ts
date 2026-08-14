import { Platform } from 'react-native';

import type { AuthenticationSession } from '@/domain/app-shell';
import {
  createOnboardingProgress,
  routeForOnboardingProgress
} from '@/features/onboarding/onboarding-progress';
import type { PlatformPathInput } from '@/features/onboarding/platform-path';
import { resolvePlatformPath } from '@/features/onboarding/platform-path';
import type { AuthService } from '@/services/contracts/app-shell-service';
import { useAppShellStore } from '@/state/app-shell';

interface CompleteSessionOptions {
  platform?: PlatformPathInput;
  now?: () => number;
}

export async function restoreAppShellSession(authService: AuthService): Promise<void> {
  const session = await authService.restoreSession();
  if (session.status === 'authenticated') {
    await useAppShellStore.getState().authenticate(session);
    return;
  }
  useAppShellStore.setState({ session });
}

export async function signOutAppShellSession(
  authService: AuthService,
  scope: 'local' | 'all'
): Promise<void> {
  await authService.signOut(scope);
  await useAppShellStore.getState().signOut();
}

export async function completeAuthenticatedSession(
  session: AuthenticationSession,
  options: CompleteSessionOptions = {}
): Promise<string> {
  const store = useAppShellStore.getState();
  await store.authenticate(session);
  if (store.onboarding) {
    return routeForOnboardingProgress(store.onboarding);
  }
  const platformPath = resolvePlatformPath(
    options.platform ?? {
      os: Platform.OS,
      smsAvailable: Platform.OS === 'android'
    }
  );
  const onboarding = createOnboardingProgress(platformPath, options.now?.() ?? Date.now());
  await useAppShellStore.getState().setOnboarding(onboarding);
  return routeForOnboardingProgress(onboarding);
}
