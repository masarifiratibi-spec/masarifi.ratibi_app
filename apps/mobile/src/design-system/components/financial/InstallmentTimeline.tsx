import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusBadge, type StatusBadgeStatus } from '@/design-system/components/StatusBadge';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText } from './FinancialPrimitives';

export function InstallmentTimeline({
  title,
  items
}: {
  title: string;
  items: {
    label: string;
    amount: number;
    currency: string;
    status: StatusBadgeStatus;
  }[];
}) {
  const theme = useTheme();

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {items.map((item) => (
          <View key={item.label} style={styles.row}>
            <Text style={{ color: theme.colors.textPrimary }}>{item.label}</Text>
            <AmountText value={item.amount} currency={item.currency} meaning="debt" />
            <StatusBadge status={item.status} label={item.status} />
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  title: {
    fontWeight: '700'
  },
  row: {
    gap: 4
  }
});
