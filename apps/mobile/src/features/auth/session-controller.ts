import { Platform } from 'react-native';
import { resolveClientMode } from '@/config/client-runtime';

import { HttpError } from '@/services/live/http-client';

import type { AuthenticationSession } from '@/domain/app-shell';
import type { ProfileSetupSnapshot } from '@/domain/settings';
import {
  createOnboardingProgress,
  routeForOnboardingProgress
} from '@/features/onboarding/onboarding-progress';
import type { PlatformPathInput } from '@/features/onboarding/platform-path';
import { resolvePlatformPath } from '@/features/onboarding/platform-path';
import type { AuthService } from '@/services/contracts/app-shell-service';
import type { SettingsService } from '@/services/contracts/assistant-notifications-service';
import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { measurePerformance } from '@/services/platform/performance-timing';
import {
  rememberAuthenticatedOwner,
  isLogoutOwnerFenced,
  currentLogoutAdmissionRevision
} from '@/services/owner-lifecycle';
export { signOutAppShellSession } from '@/services/owner-lifecycle';

interface CompleteSessionOptions {
  platform?: PlatformPathInput;
  now?: () => number;
}

export async function restoreAppShellSession(
  authService: AuthService,
  isCurrent: () => boolean = () => true,
  identityService: Pick<SettingsService, 'getProfileSetup'> = settingsService
): Promise<void> {
  let active = true;
  let restorationOwnerId = useAppShellStore.getState().session?.userId;
  const ownerIsCurrent = () => {
    const currentOwnerId = useAppShellStore.getState().session?.userId;
    return !currentOwnerId || currentOwnerId === restorationOwnerId;
  };
  let unavailableSuspension: Promise<void> | undefined;
  const suspendUnavailable = () =>
    !ownerIsCurrent() || useAppShellStore.getState().logoutRecoveryOwnerId
      ? Promise.resolve()
      : (unavailableSuspension ??= useAppShellStore
          .getState()
          .suspendUnavailableRestoration());
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      active = false;
      reject(
        new HttpError(
          'provider_unavailable',
          503,
          undefined,
          undefined,
          'timeout'
        )
      );
    }, 30_000);
  });
  try {
    await Promise.race([
      restoreCurrentSession(
        authService,
        () => active && isCurrent() && ownerIsCurrent(),
        identityService,
        suspendUnavailable,
        (ownerId) => {
          if (
            active &&
            isCurrent() &&
            useAppShellStore.getState().session?.userId === ownerId
          )
            restorationOwnerId = ownerId;
        }
      ),
      deadline
    ]);
  } catch (error) {
    if (
      resolveClientMode() === 'live' &&
      isCurrent() &&
      ownerIsCurrent() &&
      !(
        error instanceof HttpError &&
        error.failureSource &&
        useAppShellStore.getState().session?.restoration === 'local'
      )
    )
      await suspendUnavailable();
    throw error;
  } finally {
    active = false;
    clearTimeout(timer!);
  }
}

