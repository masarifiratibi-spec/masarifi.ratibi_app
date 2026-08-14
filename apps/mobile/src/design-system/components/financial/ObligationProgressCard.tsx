import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText } from './FinancialPrimitives';
import { FinancialProgress } from './FinancialProgress';

export function ObligationProgressCard({
  title,
  paid,
  total,
  currency
}: {
  title: string;
  paid: number;
  total: number;
  currency: string;
}) {
  const theme = useTheme();
  const percent = total > 0 ? Math.round((paid / total) * 100) : paid > 0 ? 100 : 0;

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        <AmountText value={paid} currency={currency} meaning="debt" />
        <FinancialProgress label="Obligation paid" percent={percent} />
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
