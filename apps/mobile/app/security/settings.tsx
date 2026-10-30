import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { AccountDeletionPanel } from '@/features/settings/AccountDeletionPanel';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { spacing } from '@/design-system/tokens';
import { isAppLockEnabled } from '@/config/client-runtime';
import { translate, type MessageKey } from '@/localization/i18n';
import type { PrivacyLockPreference } from '@/domain/app-shell';
import type { BiometricAvailability } from '@/services/contracts/app-shell-service';
import { createBiometricService } from '@/services/platform/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

type AutoLockDuration = PrivacyLockPreference['autoLockDuration'];

const autoLockDurations: readonly AutoLockDuration[] = [
  'immediate',
  'one_minute',
  'five_minutes',
  'fifteen_minutes'
];

export default function SecuritySettingsRoute() {
  const appLockEnabled = isAppLockEnabled();
  const session = useAppShellStore(state => state.session);
  const service = useMemo(() => createBiometricService(session?.userId ?? null), [session?.userId]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const [availability, setAvailability] =
    useState<BiometricAvailability | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<MessageKey>();
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const setPrivacyLock = useAppShellStore((state) => state.setPrivacyLock);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const toggleHideBalances = usePreferenceStore(
    (state) => state.toggleHideBalances
  );

  useEffect(() => {
    if (!appLockEnabled) return;
    void service
      .getAvailability()
      .then(setAvailability)
      .catch(() => setAvailability({ status: 'unsupported', kinds: [] }));
  }, [service, appLockEnabled]);

  async function updateLock(update: Partial<PrivacyLockPreference>) {
    if (!mounted.current || useAppShellStore.getState().session !== session) return;
    await setPrivacyLock({ enabled: false, autoLockDuration: 'immediate', appLockStatus: 'unlocked', ...privacyLock, ...update });
  }

  async function updateBiometric(next: boolean) {
    if (!appLockEnabled || biometricPending) return;
    const expectedSession = session;
    setBiometricMessage(undefined);
    if (!next) {
      await updateLock({ enabled: false, appLockStatus: 'unlocked' });
      return;
    }
    setBiometricPending(true);
    try {
      const authentication = await service.authenticate();
      if (!mounted.current || useAppShellStore.getState().session !== expectedSession) return;
      if (authentication.status === 'authenticated') {
        await updateLock({ enabled: true, appLockStatus: 'unlocked' });
      } else setBiometricMessage(`appShell.security.biometric.${authentication.status}`);
    } catch {
      if (mounted.current) setBiometricMessage('appShell.security.biometric.unavailable');
    } finally {
      if (mounted.current) setBiometricPending(false);
    }
  }

  function chooseAutoLockDuration() {
    Alert.alert(translate('appShell.security.autoLock.title'), undefined, [
      ...autoLockDurations.map((duration) => ({
        text: translate(`appShell.security.autoLock.${duration}`),
        onPress: () => void updateLock({ autoLockDuration: duration })
      })),
      { text: translate('coreFinance.cancel'), style: 'cancel' as const }
    ]);
  }

  const biometricKinds =
    availability?.status === 'supported' ? (availability.kinds ?? []) : [];
  const biometricReady = availability?.status === 'supported' && (biometricKinds.length > 0 || availability.deviceCredential === true);
  const prefersFace = biometricKinds.includes('face');
  const biometricBlockedKey = availability === null ? undefined
    : availability.status === 'not_enrolled' ? 'appShell.security.biometric.notEnrolled' as const
    : !biometricReady ? 'appShell.security.biometricUnavailable' as const : undefined;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.stack,
        { backgroundColor: theme.colors.surfaces.page }
      ]}
    >
      <AppBar
        direction={direction}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/more');
        }}
        title={translate('appShell.security.settingsTitle')}
      />

      {appLockEnabled ? (
        <GroupedList label={translate('appShell.security.sections.appLock')}>
          <View style={styles.insetRow}>
            <SwitchRow
              disabled={!biometricReady || biometricPending}
              icon={prefersFace ? 'faceId' : 'fingerprint'}
              label="appShell.security.nativeLock"
              subtext={
                biometricMessage ??
                biometricBlockedKey ??
                'appShell.security.nativeLockSubtitle'
              }
              value={privacyLock?.enabled === true}
              onValueChange={(next) => void updateBiometric(next)}
            />
          </View>
          <NavigationRow
            disabled={!privacyLock?.enabled}
            label={translate('appShell.security.autoLock.title')}
            value={translate(
              `appShell.security.autoLock.${privacyLock?.autoLockDuration ?? 'immediate'}`
            )}
            onPress={privacyLock?.enabled ? chooseAutoLockDuration : undefined}
          />
        </GroupedList>
      ) : (
        <StyledText>
          {translate('appShell.security.stagingDisabled')}
        </StyledText>
      )}

      <GroupedList label={translate('appShell.security.sections.privacy')}>
        <View style={styles.insetRow}>
          <SwitchRow
            icon="eyeSlash"
            label="appShell.security.hideBalances"
            value={hideBalances}
            onValueChange={toggleHideBalances}
          />
        </View>
      </GroupedList>

      <GroupedList label={translate('appShell.security.sections.activity')}>
        <NavigationRow
          label={translate('appShell.security.sessions')}
          onPress={() => router.push('/security/sessions')}
        />
        <NavigationRow
          label={translate('appShell.security.events')}
          onPress={() => router.push('/security/events')}
        />
      </GroupedList>

      <View style={styles.dangerZone}>
        <AccountDeletionPanel />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  },
  insetRow: {
    paddingHorizontal: spacing.lg
  },
  dangerZone: {
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
