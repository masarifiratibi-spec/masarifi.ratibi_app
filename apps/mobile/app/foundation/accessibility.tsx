/**
 * /foundation/accessibility — User Story 4 validation harness.
 *
 * Hosts the state gallery and controls so a reviewer can repeat each state in
 * Arabic RTL and English LTR, with large text, a screen reader, and reduced
 * motion. Validation route, not a production screen.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityStateGallery } from '@/features/foundation/AccessibilityStateGallery';
import { useTheme } from '@/state/theme-context';

export default function AccessibilityHarness() {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <AccessibilityStateGallery />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
