import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { router } from 'expo-router';
import { AppState, Linking, type AppStateStatus } from 'react-native';

import { parseDeepLinkDestination } from '@/features/shell/deep-link-controller';
import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import {
  isDevPrivacyDeletionEnabled,
  resolveClientMode
} from '@/config/client-runtime';
import { prepareDevDeletionBootstrap } from '@/services/dev-account-deletion';
import { authService } from '@/features/auth/auth-flow';
import { restoreAppShellSession } from '@/features/auth/session-controller';
import { HttpError } from '@/services/live/http-client';
import { useLiveClerkSessionKey } from '@/services/live/clerk-provider';
import { synchronizeLiveCoreFinance } from '@/services/live/core-finance-service';
import { refreshPlatformOperations } from '@/services/platform-operations-service';
import { syncAutomaticTracking } from '@/services/automatic-tracking-coordinator';
import { ensureLivePushDeviceRegistration } from '@/services/live/engagement-service';
import { getLiveClerkToken } from '@/services/live/auth-service';
import { measurePerformance } from '@/services/platform/performance-timing';

interface AppShellProviderProps {
  children: ReactNode;
  onAppStateChange?: (state: AppStateStatus) => void;
}

/**
 * AppShellProvider always renders its children so the Expo Router navigator
 * mounts on the first render. The hydration/loading gate is owned by the
 * entry route (`app/index.tsx`), which stays on a loading StateView until the
 * shell is hydrated — blocking navigation to protected destinations without
 * unmounting the Stack. Returning a plain View instead of children before
 * hydration caused "Attempted to navigate before mounting the Root Layout"
 * at runtime.
 */
