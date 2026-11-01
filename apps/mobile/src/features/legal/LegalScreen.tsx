import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { LegalDocumentLinks } from './LegalDocumentLinks';
import {
  getLegalDocument,
  legalDocumentVersion,
  legalReviewCopy,
  type LegalDocumentKind
} from './legal-documents';

export function LegalScreen({ document }: { document: LegalDocumentKind }) {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  const content = getLegalDocument(locale, document);
  return (
    <ScrollView
      key={`${locale}:${document}`}
      style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}
      contentContainerStyle={{
        gap: theme.spacing.md,
        padding: theme.spacing.md
      }}
    >
      <LegalDocumentLinks />
      <View
        testID="legal-document-body"
        style={{ gap: theme.spacing.md, direction }}
      >
        <StyledText variant="title" accessibilityRole="header">
          {content.title}
        </StyledText>
        <StyledText variant="caption">{`${legalReviewCopy[locale].version}: ${legalDocumentVersion}`}</StyledText>
        <StyledText>{content.notice}</StyledText>
        {content.sections.map((section) => (
          <View key={section.id} style={{ gap: theme.spacing.sm }}>
            <StyledText variant="subtitle" accessibilityRole="header">
              {section.title}
            </StyledText>
            {section.paragraphs.map((paragraph, index) => (
              <StyledText key={index}>{paragraph}</StyledText>
            ))}
          </View>
        ))}
      </View>
      <ActionButton
        label={legalReviewCopy[locale].back}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/')
        }
        variant="secondary"
      />
    </ScrollView>
  );
}