async function restoreCurrentSession(
  authService: AuthService,
  isCurrent: () => boolean,
  identityService: Pick<SettingsService, 'getProfileSetup'>,
  suspendUnavailable: () => Promise<void>,
  bindOwner: (ownerId: string) => void
): Promise<void> {
  const admissionRevision = currentLogoutAdmissionRevision();
  const session = await authService.restoreSession();
  if (!isCurrent()) return;
  if (session.status === 'authenticated') {
    const admitted = async (initialAdmission = false) => {
      if (!isCurrent()) return false;
      const fenced = await isLogoutOwnerFenced(session.userId!);
      if (!isCurrent()) return false;
      if (fenced) {
        if (
          initialAdmission &&
          useAppShellStore.getState().session?.userId !== session.userId
        )
          useAppShellStore.setState({ session: null });
        useAppShellStore.getState().fenceLogoutOwner(session.userId!);
        return false;
      }
      return (
        admissionRevision === currentLogoutAdmissionRevision() &&
        useAppShellStore.getState().logoutQuiescingOwnerId !== session.userId
      );
    };
    if (!(await admitted(true))) return;
    const currentSession = useAppShellStore.getState().session;
    if (
      currentSession?.status !== 'authenticated' ||
      currentSession.userId !== session.userId
    )
      await useAppShellStore.getState().authenticate(session, isCurrent);
    else useAppShellStore.setState({ session });
    bindOwner(session.userId!);
    if (!(await admitted())) return;
    // Revalidate an already admitted local owner without withdrawing their
    // complete saved shell. New owners still wait for authoritative bootstrap.
    const canReadSavedShell =
      currentSession?.status === 'authenticated' &&
      currentSession.restoration === 'local' &&
      currentSession.userId === session.userId &&
      useAppShellStore.getState().profileSetupStatus === 'complete';
    if (!canReadSavedShell)
      useAppShellStore.getState().setProfileSetup('loading');
    let snapshot: ProfileSetupSnapshot;
    try {
      snapshot = await measurePerformance('startup.profile', () =>
        identityService.getProfileSetup()
      );
    } catch (error) {
      if (!(await admitted())) return;
      if (
        canReadSavedShell &&
        error instanceof HttpError &&
        error.code === 'provider_unavailable'
      ) {
        useAppShellStore.setState({
          session: currentSession,
          profileSetupStatus: 'complete'
        });
        return;
      }
      if (error instanceof HttpError && error.code === 'session_expired') {
        await useAppShellStore.getState().expireSession();
        if (isCurrent()) useAppShellStore.getState().setProfileSetup('unknown');
      } else
        useAppShellStore
          .getState()
          .setProfileSetup(
            error instanceof HttpError && error.failureSource
              ? 'unavailable'
              : 'error'
          );
      return;
    }
    if (!(await admitted())) return;
    if (snapshot.complete && resolveClientMode() === 'live') {
      await rememberAuthenticatedOwner(session, isCurrent);
      if (!(await admitted())) return;
    }
    const preferences = usePreferenceStore.getState();
    // Optional local persistence must not invalidate the server profile.
    await preferences.hydrate().catch(() => undefined);
    if (!(await admitted())) return;
    if (snapshot.profile?.currency) {
      usePreferenceStore
        .getState()
        .setBaseCurrencyCode(snapshot.profile.currency);
    }
    useAppShellStore
      .getState()
      .setProfileSetup(snapshot.complete ? 'complete' : 'incomplete', snapshot);
    return;
  }
  if (isCurrent()) {
    if (resolveClientMode() === 'live') await suspendUnavailable();
    else await useAppShellStore.getState().signOut();
  }
}

export async function completeAuthenticatedSession(
  session: AuthenticationSession,
  options: CompleteSessionOptions = {}
): Promise<string> {
  // Live Clerk activation triggers the provider's single bootstrap path.
  if (resolveClientMode() === 'live') {
    const state = useAppShellStore.getState();
    if (
      state.session?.status !== 'authenticated' ||
      state.session.userId !== session.userId ||
      state.profileSetupStatus === 'error' ||
      state.profileSetupStatus === 'unknown'
    )
      state.retryBootstrap();
    return '/';
  }
  const store = useAppShellStore.getState();
  await store.authenticate(session);
  const onboarding = useAppShellStore.getState().onboarding;
  if (onboarding) {
    return routeForOnboardingProgress(onboarding);
  }
  const platformPath = resolvePlatformPath(
    options.platform ?? {
      os: Platform.OS,
      smsAvailable: Platform.OS === 'android'
    }
  );
  const progress = createOnboardingProgress(
    platformPath,
    options.now?.() ?? Date.now()
  );
  await useAppShellStore.getState().setOnboarding(progress);
  return routeForOnboardingProgress(progress);
}
