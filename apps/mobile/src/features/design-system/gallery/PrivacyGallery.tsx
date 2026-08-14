import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SensitiveValue } from '@/design-system/components/SensitiveValue';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { useTheme } from '@/state/theme-context';

export function PrivacyGallery() {
  const theme = useTheme();
  const { revealed, reveal, reset } = useSensitiveVisibility();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <SensitiveValue
        value="4,200 EGP"
        revealed={revealed}
        onReveal={reveal}
        onHide={reset}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 16
  }
});
