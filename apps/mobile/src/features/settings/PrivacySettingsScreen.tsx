import React from 'react';
import { ScrollView } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
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
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">settings.privacy.legalExplanation</StyledText>
      <SwitchRow label="settings.privacy.tracking" value={tracking} onValueChange={(value) => update({ trackingPersonalization: value })} />
      <StyledText>{tracking ? 'settings.privacy.tracking.enabled' : 'settings.privacy.tracking.disabled'}</StyledText>
      {!tracking ? <StyledText>settings.privacy.tracking.consequence</StyledText> : null}
      <SwitchRow label="settings.privacy.assistantPersonalization" value={assistantPersonalization} onValueChange={(value) => update({ assistantPersonalization: value })} />
      <StyledText>{assistantPersonalization ? 'settings.privacy.assistantPersonalization.enabled' : 'settings.privacy.assistantPersonalization.disabled'}</StyledText>
      {!assistantPersonalization ? <StyledText>settings.privacy.assistantPersonalization.consequence</StyledText> : null}
      <SwitchRow label="settings.privacy.analytics" value={analytics} onValueChange={(value) => update({ analyticsEnabled: value })} />
      <ActionButton
        label="settings.privacy.exportReview"
        onPress={() => setReview('data_export')}
      />
      <ActionButton
        label="settings.privacy.accountDeletionReview"
        onPress={() => setReview('account_deletion')}
      />
      <ActionButton
        label="settings.privacy.localDelete"
        variant="destructive"
        onPress={() => setReview('local_delete')}
      />
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
