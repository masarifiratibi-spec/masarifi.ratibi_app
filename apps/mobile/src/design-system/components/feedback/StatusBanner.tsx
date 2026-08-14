import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type StatusBadgeStatus } from '@/design-system/components/StatusBadge';
import { useTheme } from '@/state/theme-context';

export function StatusBanner({
  status,
  message
}: {
  status: StatusBadgeStatus;
  message: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { borderColor: theme.colors.status[status] }]}>
      <Text style={{ color: theme.colors.textPrimary }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  }
});
