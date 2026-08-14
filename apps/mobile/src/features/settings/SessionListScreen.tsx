import React from 'react';
import { View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { RepresentativeSession } from '@/domain/settings';
import { useRevokeAllSessions, useRevokeSession, useSettingsSessions } from './settings-queries';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

export function SessionListScreen() {
  const sessions = useSettingsSessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();
  const [confirmAll, setConfirmAll] = React.useState(false);

  if (sessions.isLoading) return <StyledText>settings.sessions.loading</StyledText>;
  if (sessions.isError || !sessions.data) return <StyledText>settings.sessions.error</StyledText>;

  return (
    <View>
      {revoke.isPending || revokeAll.isPending ? <StyledText>settings.sessions.pending</StyledText> : null}
      {revoke.isError || revokeAll.isError ? <StyledText accessibilityRole="alert">settings.sessions.failure</StyledText> : null}
      {revokeAll.isSuccess || (revoke.data?.value as RepresentativeSession | undefined)?.isCurrentDevice ? <StyledText>settings.sessions.currentCleared</StyledText> : null}
      {sessions.data.map((session: RepresentativeSession) => (
        <View key={session.id}>
          <StyledText>{session.deviceLabel}</StyledText>
          <StyledText>{session.isCurrentDevice ? 'settings.sessions.current' : `settings.sessions.${session.status}`}</StyledText>
          {!session.isCurrentDevice && session.status === 'active' ? (
            <ActionButton label={translateDynamic('settings.sessions.revoke', { device: session.deviceLabel })} onPress={() => revoke.mutate({ sessionId: session.id, operationId: `settings-revoke-session-${Date.now()}` })} />
          ) : null}
        </View>
      ))}
      <ActionButton label="settings.sessions.revokeAll" variant="destructive" loading={revokeAll.isPending} onPress={() => setConfirmAll(true)} />
      <ConfirmationDialog visible={confirmAll} title="settings.sessions.revokeAll" message="settings.sessions.revokeAll.message" confirmLabel="settings.sessions.revokeAll" destructive onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); revokeAll.mutate({ operationId: `settings-revoke-all-${Date.now()}` }); }} />
    </View>
  );
}
