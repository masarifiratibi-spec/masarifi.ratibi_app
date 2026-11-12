import React, { useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { router, usePathname } from 'expo-router';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { useVoiceUpdateInteraction } from '@/state/voice-update-interaction';
import { useTheme } from '@/state/theme-context';
import { isAppLockEnabled, isBenchmarkReadOnly } from '@/config/client-runtime';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { openAndroidStore } from './app-update';
import { useAppUpdate } from './useAppUpdate';
import { updateCopy } from './update-copy';

function updatesEnabled() {
  return (
    Platform.OS === 'android' &&
    Constants.executionEnvironment !== 'storeClient' &&
    !isFixtureModeEnabled() &&
    !isBenchmarkReadOnly()
  );
}

function UpdateControls({
  version,
  onLater
}: {
  version: string;
  onLater?: () => void;
}) {
  const locale = usePreferenceStore((state) => state.locale);
  const text = updateCopy[locale];
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setFailed(false);
    try {
      await openAndroidStore(Linking.openURL);
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <StyledText>{text.body(version)}</StyledText>
      {failed ? (
        <StyledText accessibilityRole="alert">{text.storeError}</StyledText>
      ) : null}
      <ActionButton
        label={text.update}
        loading={opening}
        onPress={() => {
          void open();
        }}
      />
      {onLater ? (
        <ActionButton
          label={text.later}
          variant="secondary"
          onPress={onLater}
        />
      ) : null}
    </View>
  );
}

export function AppUpdateNotice() {
  const pathname = usePathname();
  const preparingVoice = useVoiceUpdateInteraction(
    (state) => state.pending > 0
  );
  const voiceIdle = useVoiceCaptureStore(
    (state) =>
      ['idle', 'saved', 'canceled'].includes(state.state) ||
      (['ready', 'failed', 'permission_required'].includes(state.state) &&
        !state.group &&
        !state.audioReference &&
        !state.recordingId)
  );
  const hydrated = useAppShellStore((state) => state.hydrated);
  const authenticated = useAppShellStore(
    (state) => state.session?.status === 'authenticated'
  );
  const unlocked = useAppShellStore(
    (state) =>
      !isAppLockEnabled() ||
      !state.privacyLock?.enabled ||
      state.privacyLock.appLockStatus === 'unlocked'
  );
  const enabled =
    updatesEnabled() &&
    hydrated &&
    authenticated &&
    unlocked &&
    !preparingVoice &&
    voiceIdle &&
    ['/home', '/more', '/notifications'].includes(pathname);
  const update = useAppUpdate(enabled);
  const locale = usePreferenceStore((state) => state.locale);
  const visible =
    enabled &&
    update.status === 'available' &&
    !update.snoozed &&
    update.policy?.enabled;
  if (!visible || !update.policy?.enabled) return null;
  return (
    <AppSheet
      visible
      title={updateCopy[locale].title}
      onDismiss={() => {
        void update.postpone();
      }}
    >
      <UpdateControls
        version={update.policy.release.version}
        onLater={() => {
          void update.postpone();
        }}
      />
    </AppSheet>
  );
}

export function AppUpdateScreen() {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  const text = updateCopy[locale];
  const enabled = updatesEnabled();
  const update = useAppUpdate(enabled, true);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}>
      <AppBar title={text.page} direction={direction} onBack={back} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: 16,
          direction
        }}
      >
        {!enabled ? (
          <StyledText>{text.unsupported}</StyledText>
        ) : update.status === 'available' && update.policy?.enabled ? (
          <UpdateControls version={update.policy.release.version} />
        ) : (
          <StyledText
            accessibilityRole={
              update.status === 'unavailable' ? 'alert' : 'text'
            }
          >
            {
              text[
                update.status === 'checking'
                  ? 'checking'
                  : update.status === 'unavailable'
                    ? 'unavailable'
                    : 'current'
              ]
            }
          </StyledText>
        )}
        {enabled && update.status === 'unavailable' ? (
          <ActionButton
            label={text.retry}
            onPress={() => {
              void update.refresh(true);
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

export function AppUpdateSettingsEntry() {
  const locale = usePreferenceStore((state) => state.locale);
  if (Platform.OS !== 'android') return null;
  return (
    <GroupedList label={updateCopy[locale].page}>
      <NavigationRow
        label={updateCopy[locale].check}
        onPress={() => router.push('/app-update')}
      />
    </GroupedList>
  );
}
