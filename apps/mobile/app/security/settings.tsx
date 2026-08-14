import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import type { PrivacyLockPreference } from '@/domain/app-shell';
import { createBiometricService } from '@/services/platform/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

const autoLockOptions: PrivacyLockPreference['autoLockDuration'][] = [
  'immediate',
  'one_minute',
  'five_minutes',
  'fifteen_minutes'
];

export default function SecuritySettingsRoute() {
  const service = useMemo(createBiometricService, []);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const setPrivacyLock = useAppShellStore((state) => state.setPrivacyLock);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const toggleHideBalances = usePreferenceStore((state) => state.toggleHideBalances);

  useEffect(() => {
    void service
      .getAvailability()
      .then((result) => setBiometricAvailable(result.status === 'supported'));
  }, [service]);

  async function updateLock(update: Partial<PrivacyLockPreference>) {
    if (!privacyLock) return;
    await setPrivacyLock({ ...privacyLock, ...update });
  }

  return (
    <View style={styles.stack}>
      <StyledText variant="title">{translate('appShell.security.settingsTitle')}</StyledText>
      <ActionButton
        label={translate(
          privacyLock
            ? 'appShell.security.changePin'
            : 'appShell.security.pin.create'
        )}
        onPress={() =>
          router.push(privacyLock ? '/security/pin/change' : '/security/pin/create')
        }
      />
      {privacyLock ? (
        <ActionButton
          label={translate('appShell.security.forgotPin')}
          onPress={() => router.push('/security/pin/forgot')}
          variant="secondary"
        />
      ) : null}
      <ActionButton
        disabled={!privacyLock || !biometricAvailable}
        label={translate(
          !biometricAvailable
            ? 'appShell.security.biometricUnavailable'
            : privacyLock?.biometricStatus === 'enabled'
              ? 'appShell.security.biometric.disable'
              : 'appShell.security.biometric.enable'
        )}
        onPress={() =>
          updateLock({
            biometricStatus:
              privacyLock?.biometricStatus === 'enabled' ? 'disabled' : 'enabled'
          })
        }
        variant="secondary"
      />
      {autoLockOptions.map((duration) => (
        <ActionButton
          accessibilityState={{ selected: privacyLock?.autoLockDuration === duration }}
          disabled={!privacyLock}
          key={duration}
          label={translate(`appShell.security.autoLock.${duration}` as never)}
          onPress={() => updateLock({ autoLockDuration: duration })}
          variant={
            privacyLock?.autoLockDuration === duration ? 'primary' : 'secondary'
          }
        />
      ))}
      <ActionButton
        accessibilityState={{ selected: hideBalances }}
        label={translate('appShell.security.hideBalances')}
        onPress={toggleHideBalances}
        variant={hideBalances ? 'primary' : 'secondary'}
      />
      <ActionButton
        label={translate('appShell.security.sessions')}
        onPress={() => router.push('/security/sessions')}
        variant="secondary"
      />
      <ActionButton
        label={translate('appShell.security.events')}
        onPress={() => router.push('/security/events')}
        variant="secondary"
      />
      <ActionButton
        label={translate('appShell.security.localData')}
        onPress={() => router.push('/profile/privacy')}
        variant="destructive"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  }
});
