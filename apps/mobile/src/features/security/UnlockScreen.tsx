import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import type { BiometricService } from '@/services/contracts/app-shell-service';
import { useTheme } from '@/state/theme-context';

interface UnlockScreenProps {
  biometricService: BiometricService;
  onUnlock?: () => void | Promise<void>;
  sessionExpired?: boolean;
}

export function UnlockScreen({ biometricService, onUnlock, sessionExpired = false }: UnlockScreenProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const mounted = useRef(false);
  const active = useRef(false);
  const completed = useRef(false);
  const attempt = useRef(0);
  const expired = useRef(sessionExpired);
  expired.current = sessionExpired;

  useEffect(() => {
    mounted.current = true;
    if (!sessionExpired) void unlockWithDevice();
    return () => { mounted.current = false; attempt.current += 1; };
    // A single automatic OS prompt belongs to this mounted owner-scoped screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlockWithDevice() {
    if (completed.current || active.current || expired.current) return;
    active.current = true;
    const currentAttempt = ++attempt.current;
    const current = () => mounted.current && currentAttempt === attempt.current && !expired.current;
    setPending(true);
    setStatus(null);
    try {
      const result = await biometricService.authenticate();
      if (!current()) return;
      if (result.status === 'authenticated') {
        await onUnlock?.();
        if (current()) completed.current = true;
        return;
      }
      const messages = {
        cancelled: 'appShell.security.biometricCancelled',
        failed: 'appShell.security.biometricFailed',
        locked_out: 'appShell.security.biometricLocked',
        unavailable: 'appShell.security.biometricUnavailable'
      } as const;
      setStatus(translate(messages[result.status]));
    } catch {
      if (current()) setStatus(translate('appShell.security.biometricUnavailable'));
    } finally {
      active.current = false;
      if (current()) setPending(false);
    }
  }

  if (sessionExpired) return <StyledText>{translate('appShell.navigation.authRequired')}</StyledText>;
  return (
    <View style={[styles.cover, { backgroundColor: theme.colors.surfaces.page }]}>
      <View style={styles.recovery}>
        <StyledText>{translate('appShell.security.nativeUnlock')}</StyledText>
        {status ? <StyledText accessibilityRole="alert" style={styles.message}>{status}</StyledText> : null}
        {!pending && !completed.current ? (
          <ActionButton label="appShell.security.biometricUnlock" onPress={() => void unlockWithDevice()} variant="quiet" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, justifyContent: 'center', padding: 24 },
  recovery: { gap: 12, justifyContent: 'center' },
  message: { textAlign: 'center' }
});
