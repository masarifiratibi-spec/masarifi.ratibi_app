import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { translate, type MessageKey } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export type ComparisonDirection = 'higher' | 'lower' | 'neutral';

export function ComparisonIndicator({
  direction,
  label
}: {
  direction: ComparisonDirection;
  label: string;
}) {
  const theme = useTheme();
  const cue = direction === 'higher' ? '+' : direction === 'lower' ? '-' : '=';

  return (
    <View style={styles.row} accessibilityLabel={`${label} ${translate(`designSystem.comparison.${direction}` as MessageKey)}`}>
      <Text style={[styles.cue, { color: theme.colors.primary }]}>{cue}</Text>
      <Text style={{ color: theme.colors.textSecondary }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  cue: {
    fontWeight: '700'
  }
});
