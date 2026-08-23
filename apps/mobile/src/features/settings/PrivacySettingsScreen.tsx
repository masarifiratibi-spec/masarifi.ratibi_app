import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useDeleteLocalData, usePrivacyRequest } from './settings-queries';
import { StyledText } from '@/components/StyledText';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { usePreferenceStore } from '@/state/preferences';

export function PrivacySettingsScreen() {
  const request = usePrivacyRequest();
  const localDelete = useDeleteLocalData();
  const tracking = usePreferenceStore((state) => state.trackingPersonalization);
  const assistantPersonalization = usePreferenceStore((state) => state.assistantPersonalization);
  const analytics = usePreferenceStore((state) => state.analyticsEnabled);
  const update = usePreferenceStore((state) => state.updateApplicationPreferences);
  const [review, setReview] = React.useState<'data_export' | 'account_deletion' | 'local_delete' | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">settings.privacy.title</StyledText>
      <StyledText>settings.privacy.legalExplanation</StyledText>
      <SurfaceCard style={styles.section}>
        <SwitchRow label="settings.privacy.tracking" value={tracking} onValueChange={(value) => update({ trackingPersonalization: value })} />
        <StyledText>{tracking ? 'settings.privacy.tracking.enabled' : 'settings.privacy.tracking.disabled'}</StyledText>
        {!tracking ? <StyledText>settings.privacy.tracking.consequence</StyledText> : null}
        <SwitchRow label="settings.privacy.assistantPersonalization" value={assistantPersonalization} onValueChange={(value) => update({ assistantPersonalization: value })} />
        <StyledText>{assistantPersonalization ? 'settings.privacy.assistantPersonalization.enabled' : 'settings.privacy.assistantPersonalization.disabled'}</StyledText>
        {!assistantPersonalization ? <StyledText>settings.privacy.assistantPersonalization.consequence</StyledText> : null}
        <SwitchRow label="settings.privacy.analytics" value={analytics} onValueChange={(value) => update({ analyticsEnabled: value })} />
      </SurfaceCard>
      <SurfaceCard style={styles.section}>
        <ActionButton label="settings.privacy.exportReview" variant="secondary" onPress={() => setReview('data_export')} />
        <ActionButton label="settings.privacy.accountDeletionReview" variant="secondary" onPress={() => setReview('account_deletion')} />
        <ActionButton label="settings.privacy.localDelete" variant="destructive" onPress={() => setReview('local_delete')} />
      </SurfaceCard>
      {review === 'data_export' || review === 'account_deletion' ? (
        <ActionButton
          label="settings.privacy.confirmRequest"
          loading={request.isPending}
          onPress={() => request.mutate({ kind: review, operationId: `settings-${review}-${Date.now()}` })}
        />
      ) : null}
      {review === 'local_delete' ? (
        <ActionButton
          label="settings.privacy.confirmLocalDelete"
          loading={localDelete.isPending}
          variant="destructive"
          onPress={() => localDelete.mutate({ operationId: `settings-local-delete-${Date.now()}` })}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  },
  section: {
    gap: 12
  }
});
