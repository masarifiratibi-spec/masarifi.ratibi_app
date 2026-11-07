import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { CheckboxRow } from '@/design-system/components/forms/SelectionControls';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { LegalDocumentLinks } from './LegalDocumentLinks';
import { legalReviewCopy } from './legal-documents';

export function RegistrationLegalPreview() {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  const copy = legalReviewCopy[locale];
  return (
    <View style={{ gap: theme.spacing.sm, direction }}>
      <StyledText variant="caption">{copy.preview}</StyledText>
      <LegalDocumentLinks />
      <CheckboxRow
        label={copy.checkbox}
        checked={false}
        disabled
        onPress={() => {}}
      />
    </View>
  );
}
