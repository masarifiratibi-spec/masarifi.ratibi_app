import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
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

  if (sessions.isLoading) return <StateView state="loading" title={translateDynamic('settings.sessions.loading')} />;
  if (sessions.isError || !sessions.data) return <StateView state="error" title={translateDynamic('settings.sessions.error')} />;

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">settings.sessions.title</StyledText>
      {revoke.isPending || revokeAll.isPending ? <StyledText>settings.sessions.pending</StyledText> : null}
      {revoke.isError || revokeAll.isError ? <StyledText accessibilityRole="alert">settings.sessions.failure</StyledText> : null}
      {revokeAll.isSuccess || (revoke.data?.value as RepresentativeSession | undefined)?.isCurrentDevice ? <StyledText>settings.sessions.currentCleared</StyledText> : null}
      {sessions.data.map((session: RepresentativeSession) => (
        <SurfaceCard key={session.id} style={styles.session}>
          <StyledText variant="subtitle">{session.deviceLabel}</StyledText>
          <StyledText>{session.isCurrentDevice ? 'settings.sessions.current' : `settings.sessions.${session.status}`}</StyledText>
          {!session.isCurrentDevice && session.status === 'active' ? (
            <ActionButton label={translateDynamic('settings.sessions.revoke', { device: session.deviceLabel })} onPress={() => revoke.mutate({ sessionId: session.id, operationId: `settings-revoke-session-${Date.now()}` })} />
          ) : null}
        </SurfaceCard>
      ))}
      <ActionButton label="settings.sessions.revokeAll" variant="destructive" loading={revokeAll.isPending} onPress={() => setConfirmAll(true)} />
      <ConfirmationDialog visible={confirmAll} title="settings.sessions.revokeAll" message="settings.sessions.revokeAll.message" confirmLabel="settings.sessions.revokeAll" destructive onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); revokeAll.mutate({ operationId: `settings-revoke-all-${Date.now()}` }); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  },
  session: {
    gap: 8
  }
});