export function AppShellProvider({
  children,
  onAppStateChange
}: AppShellProviderProps) {
  const hydrated = useAppShellStore((state) => state.hydrated);
  const hydrate = useAppShellStore((state) => state.hydrate);
  const setPendingDestination = useAppShellStore(
    (state) => state.setPendingDestination
  );
  const liveClerkSessionKey = useLiveClerkSessionKey();
  const bootstrapRevision = useAppShellStore(
    (state) => state.bootstrapRevision
  );
  const mode = resolveClientMode();
  const restoreQueue = useRef(Promise.resolve());
  const registeredPushSession = useRef<string | null>(null);
  const pushRegistrationFlight = useRef<{ sessionKey: string } | null>(null);
  const initialLink = useRef<string | null>(null);
  const linkRevision = useRef(0);
  const linksMounted = useRef(false);
  const session = useAppShellStore((state) => state.session);
  const onboarding = useAppShellStore((state) => state.onboarding);
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const profileSetupStatus = useAppShellStore(
    (state) => state.profileSetupStatus
  );
  const preferencesHydrated = usePreferenceStore((state) => state.hydrated);
  const firstLaunchCompleted = usePreferenceStore(
    (state) => state.firstLaunchOnboardingCompleted
  );

  const registerPushDevice = useCallback((refresh = false) => {
    if (!liveClerkSessionKey || mode !== 'live') return;
    if (pushRegistrationFlight.current?.sessionKey === liveClerkSessionKey) return;
    if (!refresh && registeredPushSession.current === liveClerkSessionKey) return;
    const flight = { sessionKey: liveClerkSessionKey };
    pushRegistrationFlight.current = flight;
    void ensureLivePushDeviceRegistration({ token: getLiveClerkToken })
      .then((permission) => {
        if (pushRegistrationFlight.current === flight && permission === 'granted')
          registeredPushSession.current = flight.sessionKey;
      })
      .catch(() => undefined)
      .finally(() => {
        if (pushRegistrationFlight.current === flight)
          pushRegistrationFlight.current = null;
      });
  }, [liveClerkSessionKey, mode]);

  useEffect(() => {
    if (mode !== 'live' && !hydrated) void hydrate();
  }, [hydrate, hydrated, mode]);

  useEffect(() => {
    let current = true;
    if (mode !== 'live' || liveClerkSessionKey === undefined)
      return () => {
        current = false;
      };
    restoreQueue.current = restoreQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (
          current &&
          isDevPrivacyDeletionEnabled() &&
          !(await prepareDevDeletionBootstrap())
        )
          return;
        if (current)
          await measurePerformance('startup.restore', () =>
            restoreAppShellSession(authService, () => current)
          );
      })
      .then(async () => {
        if (
          current &&
          liveClerkSessionKey &&
          (!isDevPrivacyDeletionEnabled() ||
            useAppShellStore.getState().session?.status === 'authenticated')
        ) {
          const restored = useAppShellStore.getState();
          // A successful live profile bootstrap has just read /me as well.
          if (
            !restored.profileSetupSnapshot ||
            !['complete', 'incomplete'].includes(restored.profileSetupStatus)
          )
            void authService.touchActivity().catch(() => undefined);
          registerPushDevice();
          void synchronizeLiveCoreFinance().catch(() => undefined);
          void refreshPlatformOperations().catch(() => undefined);
          void syncAutomaticTracking().catch(() => undefined);
        }
      })
      .catch((error: unknown) =>
        current
          ? useAppShellStore.setState({
              hydrated: true,
              profileSetupStatus:
                error instanceof HttpError && error.failureSource
                  ? 'unavailable'
                  : 'error'
            })
          : undefined
      );
    return () => {
      current = false;
    };
  }, [liveClerkSessionKey, mode, bootstrapRevision, registerPushDevice]);

  const retainSafeDestination = useCallback(
    async (url: string | null, expectedRevision: number) => {
      if (!url) return;
      const destination = parseDeepLinkDestination(url);
      if (!destination) return;
      const owner = useAppShellStore.getState().session?.userId;
      const isCurrent = () =>
        linksMounted.current &&
        expectedRevision === linkRevision.current &&
        owner === useAppShellStore.getState().session?.userId;
      await setPendingDestination(destination, isCurrent);
      if (!isCurrent()) return;
      const { hydrated, session, onboarding, privacyLock, profileSetupStatus } =
        useAppShellStore.getState();
      const { firstLaunchOnboardingCompleted } = usePreferenceStore.getState();
      const route = resolveEntryRoute({
        hydrated: hydrated && usePreferenceStore.getState().hydrated,
        firstLaunchOnboardingCompleted,
        profileSetupStatus,
        session,
        onboarding,
        pendingDestination: destination,
        privacyLock
      });
      // Hydration owns the entry route. Do not race its mounted loading gate.
      if (route !== '/index') router.replace(route);
      if (route === destination) initialLink.current = null;
    },
    [setPendingDestination]
  );

  useEffect(() => {
    linksMounted.current = true;
    const expected = linkRevision.current;
    void Linking.getInitialURL()
      .then((url) => {
        if (!linksMounted.current || expected !== linkRevision.current) return;
        initialLink.current = url && parseDeepLinkDestination(url) ? url : null;
        return retainSafeDestination(initialLink.current, expected);
      })
      .catch(() => undefined);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      if (!parseDeepLinkDestination(url)) return;
      initialLink.current = url;
      const expected = ++linkRevision.current;
      void retainSafeDestination(url, expected).catch(() => undefined);
    });
    return () => {
      linksMounted.current = false;
      linkRevision.current++;
      linkSubscription?.remove?.();
    };
  }, [retainSafeDestination]);

  useEffect(() => {
    if (hydrated && initialLink.current)
      void retainSafeDestination(
        initialLink.current,
        linkRevision.current
      ).catch(() => undefined);
  }, [
    hydrated,
    session?.userId,
    session?.status,
    onboarding,
    privacyLock,
    profileSetupStatus,
    preferencesHydrated,
    firstLaunchCompleted,
    retainSafeDestination
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      onAppStateChange?.(state);
      if (
        state === 'active' &&
        resolveClientMode() === 'live' &&
        liveClerkSessionKey &&
        (!isDevPrivacyDeletionEnabled() ||
          useAppShellStore.getState().session?.status === 'authenticated')
      ) {
        void authService.touchActivity().catch(() => undefined);
        registerPushDevice(true);
        void synchronizeLiveCoreFinance().catch(() => undefined);
        void refreshPlatformOperations().catch(() => undefined);
        void syncAutomaticTracking().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [liveClerkSessionKey, onAppStateChange, registerPushDevice]);

  return <>{children}</>;
}
