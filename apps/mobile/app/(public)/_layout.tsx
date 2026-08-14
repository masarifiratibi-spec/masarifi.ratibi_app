import React from 'react';
import {
  Redirect,
  Stack,
  usePathname,
  useRootNavigationState
} from 'expo-router';

import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';

export default function PublicLayout() {
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const hydrated = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const onboarding = useAppShellStore((state) => state.onboarding);
  const pendingDestination = useAppShellStore(
    (state) => state.pendingDestination
  );
  const privacyLock = useAppShellStore((state) => state.privacyLock);

  if (
    rootNavigationState?.key &&
    session?.status === 'authenticated' &&
    publicPaths.has(pathname)
  ) {
    return (
      <Redirect
        href={resolveEntryRoute({
          hydrated,
          session,
          onboarding,
          pendingDestination,
          privacyLock
        })}
      />
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const publicPaths = new Set([
  '/language',
  '/welcome',
  '/sign-in',
  '/sign-up',
  '/phone',
  '/otp',
  '/google',
  '/legal'
]);
