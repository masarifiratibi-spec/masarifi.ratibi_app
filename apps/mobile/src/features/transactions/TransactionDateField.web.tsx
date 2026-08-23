import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { replaceLocalDate } from './transaction-date';

export function TransactionDateField({
  value,
  disabled = false,
  label: providedLabel,
  onChange
}: {
  value: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const label = providedLabel ?? translate('coreFinance.transaction.date');
  const date = new Date(value);
  const inputValue = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

  return (
    <View style={styles.stack}>
      <Text style={[styles.label, { color: theme.colors.content.primary }]}>
        {label}
      </Text>
      <input
        aria-label={label}
        disabled={disabled}
        dir={direction}
        type="date"
        value={inputValue}
        onInput={(event) => {
          const [year, month, day] = event.currentTarget.value
            .split('-')
            .map(Number);
          if (year && month && day) {
            onChange(
              replaceLocalDate(value, new Date(year, month - 1, day).getTime())
            );
          }
        }}
        style={{
          backgroundColor: theme.colors.surfaces.card,
          border: `1px solid ${theme.colors.borders.subtle}`,
          borderRadius: radius.lg,
          boxSizing: 'border-box',
          color: theme.colors.content.primary,
          fontFamily: 'inherit',
          fontSize: 16,
          minHeight: 56,
          opacity: disabled ? 0.56 : 1,
          padding: `${spacing.md}px ${spacing.lg}px`,
          width: '100%'
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 }
});
