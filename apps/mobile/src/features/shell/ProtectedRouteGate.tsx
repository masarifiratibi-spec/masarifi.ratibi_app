import React, { type ReactNode, useEffect, useRef } from 'react';
import { Redirect, router, usePathname } from 'expo-router';

import { resolveProtectedAccessGate } from './resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';
import { createNotificationResponseController } from '@/features/notifications/notification-response-controller';
import { assistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';

let notificationCategoriesRegistered = false;

export function ProtectedRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const onboarding = useAppShellStore((state) => state.onboarding);
  const pendingDestination = useAppShellStore(
    (state) => state.pendingDestination
  );
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const setPendingDestination = useAppShellStore(
    (state) => state.setPendingDestination
  );
  const gate = resolveProtectedAccessGate({
    hydrated,
    session,
    onboarding,
    pendingDestination,
    privacyLock
  });
  const destination = pathnameDestination(pathname);

  useEffect(() => {
    if (gate && destination && pendingDestination !== destination) {
      void setPendingDestination(destination);
      return;
    }
    if (!gate && destination === pendingDestination) {
      void setPendingDestination(null);
    }
  }, [destination, gate, pendingDestination, setPendingDestination]);

  const isLockRecovery =
    gate === '/security/unlock' &&
    (pathname === '/security/unlock' || pathname === '/security/pin/forgot');
  if (gate && !isLockRecovery) {
    return <Redirect href={gate} />;
  }
  if (!gate && pathname === '/security/unlock') {
    return <Redirect href="/(tabs)/home" />;
  }
  return <>{children}</>;
}

export function NotificationResponseRuntime() {
  const hydrated = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const pendingUnlocks = useRef(new Set<(unlocked: boolean) => void>());

  useEffect(() => {
    if (!isCurrentAuthenticatedSession({ hydrated, session })) {
      resolvePendingUnlocks(pendingUnlocks.current, false);
    } else if (privacyLock?.appLockStatus === 'unlocked') {
      resolvePendingUnlocks(pendingUnlocks.current, true);
    } else if (privacyLock === null) {
      resolvePendingUnlocks(pendingUnlocks.current, false);
    }
  }, [hydrated, privacyLock, session]);

  useEffect(() => {
    const unlocks = pendingUnlocks.current;
    if (!notificationCategoriesRegistered) {
      notificationCategoriesRegistered = true;
      void phoneNotificationService.registerCategories().catch(() => undefined);
    }
    const controller = createNotificationResponseController({
      notificationService: assistantNotificationsService,
      phoneService: phoneNotificationService,
      navigate: (destination) => router.push(destination),
      unlock: async () => {
        const state = useAppShellStore.getState();
        if (!isCurrentAuthenticatedSession(state)) return false;
        if (state.privacyLock?.appLockStatus !== 'locked') return true;
        const waitForVerifiedUnlock = new Promise<boolean>((resolve) => {
          unlocks.add(resolve);
        });
        void state.setPendingDestination('/notifications').catch(() => undefined);
        router.push('/security/unlock');
        return waitForVerifiedUnlock;
      }
    });
    void controller.start();
    return () => {
      resolvePendingUnlocks(unlocks, false);
      controller.stop();
    };
  }, []);

  return null;
}

function isCurrentAuthenticatedSession({
  hydrated,
  session
}: Pick<ReturnType<typeof useAppShellStore.getState>, 'hydrated' | 'session'>) {
  return (
    hydrated &&
    session?.status === 'authenticated' &&
    session.expiresAt !== null &&
    session.expiresAt > Date.now()
  );
}

function resolvePendingUnlocks(
  pending: Set<(unlocked: boolean) => void>,
  unlocked: boolean
) {
  for (const resolve of pending) resolve(unlocked);
  pending.clear();
}

function pathnameDestination(pathname: string): string | null {
  const routes: Record<string, string> = {
    '/home': '/(tabs)/home',
    '/transactions': '/(tabs)/transactions',
    '/add': '/(tabs)/add',
    '/reports': '/(tabs)/reports',
    '/more': '/(tabs)/more',
    '/accounts': '/accounts',
    '/assistant': '/assistant',
    '/tracking': '/tracking',
    '/profile': '/profile',
    '/security/settings': '/security/settings'
  };
  return routes[pathname] ?? null;
}
