import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText, type FinancialMeaning } from './FinancialPrimitives';

export function ReportMetricCard({
  title,
  value,
  currency,
  meaning = 'expense',
  unavailable,
  masked = false,
  comparison
}: {
  title: string;
  value: number;
  currency: string;
  meaning?: FinancialMeaning;
  unavailable?: string;
  masked?: boolean;
  comparison?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {unavailable ? (
          <Text style={{ color: theme.colors.textSecondary }}>{unavailable}</Text>
        ) : (
          <AmountText
            value={value}
            currency={currency}
            meaning={meaning}
            masked={masked}
          />
        )}
        {comparison}
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
