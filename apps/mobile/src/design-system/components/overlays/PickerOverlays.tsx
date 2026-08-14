import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouchTarget } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';

export function PickerOverlay({
  title,
  options,
  onSelect
}: {
  title: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stack}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityLabel={option}
          onPress={() => onSelect(option)}
          style={[styles.option, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.textPrimary }}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function VoiceRecordingOverlay({
  title,
  recording
}: {
  title: string;
  recording: boolean;
}) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={title} style={styles.stack}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary }}>
        {recording ? 'Recording' : 'Ready'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  title: {
    fontWeight: '700'
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minTouchTarget,
    paddingHorizontal: 12
  }
});
