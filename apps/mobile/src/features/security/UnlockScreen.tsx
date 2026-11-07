import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Image, ScrollView, StyleSheet, View } from 'react-native';
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
    let prompted = false;
    const promptWhenActive = (state: AppStateStatus) => {
      if (state !== 'active' || prompted || expired.current) return;
      prompted = true;
      void unlockWithDevice();
    };
    const subscription = AppState.addEventListener('change', promptWhenActive);
    promptWhenActive(AppState.currentState);
    return () => {
      subscription.remove();
      mounted.current = false;
      attempt.current += 1;
    };
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
      if (result.status === 'cancelled') return;
      const messages = {
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
    <ScrollView style={{ backgroundColor: theme.colors.surfaces.page }} contentContainerStyle={styles.cover}>
      <View style={styles.recovery}>
        <Image source={require('../../../assets/brand-mark.png')} accessible={false} style={styles.logo} />
        <StyledText accessibilityRole="header" variant="headline" style={styles.center}>
          {translate('appShell.security.nativeUnlock')}
        </StyledText>
        <StyledText accessibilityRole={status ? 'alert' : undefined} style={[styles.center, { color: theme.colors.textSecondary }]}>
          {status ?? translate('appShell.security.unlockHint')}
        </StyledText>
        {!pending && !completed.current ? (
          <ActionButton label="appShell.security.biometricUnlock" onPress={() => void unlockWithDevice()} style={styles.retry} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cover: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  recovery: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 12 },
  logo: { width: 72, height: 72, marginBottom: 8 },
  center: { textAlign: 'center' },
  retry: { alignSelf: 'stretch', marginTop: 12 }
});
