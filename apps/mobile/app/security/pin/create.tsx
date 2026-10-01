import React from 'react';
import { router } from 'expo-router';

import { PinSetupScreen } from '@/features/security/PinSetupScreen';
import { useAppShellStore } from '@/state/app-shell';

export default function CreatePinRoute() {
  const configurePrivacyLock = useAppShellStore(
    (state) => state.configurePrivacyLock
  );
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
