import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './ActionButton';
import { useTheme } from '@/state/theme-context';

export function SensitiveValue({
  value,
  revealed,
  onReveal,
  onHide
}: {
  value: string;
  revealed: boolean;
  onReveal: () => void;
  onHide: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.stack}>
      <Text
        accessibilityLabel={revealed ? value : 'Value hidden'}
        style={[styles.value, { color: theme.colors.textPrimary }]}
      >
        {revealed ? value : '****'}
      </Text>
      <ActionButton
        label={revealed ? 'Hide value' : 'Reveal value'}
        variant="secondary"
        onPress={revealed ? onHide : onReveal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  value: {
    fontVariant: ['tabular-nums'],
    minWidth: 88
  }
});
