import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useTheme } from '@/state/theme-context';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { AmountText } from './FinancialPrimitives';

export function AccountCard({
  name,
  type,
  maskedIdentifier,
  balance,
  currency,
  statusLabel,
  actionLabel,
  onAction
}: {
  name: string;
  type: string;
  maskedIdentifier: string;
  balance: number;
  currency: string;
  statusLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const { revealed } = useSensitiveVisibility();

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
          {name}
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>{type}</Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          {maskedIdentifier}
        </Text>
        <AmountText
          value={balance}
          currency={currency}
          meaning="income"
          masked={!revealed}
        />
        {statusLabel ? <StatusBadge status="sync" label={statusLabel} /> : null}
        {actionLabel ? (
          <ActionButton
            label={actionLabel}
            variant="secondary"
            onPress={onAction}
          />
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  name: {
    fontSize: 17,
    fontWeight: '700'
  }
});
