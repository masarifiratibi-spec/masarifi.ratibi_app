/**
 * Root layout. Wraps every route in the foundation providers.
 */

import React, { useCallback } from 'react';
import { Stack } from 'expo-router';

import { FontGate } from '@/design-system/typography';
import { AppPrivacyGate } from '@/features/security/AppPrivacyGate';
import { AppShellProvider } from '@/state/AppShellProvider';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { NotificationResponseRuntime } from '@/features/shell/ProtectedRouteGate';
import { useTheme } from '@/state/theme-context';

export default function RootLayout() {
  const autoLockDuration = useAppShellStore(
    (state) => state.privacyLock?.autoLockDuration
  );
  const lockNow = useAppShellStore((state) => state.lockNow);
  const lockAfterMs =
    autoLockDuration === 'one_minute'
      ? 60_000
      : autoLockDuration === 'five_minutes'
        ? 300_000
        : autoLockDuration === 'fifteen_minutes'
          ? 900_000
          : null;
  const handleLock = useCallback(() => {
    void lockNow();
  }, [lockNow]);

  return (
    <FontGate>
      <FoundationProviders>
        <AppShellProvider>
          <AppPrivacyGate
            immediate={autoLockDuration === 'immediate'}
            lockAfterMs={lockAfterMs}
            onLock={handleLock}
          >
            <NotificationResponseRuntime />
            <RootStack />
          </AppPrivacyGate>
        </AppShellProvider>
      </FoundationProviders>
    </FontGate>
  );
}

function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.surfaces.page },
        headerShown: false
      }}
    />
  );
}
