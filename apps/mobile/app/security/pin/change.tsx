import React from 'react';
import { router } from 'expo-router';

import { useAppShellStore } from '@/state/app-shell';

export default function ChangePinRoute() {
  const pinCredential = useAppShellStore((state) => state.pinCredential);
  const recordFailedUnlock = useAppShellStore(
    (state) => state.recordFailedUnlock
  );
  const updatePinCredential = useAppShellStore(
    (state) => state.updatePinCredential
  );

  const { PinSetupScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/security/PinSetupScreen') as typeof import('@/features/security/PinSetupScreen');
  return (
    <PinSetupScreen
      currentCredential={pinCredential}
      mode="change"
      onInvalidCurrent={() => recordFailedUnlock(Date.now())}
      onSave={async (credential) => {
        await updatePinCredential(credential);
        router.replace('/security/settings');
      }}
    />
  );
}
