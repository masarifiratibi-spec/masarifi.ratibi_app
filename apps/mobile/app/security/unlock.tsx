import React from 'react';
import { router } from 'expo-router';

import { UnlockScreen } from '@/features/security/UnlockScreen';
import { createBiometricService } from '@/services/platform/biometric-service';
import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

export default function UnlockRoute() {
  const session = useAppShellStore((state) => state.session);
  const unlock = useAppShellStore((state) => state.unlock);
  const pinCredential = useAppShellStore((state) => state.pinCredential);
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const recordFailedUnlock = useAppShellStore(
    (state) => state.recordFailedUnlock
  );
  const firstLaunchOnboardingCompleted = usePreferenceStore(
    (state) => state.firstLaunchOnboardingCompleted
  );
  return (
    <UnlockScreen
      biometricEnabled={privacyLock?.biometricStatus === 'enabled'}
      biometricService={createBiometricService()}
      lockedUntil={privacyLock?.lockedUntil}
      onAccountRecovery={() => router.push('/security/pin/forgot')}
      onInvalidPin={recordFailedUnlock}
      onUnlock={async () => {
        await unlock();
        router.replace(
          resolveEntryRoute({
            ...useAppShellStore.getState(),
            firstLaunchOnboardingCompleted
          })
        );
      }}
      pinConfigured={privacyLock?.pinConfigured ?? false}
      pinCredential={pinCredential}
      sessionExpired={
        session?.status !== 'authenticated' ||
        session.expiresAt === null ||
        session.expiresAt <= Date.now()
      }
    />
  );
}
