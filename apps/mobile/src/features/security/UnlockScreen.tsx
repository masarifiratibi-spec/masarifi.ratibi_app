import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import type { BiometricService } from '@/services/contracts/app-shell-service';
import { PinForm } from './PinForm';
import {
  createPinCredential,
  isLegacyPinCredential,
  verifyPin
} from './privacy-lock';

interface UnlockScreenProps {
  expectedHash?: string;
  biometricEnabled?: boolean;
  biometricService?: BiometricService;
  lockedUntil?: number | null;
  now?: () => number;
  onForgotPin?: () => void;
  onInvalidPin?: () => void;
  onCredentialUpgrade?: (hash: string) => void | Promise<void>;
  onUnlock?: () => void | Promise<void>;
  sessionExpired?: boolean;
}

export function UnlockScreen({
  biometricEnabled = false,
  biometricService,
  expectedHash = '',
  lockedUntil = null,
  now = Date.now,
  onForgotPin,
  onInvalidPin,
  onCredentialUpgrade,
  onUnlock,
  sessionExpired = false
}: UnlockScreenProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [, refreshLockState] = useState(false);
  const temporarilyLocked = lockedUntil !== null && lockedUntil > now();

  useEffect(() => {
    if (lockedUntil === null) return;
    const remainingMs = lockedUntil - now();
    if (remainingMs <= 0) return;
    const timeout = setTimeout(
      () => refreshLockState((current) => !current),
      remainingMs
    );
    return () => clearTimeout(timeout);
  }, [lockedUntil, now]);

  useEffect(() => {
    if (!biometricEnabled || !biometricService) return;
    if (sessionExpired || temporarilyLocked) return;
    void unlockWithBiometric();
    // The automatic prompt is a mount-time behavior: re-running it on later
    // renders would surprise users who already dismissed the prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlockWithBiometric() {
    const result = await biometricService?.authenticate();
    const messageByStatus = {
      authenticated: 'appShell.security.biometricUnlocked',
      cancelled: 'appShell.security.biometricCancelled',
      failed: 'appShell.security.biometricFailed',
      locked_out: 'appShell.security.biometricLocked',
      unavailable: 'appShell.security.biometricUnavailable'
    } as const;
    setStatus(
      result
        ? translate(messageByStatus[result.status])
        : translate('appShell.security.biometricUnavailable')
    );
    if (result?.status === 'authenticated') onUnlock?.();
  }

  if (sessionExpired) {
    return (
      <StyledText>{translate('appShell.navigation.authRequired')}</StyledText>
    );
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">
        {translate('appShell.security.unlockTitle')}
      </StyledText>
      <PinForm
        disabled={temporarilyLocked}
        errorMessage={status ?? undefined}
        mode="unlock"
        onSubmit={async (pin) => {
          if (await verifyPin(pin, expectedHash)) {
            if (isLegacyPinCredential(expectedHash) && onCredentialUpgrade) {
              const credential = await createPinCredential(pin, pin);
              if (credential.hash) await onCredentialUpgrade(credential.hash);
            }
            setStatus(null);
            await onUnlock?.();
            return;
          }
          setStatus(translate('appShell.security.invalidPin'));
          onInvalidPin?.();
        }}
      />
      {biometricService ? (
        <ActionButton
          label={translate('appShell.security.biometricUnlock')}
          onPress={unlockWithBiometric}
          variant="secondary"
        />
      ) : null}
      {temporarilyLocked ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.security.pin.retryIn')}
        </StyledText>
      ) : null}
      {onForgotPin ? (
        <ActionButton
          label={translate('appShell.security.forgotPin')}
          onPress={onForgotPin}
          variant="quiet"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  }
});
