import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  notificationCategorySchema,
  type NotificationPreferencesInput
} from '@/domain/notifications';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import { FormField } from '@/design-system/components/forms/FormField';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { useTheme } from '@/state/theme-context';
import { translateDynamic } from '@/localization/i18n';

import {
  useNotificationPreferences,
  useRefreshNotificationPermission,
  useRequestNotificationPermission,
  useSaveNotificationPreferences
} from './notification-preferences-queries';

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function NotificationPreferencesScreen() {
  const theme = useTheme();
  const preferences = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const refresh = useRefreshNotificationPermission();
  const request = useRequestNotificationPermission();
  const [input, setInput] = useState<NotificationPreferencesInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionEducationVisible, setPermissionEducationVisible] = useState(false);

  useEffect(() => {
    if (!preferences.data) return;
    setInput({
      phoneEnabled: preferences.data.phoneEnabled,
      categoryEnabled: preferences.data.categoryEnabled,
      quietHours: preferences.data.quietHours,
      dailySummary: preferences.data.dailySummary,
      weeklySummary: preferences.data.weeklySummary,
      hideAmountsOnLockScreen: preferences.data.hideAmountsOnLockScreen,
      permissionState: preferences.data.permissionState
    });
  }, [preferences.data]);

  if (preferences.isLoading) {
    return <StateView state="loading" title={t('notifications.preferences.loading')} />;
  }
  if (preferences.isError || !preferences.data) {
    return (
      <StateView
        state="offline"
        title={t('notifications.preferences.offline')}
        actionLabel={t('notifications.preferences.retry')}
        onAction={() => preferences.refetch()}
      />
    );
  }
  if (!input) {
    return <StateView state="loading" title={t('notifications.preferences.loading')} />;
  }

  const update = (patch: Partial<NotificationPreferencesInput>) =>
    setInput((current) => (current ? { ...current, ...patch } : current));
  const saveInput = () => {
    setError(null);
    save.mutate(
      {
        input,
        expectedVersion: preferences.data.version,
        operationId: `save-notification-preferences-${Date.now()}`
      },
      { onError: () => setError(t('notifications.preferences.saveError')) }
    );
  };
  const quietDayLabels = dayKeys.map((day) => `${t('notifications.preferences.quietPrefix')} ${t(`notifications.preferences.day.${day}`)}`);
  const weeklyDayLabels = dayKeys.map((day) => `${t('notifications.preferences.weeklyPrefix')} ${t(`notifications.preferences.day.${day}`)}`);

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{t('notifications.preferences.title')}</Text>
      <Text style={{ color: theme.colors.textSecondary }}>
        {`${t('notifications.preferences.currentPermission')}: ${input.permissionState.replaceAll('_', ' ')}`}
      </Text>
      {input.permissionState !== 'granted' ? (
        <Text style={{ color: theme.colors.status.warning }}>
          {`${t('notifications.preferences.permissionPrefix')} ${input.permissionState.replaceAll('_', ' ')}`}
        </Text>
      ) : null}
      <SwitchRow
        label={t('notifications.preferences.phone')}
        value={input.phoneEnabled}
        onValueChange={(phoneEnabled) => update({ phoneEnabled })}
      />
      <SwitchRow
        label={t('notifications.preferences.hideLock')}
        value={input.hideAmountsOnLockScreen}
        onValueChange={(hideAmountsOnLockScreen) => update({ hideAmountsOnLockScreen })}
      />

      <Section title={t('notifications.preferences.categories')}>
        {notificationCategorySchema.options.map((category) => (
          <SwitchRow
            key={category}
            label={`${t('notifications.preferences.categoryPrefix')} ${category}`}
            value={input.categoryEnabled[category] ?? false}
            onValueChange={(enabled) =>
              update({
                categoryEnabled: { ...input.categoryEnabled, [category]: enabled }
              })
            }
          />
        ))}
      </Section>

      <Section title={t('notifications.preferences.quietHours')}>
        <SwitchRow
          label={t('notifications.preferences.quietHours')}
          value={input.quietHours.enabled}
          onValueChange={(enabled) => update({ quietHours: { ...input.quietHours, enabled } })}
        />
        <FormField
          label={t('notifications.preferences.quietStart')}
          value={input.quietHours.start}
          onChangeText={(start) => update({ quietHours: { ...input.quietHours, start } })}
        />
        <FormField
          label={t('notifications.preferences.quietEnd')}
          value={input.quietHours.end}
          onChangeText={(end) => update({ quietHours: { ...input.quietHours, end } })}
        />
        <FormField
          label={t('notifications.preferences.quietTimezone')}
          value={input.quietHours.timeZone}
          onChangeText={(timeZone) => update({ quietHours: { ...input.quietHours, timeZone } })}
        />
        <ChipSelector
          options={quietDayLabels}
          selected={input.quietHours.weekdays.map((weekday) => quietDayLabels[weekday])}
          onToggle={(label) => {
            const weekday = quietDayLabels.indexOf(label);
            update({
              quietHours: {
                ...input.quietHours,
                weekdays: input.quietHours.weekdays.includes(weekday)
                  ? input.quietHours.weekdays.filter((value) => value !== weekday)
                  : [...input.quietHours.weekdays, weekday].sort()
              }
            });
          }}
        />
      </Section>

      <Section title={t('notifications.preferences.summaries')}>
        <SwitchRow
          label={t('notifications.preferences.dailySummary')}
          value={input.dailySummary.enabled}
          onValueChange={(enabled) => update({ dailySummary: { ...input.dailySummary, enabled } })}
        />
        <FormField
          label={t('notifications.preferences.dailyTime')}
          value={input.dailySummary.time}
          onChangeText={(time) => update({ dailySummary: { ...input.dailySummary, time } })}
        />
        <SwitchRow
          label={t('notifications.preferences.weeklySummary')}
          value={input.weeklySummary.enabled}
          onValueChange={(enabled) => update({ weeklySummary: { ...input.weeklySummary, enabled } })}
        />
        <FormField
          label={t('notifications.preferences.weeklyTime')}
          value={input.weeklySummary.time}
          onChangeText={(time) => update({ weeklySummary: { ...input.weeklySummary, time } })}
        />
        <ChipSelector
          options={weeklyDayLabels}
          selected={[weeklyDayLabels[input.weeklySummary.weekday]]}
          onToggle={(label) => update({ weeklySummary: { ...input.weeklySummary, weekday: Math.max(0, weeklyDayLabels.indexOf(label)) } })}
        />
      </Section>

      <View style={styles.row}>
        <ActionButton label={t('notifications.preferences.reviewPermission')} loading={request.isPending} onPress={() => setPermissionEducationVisible(true)} />
        <ActionButton label={t('notifications.preferences.refreshPermission')} loading={refresh.isPending} variant="secondary" onPress={() => refresh.mutate()} />
        <ActionButton label={t('notifications.preferences.openSettings')} variant="secondary" onPress={() => void phoneNotificationService.openSystemSettings()} />
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.status.danger }}>{error}</Text> : null}
      <ActionButton label={t('notifications.preferences.save')} loading={save.isPending} onPress={saveInput} />
      <ConfirmationDialog
        visible={permissionEducationVisible}
        title={t('notifications.preferences.requestTitle')}
        message={t('notifications.preferences.requestMessage')}
        confirmLabel={t('notifications.preferences.requestConfirm')}
        onCancel={() => setPermissionEducationVisible(false)}
        onConfirm={() => {
          setPermissionEducationVisible(false);
          request.mutate();
        }}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <SurfaceCard style={styles.section}>
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>{title}</Text>
      {children}
    </SurfaceCard>
  );
}

function t(key: string) {
  return translateDynamic(key);
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    padding: 16
  },
  section: {
    gap: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  title: {
    fontSize: 24,
    fontWeight: '700'
  },
  heading: {
    fontSize: 18,
    fontWeight: '700'
  }
});
