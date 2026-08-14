import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/state/theme-context';

export function SkeletonBlock({ width, height }: { width: number; height: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="skeleton-block"
      style={[styles.block, { width, height, backgroundColor: theme.colors.surfaceMuted }]}
    />
  );
}

export function SkeletonCard({ width, height }: { width: number; height: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="skeleton-card"
      style={[styles.card, { width, height, backgroundColor: theme.colors.surfaceMuted }]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 8
  },
  card: {
    borderRadius: 8,
    borderWidth: 1
  }
});
