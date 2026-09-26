import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { spacing } from '@/design-system/tokens';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { translate, type MessageKey } from '@/localization/i18n';
import type { PrivacyLockPreference } from '@/domain/app-shell';
import { createBiometricLock } from '@/features/security/privacy-lock';
import type { BiometricAvailability } from '@/services/contracts/app-shell-service';
import { createBiometricService } from '@/services/platform/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { usePrivacyRequest } from '@/features/settings/settings-queries';

type AutoLockDuration = PrivacyLockPreference['autoLockDuration'];

const autoLockDurations: readonly AutoLockDuration[] = [
  'immediate',
  'one_minute',
  'five_minutes',
  'fifteen_minutes'
];

export default function SecuritySettingsRoute() {
  const service = useMemo(createBiometricService, []);
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const [availability, setAvailability] =
    useState<BiometricAvailability | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<MessageKey>();
  const privacyLock = useAppShellStore((state) => state.privacyLock);
  const setPrivacyLock = useAppShellStore((state) => state.setPrivacyLock);
  const resetPrivacyLock = useAppShellStore((state) => state.resetPrivacyLock);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const toggleHideBalances = usePreferenceStore(
    (state) => state.toggleHideBalances
  );
  const deletionRequest = usePrivacyRequest();

  useEffect(() => {
    void service
      .getAvailability()
      .then(setAvailability)
      .catch(() => setAvailability({ status: 'unsupported', kinds: [] }));
  }, [service]);

  async function updateLock(update: Partial<PrivacyLockPreference>) {
    if (!privacyLock) return;
    await setPrivacyLock({ ...privacyLock, ...update });
  }

  async function updateBiometric(next: boolean) {
    setBiometricMessage(undefined);
    if (!next) {
      await resetPrivacyLock();
      return;
    }
    setBiometricPending(true);
    try {
      const authentication = await service.authenticate();
      if (authentication.status === 'authenticated') {
        await setPrivacyLock(createBiometricLock());
      } else {
        setBiometricMessage(
          `appShell.security.biometric.${authentication.status}`
        );
      }
    } catch {
      setBiometricMessage('appShell.security.biometric.unavailable');
    } finally {
      setBiometricPending(false);
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

  function confirmAccountDeletion() {
    Alert.alert(
      translate('appShell.security.deleteAccount'),
      translate('appShell.security.deleteAccount.confirmation'),
      [
        { text: translate('coreFinance.cancel'), style: 'cancel' },
        {
          text: translate('settings.privacy.confirmRequest'),
          style: 'destructive',
          onPress: () =>
            deletionRequest.mutate({
              kind: 'account_deletion',
              operationId: `security-account-deletion-${Date.now()}`
            })
        }
      ]
    );
  }

  const biometricKinds =
    availability?.status === 'supported' ? (availability.kinds ?? []) : [];
  const biometricReady =
    availability?.status === 'supported' && biometricKinds.length > 0;
  const prefersFace = biometricKinds.includes('face');
  const biometricBlockedKey =
    availability === null
      ? undefined
      : availability.status === 'not_enrolled'
        ? ('appShell.security.biometric.notEnrolled' as const)
        : availability.status !== 'supported' || biometricKinds.length === 0
          ? ('appShell.security.biometricUnavailable' as const)
          : undefined;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.stack,
        { backgroundColor: theme.colors.surfaces.page }
      ]}
    >
      <AppBar
        direction={direction}
        onBack={() => router.back()}
        title={translate('appShell.security.settingsTitle')}
      />

      <GroupedList label={translate('appShell.security.sections.appLock')}>
        <View style={styles.insetRow}>
          <SwitchRow
            disabled={!biometricReady || biometricPending}
            icon={prefersFace ? 'faceId' : 'fingerprint'}
            label={
              prefersFace
                ? 'appShell.security.biometric.face'
                : 'appShell.security.biometric.fingerprint'
            }
            subtext={
              biometricMessage ??
              biometricBlockedKey ??
              'appShell.security.biometric.subtitle'
            }
            value={privacyLock?.biometricStatus === 'enabled'}
            onValueChange={(next) => void updateBiometric(next)}
          />
        </View>
        <NavigationRow
          disabled={!privacyLock}
          label={translate('appShell.security.autoLock.title')}
          value={translate(
            `appShell.security.autoLock.${privacyLock?.autoLockDuration ?? 'immediate'}`
          )}
          onPress={privacyLock ? chooseAutoLockDuration : undefined}
        />
      </GroupedList>

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
        {isFixtureModeEnabled() ? (
          <NavigationRow
            label={translate('appShell.security.events')}
            onPress={() => router.push('/security/events')}
          />
        ) : null}
      </GroupedList>

      <View style={styles.dangerZone}>
        <StyledText style={{ color: theme.colors.content.secondary }}>
          {translate('appShell.security.deleteAccount.description')}
        </StyledText>
        <ActionButton
          label={translate('appShell.security.deleteAccount')}
          loading={deletionRequest.isPending}
          onPress={confirmAccountDeletion}
          variant="destructive"
        />
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
