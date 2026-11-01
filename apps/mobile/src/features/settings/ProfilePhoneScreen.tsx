import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useAppShellStore } from '@/state/app-shell';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSaveSettingsProfile, useSettingsProfile } from './settings-queries';
import { colorTokens } from '@/design-system/tokens';

export function ProfilePhoneScreen() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return <ProfilePhoneContent key={ownerId} />;
}

function ProfilePhoneContent() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);

  const profile = useSettingsProfile();
  const save = useSaveSettingsProfile();

  const [edits, setEdits] = useState<{
    countryCode?: string;
    phoneNumber?: string;
  }>({});
  const saved = splitPhone(profile.data?.phone);
  const countryCode = edits.countryCode ?? saved.countryCode;
  const phoneNumber = edits.phoneNumber ?? saved.phoneNumber;
  const setCountryCode = (value: string) =>
    setEdits((current) => ({ ...saved, ...current, countryCode: value }));
  const setPhoneNumber = (value: string) =>
    setEdits((current) => ({ ...saved, ...current, phoneNumber: value }));
  const [errorText, setErrorText] = useState<string | null>(null);
  const saveBlocked = save.isPending || profile.isError || profile.isFetching;

  if (profile.isLoading && !hasReadableSnapshot(profile)) {
    return (
      <StateView
        state="loading"
        title={translateDynamic('settings.profile.loading')}
      />
    );
  }

  if (!hasReadableSnapshot(profile) || !profile.data) {
    return (
      <StateView
        state="error"
        title={translateDynamic('settings.profile.error')}
      />
    );
  }

  const handleSave = () => {
    if (saveBlocked) return;
    const rawDigits = phoneNumber.replace(/\D/g, '');
    if (rawDigits.length < 7) {
      setErrorText('appShell.error.unknown');
      return;
    }

    const fullPhone = `${countryCode.trim()}${rawDigits}`;
    setErrorText(null);

    save.mutate(
      {
        input: { ...profile.data, phone: fullPhone },
        expectedVersion: profile.data.version,
        operationId: `settings-profile-phone-${Date.now()}`
      },
      {
        onSuccess: () => {
          router.back();
        }
      }
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.stack,
        { backgroundColor: theme.colors.surfaces.page }
      ]}
    >
      <AppBar
        title={translateDynamic('settings.profile.phone.title')}
        onBack={() => router.back()}
        direction={direction}
      />

      {/* Header Info */}
      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <DesignIcon
            name="phone"
            label="Phone"
            color={colorTokens.raw['1F7A5A']}
            size="xl"
            decorative
          />
        </View>
        <StyledText style={styles.heroTitle} variant="subtitle">
          {translateDynamic('settings.profile.phone.title')}
        </StyledText>
        <StyledText style={styles.heroSubtitle}>
          {translateDynamic('settings.profile.phone.subtitle')}
        </StyledText>
      </View>

      <FinancialRefreshStatus query={profile} />
      {/* Current Phone Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        <StyledText style={styles.cardLabel} variant="caption">
          {translateDynamic('settings.profile.phone.current')}
        </StyledText>
        <StyledText style={styles.currentPhoneValue}>
          {profile.data.phone ??
            translateDynamic('settings.profile.phone.notSet')}
        </StyledText>
      </View>

      {/* Edit Form */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        <FormField
          label={translateDynamic('appShell.auth.phone.countryCode')}
          value={countryCode}
          onChangeText={setCountryCode}
          variant="phone"
        />
        <FormField
          label={translateDynamic('appShell.auth.phone.number')}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          variant="phone"
          errorText={errorText ? translateDynamic(errorText) : undefined}
        />
        <ActionButton
          label={translateDynamic('settings.profile.phone.save')}
          loading={save.isPending}
          disabled={saveBlocked}
          onPress={handleSave}
        />
      </View>
    </ScrollView>
  );
}

function splitPhone(existing?: string | null) {
  const fallback = { countryCode: '+966', phoneNumber: existing ?? '' };
  if (!existing?.startsWith('+')) return fallback;
  const knownCodes = [
    '+966',
    '+971',
    '+965',
    '+974',
    '+973',
    '+968',
    '+962',
    '+961',
    '+20',
    '+1',
    '+44'
  ];
  const matched = knownCodes.find((code) => existing.startsWith(code));
  if (matched)
    return {
      countryCode: matched,
      phoneNumber: existing.slice(matched.length).trim()
    };
  const generic = existing.match(/^(\+\d{1,3})(.*)$/);
  return generic
    ? { countryCode: generic[1], phoneNumber: generic[2].trim() }
    : fallback;
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  heroSection: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colorTokens.raw['EBF5EC'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colorTokens.raw['10231F']
  },
  heroSubtitle: {
    fontSize: 13,
    color: colorTokens.raw['707870'],
    textAlign: 'center',
    paddingHorizontal: spacing.lg
  },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md
  },
  cardLabel: {
    color: colorTokens.raw['707870'],
    fontSize: 12
  },
  currentPhoneValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colorTokens.raw['10231F']
  }
});
