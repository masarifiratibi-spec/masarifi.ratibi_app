import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouchTarget } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';

export function StepIndicator({
  current,
  total,
  label
}: {
  current: number;
  total: number;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Text
      accessibilityLabel={`${label}, ${current}/${total}`}
      style={{ color: theme.colors.textSecondary }}
    >
      {current}/{total}
    </Text>
  );
}

export function SegmentedControl({
  options,
  selected,
  onSelect
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.key === selected }}
          onPress={() => onSelect(option.key)}
          style={[
            styles.segment,
            {
              backgroundColor:
                option.key === selected
                  ? theme.colors.primary
                  : theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <Text
            style={{
              color:
                option.key === selected
                  ? theme.colors.textInverse
                  : theme.colors.textPrimary
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function StickySectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text style={[styles.header, { color: theme.colors.textPrimary }]}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  header: {
    fontWeight: '700'
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minTouchTarget,
    paddingHorizontal: 12
  }
});
