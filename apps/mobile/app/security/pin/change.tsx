import React from 'react';
import { router } from 'expo-router';

import { PinSetupScreen } from '@/features/security/PinSetupScreen';
import { useAppShellStore } from '@/state/app-shell';

export default function ChangePinRoute() {
  const pinCredential = useAppShellStore((state) => state.pinCredential);
  const recordFailedUnlock = useAppShellStore(
    (state) => state.recordFailedUnlock
  );
  const updatePinCredential = useAppShellStore(
    (state) => state.updatePinCredential
  );

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
