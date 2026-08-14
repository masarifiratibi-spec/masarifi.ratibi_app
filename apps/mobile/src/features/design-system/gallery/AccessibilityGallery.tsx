import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SegmentedControl, StepIndicator, StickySectionHeader } from '@/design-system';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

const MIXED_VALUE_FIXTURE = 'ABC 123 EGP';
const LONG_LABEL_FIXTURE = 'Arabic label wrapping fixture for 200 percent text';

export function AccessibilityGallery() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title">{translate('nav.accessibility')}</StyledText>
      <StyledText variant="body">{MIXED_VALUE_FIXTURE}</StyledText>
      <StyledText variant="body">{LONG_LABEL_FIXTURE}</StyledText>
      <View style={styles.stack}>
        <StepIndicator current={2} total={4} label="Setup" />
        <SegmentedControl
          selected="month"
          options={[
            { key: 'week', label: 'This week' },
            { key: 'month', label: 'This month with long label' }
          ]}
          onSelect={() => undefined}
        />
        <StickySectionHeader title={translate('scenario.populated')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    gap: 16,
    padding: 16
  },
  stack: {
    gap: 12
  }
});
