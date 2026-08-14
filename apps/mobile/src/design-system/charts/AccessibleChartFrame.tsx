import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function AccessibleChartFrame({
  question,
  summary,
  empty,
  drillDownLabel,
  onDrillDown,
  children
}: {
  question: string;
  summary: string;
  empty?: boolean;
  drillDownLabel?: string;
  onDrillDown?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${question} ${summary}`}
      accessibilityRole="image"
      accessible
      style={styles.stack}
    >
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        {question}
      </Text>
      <Text style={{ color: theme.colors.textSecondary }}>{summary}</Text>
      {empty ? (
        <Text style={{ color: theme.colors.textSecondary }}>
          {translate('designSystem.chart.empty')}
        </Text>
      ) : (
        children
      )}
      {drillDownLabel ? (
        <ActionButton
          label={drillDownLabel}
          variant="secondary"
          onPress={onDrillDown}
        />
      ) : null}
    </View>
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
