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
import { DevAccountDeletionRecovery } from '@/features/settings/DevAccountDeletionRecovery';
import {
  StartupLoadingBoundary,
  useStartupReady
} from '@/design-system/components/feedback/StartupLoadingBoundary';
import { usePreferenceStore } from '@/state/preferences';
import { NetworkConnectionNotice } from '@/features/shell/NetworkConnectionNotice';
import { StartupLoading } from '@/design-system/components/feedback/StartupLoading';

export default function RootLayout() {
  const locale = usePreferenceStore((state) => state.locale);
  const themePreference = usePreferenceStore((state) => state.theme);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  return (
    <MobileIdentityProvider recoveryFallback={
      <StartupLoading locale={locale} themePreference={themePreference} reducedMotion={reducedMotion} />
    }>
      <FoundationProviders>
        <StartupLoadingBoundary
          locale={locale}
          themePreference={themePreference}
          reducedMotion={reducedMotion}
        >
          <FontGate>
            <AppShellProvider>
              <DevAccountDeletionRecovery />
              <VoiceCaptureProvider>
                <RoutePrivacyGate>
                  <NotificationResponseRuntime />
                  <RootStack />
                </RoutePrivacyGate>
              </VoiceCaptureProvider>
            </AppShellProvider>
          </FontGate>
        </StartupLoadingBoundary>
        <NetworkConnectionNotice />
      </FoundationProviders>
    </MobileIdentityProvider>
  );
}

function StartupDestinationReady() {
  const pathname = usePathname();
  // Home releases after its first reads and layout; other destinations are ready on mount.
  useStartupReady(!['/', '/index', '/home'].includes(pathname));
  return null;
}

function RoutePrivacyGate({ children }: { children: React.ReactNode }) {
  const preferenceEnabled = useAppShellStore((state) => state.privacyLock?.enabled === true);
  const appLockEnabled = isAppLockEnabled() && preferenceEnabled;
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
      {children}
    </AppPrivacyGate>
  );
}

function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenLayout={({ children }) => (
        <ProtectedRouteGate>
          <StartupDestinationReady />
          {children}
        </ProtectedRouteGate>
      )}
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.surfaces.page },
        headerShown: false
      }}
    />
  );
}
