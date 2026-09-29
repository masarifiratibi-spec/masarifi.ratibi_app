import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { PinCredential } from '@/domain/app-shell';
import { translate } from '@/localization/i18n';
import type { BiometricService } from '@/services/contracts/app-shell-service';
import { useTheme } from '@/state/theme-context';
import { PinForm } from './PinForm';
import { verifyPin } from './privacy-lock';

interface UnlockScreenProps {
  biometricEnabled?: boolean;
  biometricService: BiometricService;
  lockedUntil?: number | null;
  now?: () => number;
  onAccountRecovery?: () => void;
  onInvalidPin?: (now: number) => void | Promise<void>;
  onUnlock?: () => void | Promise<void>;
  pinConfigured?: boolean;
  pinCredential?: PinCredential | null;
  sessionExpired?: boolean;
}

export function UnlockScreen({
  biometricEnabled = true,
  biometricService,
  lockedUntil = null,
  now = Date.now,
  onAccountRecovery,
  onInvalidPin,
  onUnlock,
  pinConfigured = false,
  pinCredential = null,
  sessionExpired = false
}: UnlockScreenProps) {
  const theme = useTheme();
  const canUsePin = pinConfigured && pinCredential !== null;
  const [mode, setMode] = useState<'biometric' | 'pin'>(
    biometricEnabled ? 'biometric' : 'pin'
  );
  const [status, setStatus] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [, refreshClock] = useState(0);
  const attempt = useRef(0);
  const completed = useRef(false);
  const mounted = useRef(true);

  const lockoutActive = lockedUntil !== null && lockedUntil > now();

  useEffect(() => {
    mounted.current = true;
    if (!sessionExpired && biometricEnabled) void unlockWithBiometric();
    return () => {
      mounted.current = false;
      attempt.current += 1;
    };
    // Automatic biometrics belong to this mounted unlock attempt only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lockoutActive || lockedUntil === null) return;
    const timer = setTimeout(
      () => refreshClock((version) => version + 1),
      Math.max(0, lockedUntil - now())
    );
    return () => clearTimeout(timer);
  }, [lockedUntil, lockoutActive, now]);

  async function completeUnlock() {
    if (completed.current) return;
    completed.current = true;
    await onUnlock?.();
  }

  async function unlockWithBiometric() {
    if (completed.current || sessionExpired || !biometricEnabled) return;
    const currentAttempt = ++attempt.current;
    setMode('biometric');
    setStatus(null);
    setPinError(undefined);
    setPending(true);
    try {
      const result = await biometricService.authenticate();
      if (
        !mounted.current ||
        currentAttempt !== attempt.current ||
        completed.current
      ) {
        return;
      }
      if (result.status === 'authenticated') {
        await completeUnlock();
        return;
      }
      const messageByStatus = {
        cancelled: 'appShell.security.biometricCancelled',
        failed: 'appShell.security.biometricFailed',
        locked_out: 'appShell.security.biometricLocked',
        unavailable: 'appShell.security.biometricUnavailable'
      } as const;
      setStatus(translate(messageByStatus[result.status]));
      setMode('pin');
    } catch {
      if (mounted.current && currentAttempt === attempt.current) {
        setStatus(translate('appShell.security.biometricUnavailable'));
        setMode('pin');
      }
    } finally {
      if (mounted.current && currentAttempt === attempt.current) {
        setPending(false);
      }
    }
  }

  async function usePinInstead() {
    attempt.current += 1;
    setMode('pin');
    setPending(false);
    setStatus(null);
    try {
      await biometricService.cancel();
    } catch {
      // PIN fallback must remain usable if the native prompt already closed.
    }
  }

  async function submitPin(pin: string) {
    if (!pinCredential || lockoutActive || completed.current) return;
    setPending(true);
    setPinError(undefined);
    try {
      if (await verifyPin(pin, pinCredential)) {
        await completeUnlock();
      } else {
        await onInvalidPin?.(now());
        setPinError(translate('appShell.auth.otp.invalid'));
      }
    } finally {
      if (mounted.current && !completed.current) setPending(false);
    }
  }

  if (sessionExpired) {
    return (
      <StyledText>{translate('appShell.navigation.authRequired')}</StyledText>
    );
  }

  return (
    <View
      style={[styles.cover, { backgroundColor: theme.colors.surfaces.page }]}
    >
      <View style={styles.recovery}>
        {status ? (
          <StyledText accessibilityRole="alert" style={styles.message}>
            {status}
          </StyledText>
        ) : null}

        {mode === 'pin' && canUsePin ? (
          <PinForm
            disabled={lockoutActive}
            errorMessage={
              lockoutActive
                ? translate('appShell.error.rateLimited')
                : pinError
            }
            loading={pending}
            onSubmit={submitPin}
          />
        ) : null}

        {mode === 'pin' && !canUsePin && onAccountRecovery ? (
          <ActionButton
            label="appShell.recovery.changeMethod"
            onPress={onAccountRecovery}
            variant="quiet"
          />
        ) : null}

        {biometricEnabled && mode === 'pin' ? (
          <ActionButton
            label="appShell.security.biometricUnlock"
            onPress={unlockWithBiometric}
            variant="quiet"
          />
        ) : null}

        {biometricEnabled && mode === 'biometric' && canUsePin ? (
          <ActionButton
            label="appShell.recovery.usePin"
            onPress={usePinInstead}
            variant="quiet"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  recovery: {
    gap: 12,
    justifyContent: 'center'
  },
  message: {
    textAlign: 'center'
  }
});
