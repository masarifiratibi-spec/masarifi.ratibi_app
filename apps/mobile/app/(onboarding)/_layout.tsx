import React from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';

import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';

export default function OnboardingLayout() {
  const hydrated = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const onboarding = useAppShellStore((state) => state.onboarding);
  const pendingDestination = useAppShellStore((state) => state.pendingDestination);
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const pathname = usePathname();

  const destination = resolveEntryRoute({
    hydrated,
    session,
    onboarding,
    pendingDestination,
    privacyLock
  });
  const destinationPath = destination.replace('/(onboarding)', '');

  if (destinationPath !== pathname) return <Redirect href={destination} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
