import React from 'react';
import { View } from 'react-native';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { LegalDocumentLinks } from './LegalDocumentLinks';

export function RegistrationLegalPreview() {
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm, direction }}>
      <LegalDocumentLinks />
    </View>
  );
}
