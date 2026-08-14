import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme-context';

export function NotificationBadge({
  count,
  label,
  decorative = false
}: {
  count: number;
  label: string;
  decorative?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : `${label} ${count}`}
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[styles.badge, { borderColor: theme.colors.primary }]}
    >
      <Text style={{ color: theme.colors.primary }}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 24,
    minWidth: 24
  }
});
