import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { AmountText } from './FinancialPrimitives';

export function BalanceCard({
  title,
  value,
  minorUnits,
  currency,
  hidden = false,
  trend,
  actionLabel,
  onAction
}: {
  title: string;
  value?: number;
  minorUnits?: number;
  currency: string;
  hidden?: boolean;
  trend?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
          {title}
        </Text>
        <AmountText
          value={value}
          minorUnits={minorUnits}
          currency={currency}
          meaning="income"
          masked={hidden}
        />
        {trend ? (
          <Text style={{ color: theme.colors.textSecondary }}>{trend}</Text>
        ) : null}
        {actionLabel ? (
          <ActionButton label={actionLabel} variant="secondary" onPress={onAction} />
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  title: {
    fontSize: 13,
    fontWeight: '600'
  }
});
