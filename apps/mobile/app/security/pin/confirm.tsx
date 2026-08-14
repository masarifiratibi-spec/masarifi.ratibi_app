import React, { useState } from 'react';
import { router } from 'expo-router';

import { clearPendingPin, getPendingPinForTest } from '@app/security/pin/create';
import { PinForm } from '@/features/security/PinForm';
import { createPinCredential } from '@/features/security/privacy-lock';
import { useAppShellStore } from '@/state/app-shell';
import { translate } from '@/localization/i18n';

export default function ConfirmPinRoute() {
  const [errorMessage, setErrorMessage] = useState<string>();
  const configurePrivacyLock = useAppShellStore((state) => state.configurePrivacyLock);
  return (
    <PinForm
      errorMessage={errorMessage}
      mode="confirm"
      onSubmit={async (pin) => {
        const credential = createPinCredential(getPendingPinForTest() ?? '', pin);
        if (credential.hash) {
          await configurePrivacyLock(credential.hash);
          clearPendingPin();
          router.replace('/security/settings');
          return;
        }
        setErrorMessage(translate('appShell.security.pinMismatch'));
      }}
    />
  );
}
