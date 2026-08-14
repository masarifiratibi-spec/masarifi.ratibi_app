import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';

export type FinancialMeaning =
  'income' | 'expense' | 'transfer' | 'refund' | 'savings' | 'debt';

export function AmountText({
  value,
  currency,
  meaning,
  masked = false
}: {
  value: number;
  currency: string;
  meaning: FinancialMeaning;
  masked?: boolean;
}) {
  const theme = useTheme();
  const color =
    meaning === 'expense' || meaning === 'debt'
      ? theme.colors.financial.expense
      : theme.colors.financial.income;
  const sign = meaning === 'expense' || meaning === 'debt' ? '-' : '+';
  const text = masked
    ? `•••• ${currency}`
    : `${sign}${Math.abs(value).toLocaleString('en-US')} ${currency}`;

  return (
    <Text
      accessibilityLabel={
        masked ? translate('designSystem.privacy.hidden') : text
      }
      style={[
        styles.amount,
        {
          color,
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr'
        }
      ]}
    >
      {text}
    </Text>
  );
}

export function FinancialBadge({
  meaning,
  label
}: {
  meaning: FinancialMeaning;
  label: string;
}) {
  const theme = useTheme();
  const color = theme.colors.financial[meaning];

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeCue, { color }]}>
        {meaning[0].toUpperCase()}
      </Text>
      <Text style={[styles.badgeLabel, { color: theme.colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

export function CategoryIcon({
  label,
  initials
}: {
  label: string;
  initials: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      style={[styles.categoryIcon, { borderColor: theme.colors.border }]}
    >
      <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontSize: 22,
    fontWeight: '700'
  },
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeCue: {
    fontWeight: '700'
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44
  }
});
