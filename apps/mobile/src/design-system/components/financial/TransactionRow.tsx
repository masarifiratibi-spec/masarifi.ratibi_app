import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/design-system/components/StatusBadge';
import { useTheme } from '@/state/theme-context';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import {
  AmountText,
  CategoryIcon,
  FinancialBadge,
  type FinancialMeaning
} from './FinancialPrimitives';

export function TransactionRow({
  title,
  category,
  date,
  account,
  source,
  meaning,
  statusLabel,
  amount,
  currency,
  onPress
}: {
  title: string;
  category: string;
  date: string;
  account: string;
  source: string;
  meaning: FinancialMeaning;
  statusLabel?: string;
  amount: number;
  currency: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { revealed } = useSensitiveVisibility();
  const announcement = `${title}, ${category}, ${date}, ${account}, ${source}, ${statusLabel ?? meaning}`;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={announcement}
      onPress={onPress}
      style={[styles.row, { borderColor: theme.colors.border }]}
    >
      <CategoryIcon
        label={category}
        initials={category.slice(0, 2).toUpperCase()}
      />
      <View style={styles.main}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <View style={styles.meta}>
          {[category, date, account, source].map((item) => (
            <Text key={item} style={{ color: theme.colors.textSecondary }}>
              {item}
            </Text>
          ))}
        </View>
        <View style={styles.badges}>
          <FinancialBadge meaning={meaning} label={meaning} />
          {statusLabel ? (
            <StatusBadge status="warning" label={statusLabel} />
          ) : null}
        </View>
      </View>
      <View style={styles.amount}>
        <AmountText
          value={amount}
          currency={currency}
          meaning={meaning}
          masked={!revealed}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12
  },
  main: {
    flex: 1,
    gap: 6
  },
  amount: { flexShrink: 1 },
  title: {
    fontSize: 15,
    fontWeight: '700'
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  }
});
