import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';

import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { type AppIconName, DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSaveSettingsProfile, useSettingsProfile } from './settings-queries';
import { colorTokens } from '@/design-system/tokens';
import { useAppShellStore } from '@/state/app-shell';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';

type ProfileEdits = {
  name?: string;
  email?: string;
  gender?: 'male' | 'female' | null;
  birthday?: string;
};

export function ProfileScreen() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const profile = useSettingsProfile();
  const save = useSaveSettingsProfile();
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const [draft, setDraft] = useState<{
    ownerId: string | null;
    edits: ProfileEdits;
    error: string | null;
  }>({ ownerId, edits: {}, error: null });
  const edits = draft.ownerId === ownerId ? draft.edits : {};
  const name = edits.name ?? profile.data?.name ?? '';
  const email = edits.email ?? profile.data?.email ?? '';
  const birthday = edits.birthday ?? profile.data?.birthday;
  const [birthdayPicker, setBirthdayPicker] = useState<{
    ownerId: string | null;
    date: Date;
  } | null>(null);
  const selectedGender =
    edits.gender === undefined ? (profile.data?.gender ?? null) : edits.gender;
  const error = draft.ownerId === ownerId ? draft.error : null;
  const updateDraft = (
    fields: ProfileEdits,
    nextError: string | null = null
  ) => {
    if (save.isSuccess || save.isError) save.reset();
    setDraft((current) => ({
      ownerId,
      edits: {
        ...(current.ownerId === ownerId ? current.edits : {}),
        ...fields
      },
      error: nextError
    }));
  };

  if (profile.isLoading && !profile.data) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.stack,
          { backgroundColor: theme.colors.surfaces.page }
        ]}
      >
        <AppBar
          title={translateDynamic('settings.profile.title')}
          onBack={() => router.back()}
          direction={direction}
        />
        <View accessibilityState={{ busy: true }} />
      </ScrollView>
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

  const initial = (name || profile.data.name || 'M')
    .trim()
    .charAt(0)
    .toUpperCase();
  const avatarLabel =
    profile.data.avatar === 'default'
      ? translateDynamic('settings.profile.avatar.default')
      : profile.data.avatar;

  const saveBlocked = save.isPending || profile.isError || profile.isFetching;
  const saveFields = (fields: ProfileEdits = {}) => {
    if (saveBlocked) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      updateDraft({}, 'settings.profile.validation.email');
      return;
    }

    updateDraft({});
    save.mutate({
      input: {
        ...profile.data,
        name,
        email: trimmedEmail || null,
        gender: selectedGender,
        birthday,
        ...fields
      },
      expectedVersion: profile.data.version,
      operationId: `settings-profile-${Date.now()}`
    });
  };

  const handleGenderSelect = (gender: 'male' | 'female') => {
    updateDraft({ gender });
    saveFields({ gender });
  };

  const saveBirthday = (date: Date) => {
    if ((useAppShellStore.getState().session?.userId ?? null) !== ownerId)
      return;
    if (date.getTime() > Date.now() || !Number.isFinite(date.getTime())) return;
    const selected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    updateDraft({ birthday: selected });
    saveFields({ birthday: selected });
    setBirthdayPicker(null);
  };
  const openBirthdayPicker = () => {
    if (saveBlocked) return;
    const [year, month, day] = birthday?.split('-').map(Number) ?? [];
    const date =
      year && month && day
        ? new Date(year, month - 1, day)
        : new Date(2000, 0, 1);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        maximumDate: new Date(),
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) saveBirthday(selected);
        }
      });
    } else {
      setBirthdayPicker({ ownerId, date });
    }
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
        title={translateDynamic('settings.profile.title')}
        onBack={() => router.back()}
        direction={direction}
      />
      <FinancialRefreshStatus query={profile} />

      {/* Profile Hero Presentation */}
      <View style={styles.heroSection}>
        <View style={styles.avatarCircle}>
          <StyledText style={styles.avatarInitial} accessible={false}>
            {initial}
          </StyledText>
        </View>

        <StyledText style={styles.avatarSubText} variant="caption">
          {avatarLabel}
        </StyledText>

        <View style={styles.activityPill}>
          <StyledText style={styles.activityPillText}>
            {translateDynamic('settings.profile.activity')}
          </StyledText>
        </View>
      </View>

      {/* Account Info & Edit Form Card */}
      <View
        style={[
          styles.cardGroup,
          styles.formCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }
        ]}
      >
        <FormField
          label={translateDynamic('settings.profile.name')}
          value={name}
          onChangeText={(value) => updateDraft({ name: value })}
        />
        <FormField
          label={translateDynamic('settings.profile.email')}
          value={email}
          onChangeText={(value) => updateDraft({ email: value })}
          errorText={error ? translateDynamic(error) : undefined}
        />
        <ActionButton
          label={translateDynamic('settings.profile.save')}
          loading={save.isPending}
          disabled={saveBlocked}
          onPress={() => saveFields()}
        />
        {save.isError ? (
          <StyledText
            accessibilityRole="alert"
            style={{ color: theme.colors.status.danger }}
          >
            profileSetup.saveError
          </StyledText>
        ) : save.isSuccess ? (
          <StyledText accessibilityLiveRegion="polite">
            settings.profile.saved
          </StyledText>
        ) : null}
      </View>

      {/* Grouped Account Details Card */}
      <View style={styles.section}>
        <StyledText style={styles.sectionHeading} variant="subtitle">
          {translateDynamic('settings.profile.details')}
        </StyledText>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          {/* 1. Phone Number */}
          <ProfileRow
            icon="phone"
            iconBg={colorTokens.raw['EBF5EC']}
            iconFg={colorTokens.raw['1F7A5A']}
            label={translateDynamic('settings.profile.phone')}
            value={
              profile.data.phone ??
              translateDynamic('settings.profile.phone.notSet')
            }
            onPress={() => router.push('/profile/phone')}
            showChevron
          />

          <ProfileDivider />

          {/* 2. Birthday */}
          <ProfileRow
            icon="gift"
            iconBg={colorTokens.raw['FFF8E7']}
            iconFg={colorTokens.raw['D48B17']}
            label={translateDynamic('settings.profile.birthday')}
            value={
              birthday ?? translateDynamic('settings.profile.birthday.notSet')
            }
            onPress={saveBlocked ? undefined : openBirthdayPicker}
            showChevron
          />

          <ProfileDivider />

          {/* 3. Gender Segmented Row */}
          <View
            style={[
              styles.row,
              { flexDirection: isRtl ? 'row-reverse' : 'row' }
            ]}
          >
            <View
              style={[
                styles.rowLeft,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: colorTokens.raw['EAF2FB'] }
                ]}
              >
                <DesignIcon
                  name="profile"
                  label={translateDynamic('settings.profile.gender')}
                  color={colorTokens.raw['2E7087']}
                  size="control"
                  direction={direction}
                  decorative
                />
              </View>
              <StyledText
                style={[styles.rowLabel, { color: theme.colors.textPrimary }]}
              >
                {translateDynamic('settings.profile.gender')}
              </StyledText>
            </View>

            {/* Segmented Male / Female Pills */}
            <View
              style={[
                styles.genderPillsGroup,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedGender === 'male' }}
                accessibilityLabel={translateDynamic(
                  'settings.profile.gender.male'
                )}
                onPress={() => handleGenderSelect('male')}
                style={[
                  styles.genderPill,
                  selectedGender === 'male' && styles.genderPillActive
                ]}
              >
                <StyledText
                  style={[
                    styles.genderPillText,
                    selectedGender === 'male' && styles.genderPillTextActive
                  ]}
                >
                  {translateDynamic('settings.profile.gender.male')}
                </StyledText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedGender === 'female' }}
                accessibilityLabel={translateDynamic(
                  'settings.profile.gender.female'
                )}
                onPress={() => handleGenderSelect('female')}
                style={[
                  styles.genderPill,
                  selectedGender === 'female' && styles.genderPillActive
                ]}
              >
                <StyledText
                  style={[
                    styles.genderPillText,
                    selectedGender === 'female' && styles.genderPillTextActive
                  ]}
                >
                  {translateDynamic('settings.profile.gender.female')}
                </StyledText>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      {birthdayPicker && birthdayPicker.ownerId === ownerId ? (
        <AppSheet
          title={translateDynamic('settings.profile.birthday')}
          visible
          onDismiss={() => setBirthdayPicker(null)}
        >
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={birthdayPicker.date}
              maximumDate={new Date()}
              mode="date"
              display="spinner"
              locale={isRtl ? 'ar' : 'en'}
              themeVariant={theme.mode}
              onChange={(event, date) => {
                if (event.type === 'set' && date)
                  setBirthdayPicker({ ownerId, date });
              }}
            />
          ) : (
            <TransactionDateField
              label={translateDynamic('settings.profile.birthday')}
              value={birthdayPicker.date.getTime()}
              maximumDate={new Date()}
              onChange={(timestamp) =>
                setBirthdayPicker({ ownerId, date: new Date(timestamp) })
              }
            />
          )}
          <ActionButton
            label="settings.profile.save"
            disabled={saveBlocked}
            onPress={() => saveBirthday(birthdayPicker.date)}
          />
        </AppSheet>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  onPress,
  showChevron
}: {
  icon: AppIconName;
  iconBg: string;
  iconFg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: isRtl ? 'row-reverse' : 'row' },
        pressed && onPress && { backgroundColor: theme.colors.surfaceMuted }
      ]}
    >
      <View
        style={[
          styles.rowLeft,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
          <DesignIcon
            name={icon}
            label={label}
            color={iconFg}
            size="control"
            direction={direction}
            decorative
          />
        </View>
        <StyledText
          style={[styles.rowLabel, { color: theme.colors.textPrimary }]}
        >
          {label}
        </StyledText>
      </View>

      <View
        style={[
          styles.rowRight,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {value ? (
          <StyledText
            style={[styles.rowValue, { color: theme.colors.content.secondary }]}
          >
            {value}
          </StyledText>
        ) : null}
        {showChevron ? (
          <DesignIcon
            name="chevronEnd"
            label={label}
            color={theme.colors.textSecondary}
            direction={direction}
            decorative
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function ProfileDivider() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: theme.colors.border,
          marginStart: 56
        }
      ]}
    />
  );
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
    paddingVertical: spacing.sm
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorTokens.raw['103F37'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs
  },
  avatarInitial: {
    color: colorTokens.raw['FFFFFF'],
    fontSize: 32,
    fontWeight: '700'
  },
  avatarSubText: {
    color: colorTokens.raw['707870'],
    fontSize: 13
  },
  activityPill: {
    backgroundColor: colorTokens.raw['EBF5EC'],
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: spacing.xs
  },
  activityPillText: {
    color: colorTokens.raw['103F37'],
    fontSize: 12,
    fontWeight: '600'
  },
  cardGroup: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  formCard: {
    padding: spacing.md,
    gap: spacing.md
  },
  section: {
    gap: spacing.xs
  },
  sectionHeading: {
    color: colorTokens.raw['707870'],
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 4
  },
  row: {
    alignItems: 'center',
    ...layoutDirectionStyle('ltr'),
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52
  },
  rowLeft: {
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  rowRight: {
    alignItems: 'center',
    gap: spacing.xs
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colorTokens.raw['10231F']
  },
  rowValue: {
    fontSize: 13,
    color: colorTokens.raw['707870']
  },
  divider: {
    height: StyleSheet.hairlineWidth
  },
  genderPillsGroup: {
    backgroundColor: colorTokens.raw['F1F5F3'],
    borderRadius: 20,
    padding: 3,
    gap: 4
  },
  genderPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16
  },
  genderPillActive: {
    backgroundColor: colorTokens.raw['FFFFFF'],
    shadowColor: colorTokens.raw['000'],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  genderPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colorTokens.raw['707870']
  },
  genderPillTextActive: {
    color: colorTokens.raw['103F37'],
    fontWeight: '700'
  }
});
