import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ActionButton } from '@/design-system/components/ActionButton';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { getLegalDocument } from './legal-documents';

export function LegalDocumentLinks() {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm, direction }}>
      {(['terms', 'privacy'] as const).map((kind) => (
        <ActionButton
          key={kind}
          label={getLegalDocument(locale, kind).title}
          variant="quiet"
          onPress={() => router.push(`/legal?document=${kind}`)}
        />
      ))}
    </View>
  );
}
