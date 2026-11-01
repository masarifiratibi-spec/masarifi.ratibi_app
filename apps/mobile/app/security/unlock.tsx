import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { createBiometricService } from '@/services/platform/biometric-service';
import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

export default function UnlockRoute() {
  const { UnlockScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/security/UnlockScreen') as typeof import('@/features/security/UnlockScreen');
  const session = useAppShellStore(state => state.session);
  const service = useMemo(() => createBiometricService(session?.userId ?? null), [session?.userId]);
  const firstLaunchOnboardingCompleted = usePreferenceStore(state => state.firstLaunchOnboardingCompleted);
  const sessionExpired = session?.status !== 'authenticated' ||
    (session.restoration !== 'local' && (session.expiresAt === null || session.expiresAt <= Date.now()));
  return <UnlockScreen
    key={session?.userId ?? 'signed-out'}
    biometricService={service}
    sessionExpired={sessionExpired}
    onUnlock={async () => {
      if (useAppShellStore.getState().session !== session) return;
      await useAppShellStore.getState().unlock();
      if (useAppShellStore.getState().session !== session) return;
      router.replace(resolveEntryRoute({ ...useAppShellStore.getState(), firstLaunchOnboardingCompleted }));
    }}
  />;
}
