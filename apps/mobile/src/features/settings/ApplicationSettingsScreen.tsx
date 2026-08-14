import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { usePreferenceStore } from '@/state/preferences';
import { StyledText } from '@/components/StyledText';
import { CheckboxRow, RadioCard, SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { FormField } from '@/design-system/components/forms/FormField';

export function ApplicationSettingsScreen() {
  const locale = usePreferenceStore((state) => state.locale);
  const theme = usePreferenceStore((state) => state.theme);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const toggleHideBalances = usePreferenceStore((state) => state.toggleHideBalances);
  const setLocale = usePreferenceStore((state) => state.setLocale);
  const setTheme = usePreferenceStore((state) => state.setTheme);
  const firstDayOfWeek = usePreferenceStore((state) => state.firstDayOfWeek);
  const defaultAccountId = usePreferenceStore((state) => state.defaultAccountId);
  const transactionDefaultType = usePreferenceStore((state) => state.transactionDefaultType);
  const dashboardSections = usePreferenceStore((state) => state.dashboardSections);
  const voiceEnabled = usePreferenceStore((state) => state.voiceEnabled);
  const update = usePreferenceStore((state) => state.updateApplicationPreferences);

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">settings.application.language</StyledText>
      {(['ar', 'en'] as const).map((value) => <RadioCard key={value} label={`settings.application.language.${value}`} selected={locale === value} onPress={() => setLocale(value)} />)}
      <StyledText variant="subtitle">settings.application.theme</StyledText>
      {(['system', 'light', 'dark'] as const).map((value) => <RadioCard key={value} label={`common.${value}`} selected={theme === value} onPress={() => setTheme(value)} />)}
      <StyledText variant="subtitle">settings.application.weekStart</StyledText>
      {(['sunday', 'monday', 'saturday'] as const).map((value) => <RadioCard key={value} label={`notifications.preferences.day.${value}`} selected={firstDayOfWeek === value} onPress={() => update({ firstDayOfWeek: value })} />)}
      <FormField label="settings.application.defaultAccount" value={defaultAccountId ?? ''} onChangeText={(value) => update({ defaultAccountId: value.trim() || null })} />
      <StyledText variant="subtitle">settings.application.transactionDefaults</StyledText>
      {(['expense', 'income'] as const).map((value) => <RadioCard key={value} label={`settings.application.transactionDefaults.${value}`} selected={transactionDefaultType === value} onPress={() => update({ transactionDefaultType: value })} />)}
      <StyledText variant="subtitle">settings.application.dashboard</StyledText>
      {(['balance', 'transactions', 'budgets', 'goals', 'reports'] as const).map((section) => <CheckboxRow key={section} label={`settings.application.dashboard.${section}`} checked={dashboardSections.includes(section)} onPress={() => update({ dashboardSections: dashboardSections.includes(section) ? dashboardSections.filter((item) => item !== section) : [...dashboardSections, section] })} />)}
      <SwitchRow label="settings.application.hideBalances" value={hideBalances} onValueChange={toggleHideBalances} />
      <SwitchRow label="settings.application.voiceOwner" value={voiceEnabled} onValueChange={(value) => update({ voiceEnabled: value })} />
      <ActionButton label="settings.application.trackingOwner" onPress={() => router.push('/tracking/settings')} />
      <ActionButton label="settings.application.voiceOwner" onPress={() => router.push('/voice/settings')} />
      <ActionButton label="settings.application.reportEmailOwner" onPress={() => router.push('/reports/schedule')} />
      <ActionButton label="settings.application.notificationsOwner" onPress={() => router.push('/notifications/preferences')} />
      <ActionButton label="settings.application.reportsOwner" onPress={() => router.push('/reports')} />
    </ScrollView>
  );
}
