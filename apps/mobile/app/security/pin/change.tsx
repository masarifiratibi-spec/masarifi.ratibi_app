import React, { useState } from 'react';
import { router } from 'expo-router';

import { PinForm } from '@/features/security/PinForm';
import { verifyPin } from '@/features/security/privacy-lock';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function ChangePinRoute() {
  const [errorMessage, setErrorMessage] = useState<string>();
  const pinCredential = useAppShellStore((state) => state.pinCredential);

  return (
    <PinForm
      errorMessage={errorMessage}
      mode="change"
      onSubmit={(pin) => {
        if (!pinCredential || !verifyPin(pin, pinCredential)) {
          setErrorMessage(translate('appShell.security.invalidPin'));
          return;
        }
        router.push('/security/pin/create');
      }}
    />
  );
}
