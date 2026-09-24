import React, { useEffect, useState } from 'react';
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

export function UnlockScreen({
  biometricService,
  onUnlock,
  sessionExpired = false
}: UnlockScreenProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (sessionExpired) return;
    void unlockWithBiometric();
    // The automatic prompt is a mount-time behavior: re-running it on later
    // renders would surprise users who already dismissed the prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlockWithBiometric() {
    setStatus(null);
    setPending(true);
    try {
      const result = await biometricService.authenticate();
      const messageByStatus = {
        cancelled: 'appShell.security.biometricCancelled',
        failed: 'appShell.security.biometricFailed',
        locked_out: 'appShell.security.biometricLocked',
        unavailable: 'appShell.security.biometricUnavailable'
      } as const;
      if (result.status === 'authenticated') {
        await onUnlock?.();
      } else {
        setStatus(translate(messageByStatus[result.status]));
      }
    } catch {
      setStatus(translate('appShell.security.biometricUnavailable'));
    } finally {
      setPending(false);
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
      {!pending && status ? (
        <View style={styles.recovery}>
          <StyledText accessibilityRole="alert" style={styles.message}>
            {status}
          </StyledText>
          <ActionButton
            label={translate('appShell.security.biometricUnlock')}
            onPress={unlockWithBiometric}
            variant="quiet"
          />
        </View>
      ) : null}
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
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center'
  },
  message: {
    textAlign: 'center'
  }
});
