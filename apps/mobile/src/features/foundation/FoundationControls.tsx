/**
 * FoundationControls — accessible locale, theme, motion, and privacy toggles.
 *
 * Every control exposes an accessible name, role, and state. Touch targets meet
 * the 44x44 minimum (Constitution Principle III, UI Contract §8). Controls read
 * and write the preference store; direction is derived from locale.
 */

import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';
import { minTouchTarget } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import type { Locale, ThemePreference } from '@/domain/foundation';

const LOCALES: Locale[] = ['ar', 'en'];
const THEMES: ThemePreference[] = ['light', 'dark', 'system'];

export function FoundationControls() {
  const theme = useTheme();
  const locale = usePreferenceStore((s) => s.locale);
  const setLocale = usePreferenceStore((s) => s.setLocale);
  const themePref = usePreferenceStore((s) => s.theme);
  const setTheme = usePreferenceStore((s) => s.setTheme);
  const reducedMotion = usePreferenceStore((s) => s.reducedMotion);
  const setReducedMotion = usePreferenceStore((s) => s.setReducedMotion);
  const hideBalances = usePreferenceStore((s) => s.hideBalances);
  const toggleHideBalances = usePreferenceStore((s) => s.toggleHideBalances);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <SegmentedControl
        label={translate('a11y.locale')}
        options={LOCALES.map((l) => ({
          value: l,
          label:
            l === 'ar'
              ? translate('common.arabic')
              : translate('common.english')
        }))}
        selected={locale}
        onSelect={(v) => setLocale(v as Locale)}
      />
      <SegmentedControl
        label={translate('a11y.theme')}
        options={THEMES.map((t) => ({
          value: t,
          label: themeLabel(t)
        }))}
        selected={themePref}
        onSelect={(v) => setTheme(v as ThemePreference)}
      />
      <ToggleRow
        label={translate('a11y.reducedMotion')}
        value={reducedMotion}
        onValueChange={setReducedMotion}
      />
      <ToggleRow
        label={translate('a11y.hideBalances')}
        value={hideBalances}
        onValueChange={toggleHideBalances}
      />
    </View>
  );
}

function themeLabel(pref: ThemePreference): string {
  switch (pref) {
    case 'light':
      return translate('common.light');
    case 'dark':
      return translate('common.dark');
    case 'system':
      return translate('common.system');
  }
}

interface SegmentedControlProps {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

function SegmentedControl({
  label,
  options,
  selected,
  onSelect
}: SegmentedControlProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <StyledText variant="body">{label}</StyledText>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: active }}
              style={[
                styles.segment,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surface,
                  minHeight: minTouchTarget
                }
              ]}
            >
              <StyledText
                variant="body"
                style={{
                  color: active
                    ? theme.colors.textInverse
                    : theme.colors.textPrimary
                }}
              >
                {opt.label}
              </StyledText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

function ToggleRow({ label, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <StyledText variant="body">{label}</StyledText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    gap: 12
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  segments: {
    flexDirection: 'row',
    gap: 8
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
