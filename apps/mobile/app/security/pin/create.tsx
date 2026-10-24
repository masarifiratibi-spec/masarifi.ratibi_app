import React from 'react';
import { router } from 'expo-router';

import { useAppShellStore } from '@/state/app-shell';

export default function CreatePinRoute() {
  const configurePrivacyLock = useAppShellStore(
    (state) => state.configurePrivacyLock
  );
  const { PinSetupScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/security/PinSetupScreen') as typeof import('@/features/security/PinSetupScreen');
  return (
    <PinSetupScreen
      mode="create"
      onSave={async (credential) => {
        await configurePrivacyLock(credential);
        router.replace('/security/settings');
      }}
    />
  );
}
