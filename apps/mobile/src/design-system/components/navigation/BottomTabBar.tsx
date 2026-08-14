import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouchTarget } from '@/design-system/tokens';
import type { LayoutDirection } from '@/domain/foundation';
import { useTheme } from '@/state/theme-context';

export function BottomTabBar({
  tabs,
  selected,
  centerAction,
  direction = 'ltr'
}: {
  tabs: { key: string; label: string; onPress?: () => void }[];
  selected: string;
  centerAction?: { label: string; onPress: () => void };
  direction?: LayoutDirection;
}) {
  const theme = useTheme();
  const visibleTabs = tabs.slice(0, 5);
  const ordered =
    direction === 'rtl' ? [...visibleTabs].reverse() : visibleTabs;

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: theme.colors.surface }]}
    >
      {ordered.map((tab) => (
        <Pressable
          key={tab.key}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.key === selected }}
          onPress={tab.onPress}
          style={styles.item}
        >
          <Text style={{ color: theme.colors.textPrimary }}>{tab.label}</Text>
        </Pressable>
      ))}
      {centerAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={centerAction.label}
          onPress={centerAction.onPress}
          style={styles.item}
        >
          <Text style={{ color: theme.colors.textPrimary }}>
            {centerAction.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Math.max(48, minTouchTarget),
    minWidth: minTouchTarget
  }
});
