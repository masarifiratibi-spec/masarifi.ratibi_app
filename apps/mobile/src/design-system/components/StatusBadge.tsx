import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme-context';
import { translateDynamic } from '@/localization/i18n';

export type StatusBadgeStatus =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'offline'
  | 'sync';

export function StatusBadge({
  status,
  label
}: {
  status: StatusBadgeStatus;
  label: string;
}) {
  const theme = useTheme();
  const color = theme.colors.status[status];
  const text = translateDynamic(label);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[styles.badge, { borderColor: color }]}
    >
      <Text style={[styles.cue, { color }]}>{cueForStatus(status)}</Text>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

function cueForStatus(status: StatusBadgeStatus): string {
  if (status === 'warning' || status === 'danger') return '!';
  if (status === 'success') return '+';
  if (status === 'pending' || status === 'sync') return '~';
  return 'i';
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  cue: {
    fontWeight: '700'
  },
  label: {
    fontSize: 12,
    fontWeight: '600'
  }
});
