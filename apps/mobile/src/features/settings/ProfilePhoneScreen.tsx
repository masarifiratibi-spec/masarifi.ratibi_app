import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import parsePhoneNumber, {
  getCountries,
  getCountryCallingCode,
  type CountryCode
} from 'libphonenumber-js/min';
import { PhoneCountryPicker } from './PhoneCountryPicker';
import { normalizeLocalizedNumber } from '@/domain/localized-number';
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
    country?: CountryCode;
    phoneNumber?: string;
  }>({});
  const saved = splitPhone(profile.data?.phone, profile.data?.country);
  const country = edits.country ?? saved.country;
  const phoneNumber = edits.phoneNumber ?? saved.phoneNumber;
  const setCountry = (value: CountryCode) =>
    setEdits((current) => ({ ...saved, ...current, country: value }));
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
    const digits = normalizeLocalizedNumber(phoneNumber).replace(
      /[\s()\-\u200e\u200f]/g,
      ''
    );
    const parsed = /^\d+$/.test(digits)
      ? parsePhoneNumber(digits, country)
      : undefined;
    if (
      !parsed?.isPossible() ||
      parsed.countryCallingCode !== getCountryCallingCode(country) ||
      !/^\+[1-9]\d{1,14}$/.test(parsed.number)
    ) {
      setErrorText('appShell.auth.phone.invalid');
      return;
    }
    const fullPhone = parsed.number;
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
        },
        onError: () => setErrorText('profileSetup.saveError')
      }
    );
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
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
        <StyledText
          style={[styles.heroTitle, { color: theme.colors.textPrimary }]}
          variant="subtitle"
        >
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
        <StyledText
          style={[
            styles.currentPhoneValue,
            { color: theme.colors.textPrimary }
          ]}
        >
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
        <PhoneCountryPicker country={country} onSelect={setCountry} />
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

function splitPhone(existing?: string | null, profileCountry?: string) {
  const fallback =
    getCountries().find((code) => code === profileCountry) ?? 'SA';
  const parsed =
    existing && !existing.includes('*')
      ? parsePhoneNumber(existing, fallback)
      : undefined;
  return {
    country:
      parsed?.country ??
      (parsed && parsed.countryCallingCode !== getCountryCallingCode(fallback)
        ? getCountries().find(
            (code) => getCountryCallingCode(code) === parsed.countryCallingCode
          )
        : undefined) ??
      fallback,
    phoneNumber:
      parsed?.nationalNumber ??
      (existing?.includes('*') ? '' : (existing ?? ''))
  };
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
    fontWeight: '700'
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
    fontWeight: '600'
  }
});
