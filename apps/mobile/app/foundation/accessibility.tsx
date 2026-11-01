/**
 * /foundation/accessibility — User Story 4 validation harness.
 *
 * Hosts the state gallery and controls so a reviewer can repeat each state in
 * Arabic RTL and English LTR, with large text, a screen reader, and reduced
 * motion. Validation route, not a production screen.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/state/theme-context';

export default function AccessibilityHarness() {
  const theme = useTheme();
  const { AccessibilityStateGallery } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/foundation/AccessibilityStateGallery') as typeof import('@/features/foundation/AccessibilityStateGallery');
  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <AccessibilityStateGallery />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
