import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { AccessibilityGallery } from './gallery/AccessibilityGallery';
import { ChartGallery } from './gallery/ChartGallery';
import { FinancialGallery } from './gallery/FinancialGallery';
import { FoundationGallery } from './gallery/FoundationGallery';
import { InteractionGallery } from './gallery/InteractionGallery';
import { NavigationGallery } from './gallery/NavigationGallery';
import { PrivacyGallery } from './gallery/PrivacyGallery';
import { StateGallery } from './gallery/StateGallery';

type SectionKey =
  | 'foundation'
  | 'navigation'
  | 'financial'
  | 'interaction'
  | 'states'
  | 'charts'
  | 'accessibility'
  | 'privacy';

const SECTIONS: readonly { key: SectionKey; titleKey: MessageKey; render: () => React.ReactElement }[] = [
  { key: 'foundation', titleKey: 'designSystem.gallery.foundation', render: () => <FoundationGallery /> },
  { key: 'navigation', titleKey: 'designSystem.gallery.navigation', render: () => <NavigationGallery /> },
  { key: 'financial', titleKey: 'designSystem.gallery.financial', render: () => <FinancialGallery /> },
  { key: 'interaction', titleKey: 'designSystem.gallery.interaction', render: () => <InteractionGallery /> },
  { key: 'states', titleKey: 'designSystem.gallery.states', render: () => <StateGallery /> },
  { key: 'charts', titleKey: 'designSystem.gallery.charts', render: () => <ChartGallery /> },
  { key: 'accessibility', titleKey: 'designSystem.gallery.accessibility', render: () => <AccessibilityGallery /> },
  { key: 'privacy', titleKey: 'designSystem.gallery.privacy', render: () => <PrivacyGallery /> }
];

export function DesignSystemGallery() {
  const theme = useTheme();
  const [active, setActive] = useState<SectionKey>('foundation');
  const setLocale = usePreferenceStore((state) => state.setLocale);
  const setTheme = usePreferenceStore((state) => state.setTheme);
  const current = SECTIONS.find((section) => section.key === active) ?? SECTIONS[0];

  return (
    <ScrollView
      testID="design-system-scroll"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
        ]}
      >
        <StyledText variant="title">{translate('designSystem.gallery.title')}</StyledText>
        <View style={styles.controls}>
          <ActionButton
            testID="design-system-theme-light"
            label={translate('common.light')}
            variant="secondary"
            onPress={() => setTheme('light')}
          />
          <ActionButton
            testID="design-system-theme-dark"
            label={translate('common.dark')}
            variant="secondary"
            onPress={() => setTheme('dark')}
          />
          <ActionButton
            testID="design-system-locale-ar"
            label={translate('common.arabic')}
            variant="secondary"
            onPress={() => setLocale('ar')}
          />
          <ActionButton
            testID="design-system-locale-en"
            label={translate('common.english')}
            variant="secondary"
            onPress={() => setLocale('en')}
          />
        </View>
      </View>

      <View style={styles.sections}>
        {SECTIONS.map((section) => (
          <ActionButton
            key={section.key}
            testID={`design-system-section-${section.key}`}
            label={translate(section.titleKey)}
            variant={section.key === active ? 'primary' : 'secondary'}
            onPress={() => setActive(section.key)}
          />
        ))}
      </View>

      <View style={styles.section}>{current.render()}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 980,
    padding: 16,
    width: '100%'
  },
  header: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  section: {
    minHeight: 320
  }
});
