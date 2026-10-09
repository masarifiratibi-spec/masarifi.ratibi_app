/**
 * Root layout. Wraps every route in the foundation providers.
 */

import React, { useCallback } from 'react';
import { Stack, usePathname } from 'expo-router';

import { FontGate } from '@/design-system/typography';
import { AppPrivacyGate } from '@/features/security/AppPrivacyGate';
import { AppShellProvider } from '@/state/AppShellProvider';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import {
  NotificationResponseRuntime,
  ProtectedRouteGate
} from '@/features/shell/ProtectedRouteGate';
import { useTheme } from '@/state/theme-context';
import { MobileIdentityProvider } from '@/services/live/clerk-provider';
import { isAppLockEnabled } from '@/config/client-runtime';
import { VoiceCaptureProvider } from '@/features/voice/VoiceCaptureRuntime';

export default function RootLayout() {
  const appLockEnabled = isAppLockEnabled();
  const pathname = usePathname();
  const autoLockDuration = useAppShellStore(
    (state) => state.privacyLock?.autoLockDuration
  );
  const lockNow = useAppShellStore((state) => state.lockNow);
  const appLockStatus = useAppShellStore(
    (state) => state.privacyLock?.appLockStatus
  );
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
    <MobileIdentityProvider>
      <FontGate>
        <FoundationProviders>
          <AppShellProvider>
            <VoiceCaptureProvider>
              <AppPrivacyGate
                immediate={
                  appLockEnabled &&
                  autoLockDuration === 'immediate' &&
                  pathname !== '/security/unlock'
                }
                lockAfterMs={appLockEnabled ? lockAfterMs : null}
                locked={
                  appLockEnabled &&
                  appLockStatus !== undefined &&
                  appLockStatus !== 'unlocked' &&
                  pathname !== '/security/unlock'
                }
                onLock={appLockEnabled ? handleLock : undefined}
              >
                <NotificationResponseRuntime />
                <RootStack />
              </AppPrivacyGate>
            </VoiceCaptureProvider>
          </AppShellProvider>
        </FoundationProviders>
      </FontGate>
    </MobileIdentityProvider>
  );
}

function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenLayout={({ children }) => (
        <ProtectedRouteGate>{children}</ProtectedRouteGate>
      )}
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.surfaces.page },
        headerShown: false
      }}
    />
  );
}
