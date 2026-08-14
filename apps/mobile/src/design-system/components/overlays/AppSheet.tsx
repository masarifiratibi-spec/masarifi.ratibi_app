import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme-context';

export function AppSheet({
  title,
  visible,
  onDismiss,
  children
}: {
  title: string;
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <KeyboardAvoidingView accessibilityLabel={title} behavior="padding" style={styles.wrap}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          <Pressable accessibilityLabel={`Close ${title}`} onPress={onDismiss}>
            <Text style={{ color: theme.colors.primary }}>×</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  sheet: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: {
    fontWeight: '700'
  }
});
