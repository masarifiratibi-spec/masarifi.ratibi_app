import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText } from './FinancialPrimitives';
import { FinancialProgress } from './FinancialProgress';

export function SavingsGoalCard({
  title,
  saved,
  target,
  currency
}: {
  title: string;
  saved: number;
  target: number;
  currency: string;
}) {
  const theme = useTheme();
  const percent = target > 0 ? Math.round((saved / target) * 100) : saved > 0 ? 100 : 0;

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        <AmountText value={saved} currency={currency} meaning="savings" />
        <FinancialProgress label="Goal saved" percent={percent} />
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
