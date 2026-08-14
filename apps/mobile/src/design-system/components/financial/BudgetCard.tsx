import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText } from './FinancialPrimitives';
import { FinancialProgress } from './FinancialProgress';

export function BudgetCard({
  title,
  spent,
  limit,
  currency
}: {
  title: string;
  spent: number;
  limit: number;
  currency: string;
}) {
  const theme = useTheme();
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : spent > 0 ? 100 : 0;

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        <AmountText value={spent} currency={currency} meaning="expense" />
        <FinancialProgress label="Budget used" percent={percent} />
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
  }
});
