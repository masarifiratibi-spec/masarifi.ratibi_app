import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouchTarget, radius } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function PickerField({
  label,
  value,
  placeholder,
  disabled = false,
  onPress
}: {
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const display = value ?? placeholder ?? '';

  return (
    <View style={styles.stack}>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${display}`.trim()}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.surfaces.card,
            borderColor: theme.colors.borders.subtle
          }
        ]}
      >
        <Text
          style={{
            color: value
              ? theme.colors.textPrimary
              : theme.colors.textSecondary,
            textAlign: direction === 'rtl' ? 'right' : 'left',
            writingDirection: direction
          }}
        >
          {display}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 6
  },
  label: {
    fontWeight: '600'
  },
  trigger: {
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: minTouchTarget,
    paddingHorizontal: 12
  }
});
