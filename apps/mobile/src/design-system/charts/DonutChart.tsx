import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';
import { limitDonutSegments, type DonutSegment } from './chart-data';

export function DonutChart({ data, hidden = false }: { data: DonutSegment[]; hidden?: boolean }) {
  const theme = useTheme();
  const segments = limitDonutSegments(data);
  const hiddenLabel = translate('designSystem.privacy.hidden');

  return (
    <View accessibilityLabel={segments.map((item) => `${item.label} ${hidden ? hiddenLabel : item.value}`).join(', ')} style={styles.stack}>
      <Svg width={80} height={80}>
        {segments.map((segment, index) => {
          const total = Math.max(1, segments.reduce((sum, item) => sum + item.value, 0));
          const dash = (segment.value / total) * 176;
          return (
            <Circle
              key={segment.label}
              cx={40}
              cy={40}
              r={28}
              stroke={theme.colors.primary}
              strokeDasharray={`${dash} ${176 - dash}`}
              strokeDashoffset={-index * 32}
              strokeWidth={12}
              fill="none"
            />
          );
        })}
      </Svg>
      {segments.map((segment, index) => (
        <View key={segment.label} style={styles.row}>
          <Text style={{ color: theme.colors.textPrimary }}>
            {segment.label} {hidden ? hiddenLabel : segment.value}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>{index + 1}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 4
  },
  row: {
    flexDirection: 'row',
    gap: 6
  }
});
