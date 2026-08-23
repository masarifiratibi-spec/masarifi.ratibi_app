import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function RouteModalContainer({
  title,
  closeLabel,
  onDismiss,
  fullScreen = false,
  children
}: {
  title: string;
  closeLabel: string;
  onDismiss: () => void;
  fullScreen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);

  return (
    <SafeAreaView
      accessibilityLabel={title}
      style={[styles.safeArea, { backgroundColor: theme.colors.surfaces.page }]}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View
          testID="route-modal-container"
          style={[
            styles.container,
            fullScreen && styles.fullScreen,
            {
              backgroundColor: theme.colors.surfaces.overlay,
              borderColor: theme.colors.borders.subtle
            }
          ]}
        >
          <View
            testID="route-modal-header"
            style={[
              styles.header,
              { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
            ]}
          >
            <Pressable
              accessibilityLabel={closeLabel}
              accessibilityRole="button"
              onPress={onDismiss}
              style={styles.close}
            >
              <Text style={[styles.closeText, { color: theme.colors.content.link }]}>×</Text>
            </Pressable>
            <Text
              style={[styles.title, { color: theme.colors.content.primary }]}
            >
              {title}
            </Text>
            <View style={styles.close} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  container: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    margin: spacing.lg,
    padding: spacing.lg
  },
  fullScreen: {
    borderRadius: 0,
    borderWidth: 0,
    margin: 0
  },
  header: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center'
  },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  closeText: {
    fontSize: 24,
    lineHeight: 28
  }
});
