import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { useTheme } from '@/state/theme-context';
import { limitLineSeries, normalizeLinePoints } from './chart-data';

const stylesByIndex = ['solid', 'dash', 'dot', 'dashDot'] as const;

export function LineChart({
  series
}: {
  series: { label: string; values: number[] }[];
}) {
  const theme = useTheme();
  const visible = limitLineSeries(series);
  return (
    <View accessibilityLabel={visible.map((item) => item.label).join(', ')} style={styles.stack}>
      <Svg width={160} height={80}>
        {visible.map((item, index) => (
          <Polyline
            key={item.label}
            points={normalizeLinePoints(item.values)}
            stroke={theme.colors.primary}
            strokeDasharray={index === 0 ? undefined : index === 1 ? '8 4' : '2 4'}
            strokeWidth={2}
            fill="none"
          />
        ))}
      </Svg>
      {visible.map((item, index) => (
        <Text key={item.label} style={{ color: theme.colors.textPrimary }}>
          {item.label} {stylesByIndex[index]}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 4
  }
});
