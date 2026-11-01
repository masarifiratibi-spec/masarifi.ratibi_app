import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useAppShellStore } from '@/state/app-shell';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
import type { RepresentativeSession } from '@/domain/settings';
import { useRevokeSession, useSettingsSessions } from './settings-queries';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { router } from 'expo-router';

export function SessionListScreen() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return <SessionListContent key={ownerId} />;
}

function SessionListContent() {
  const sessions = useSettingsSessions();
  const revoke = useRevokeSession();
  const direction = usePreferenceStore((state) => state.direction);

  if (sessions.isLoading && !hasReadableSnapshot(sessions))
    return (
      <StateView
        state="loading"
        title={translateDynamic('settings.sessions.loading')}
      />
    );
  if (!hasReadableSnapshot(sessions) || !sessions.data)
    return (
      <StateView
        state="error"
        title={translateDynamic('settings.sessions.error')}
      />
    );

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <AppBar
        direction={direction}
        onBack={() => router.back()}
        title={translateDynamic('settings.sessions.title')}
      />
      <FinancialRefreshStatus query={sessions} />
      {revoke.isPending ? (
        <StyledText>settings.sessions.pending</StyledText>
      ) : null}
      {revoke.isError ? (
        <StyledText accessibilityRole="alert">
          settings.sessions.failure
        </StyledText>
      ) : null}
      {(revoke.data?.value as RepresentativeSession | undefined)
        ?.isCurrentDevice ? (
        <StyledText>settings.sessions.currentCleared</StyledText>
      ) : null}
      {sessions.data.map((session: RepresentativeSession) => (
        <SurfaceCard key={session.id} style={styles.session}>
          <StyledText variant="subtitle">{session.deviceLabel}</StyledText>
          <StyledText>
            {session.isCurrentDevice
              ? 'settings.sessions.current'
              : `settings.sessions.${session.status}`}
          </StyledText>
          {!session.isCurrentDevice && session.status === 'active' ? (
            <ActionButton
              label={translateDynamic('settings.sessions.revoke', {
                device: session.deviceLabel
              })}
              disabled={
                revoke.isPending || sessions.isError || sessions.isFetching
              }
              onPress={() => {
                if (revoke.isPending || sessions.isError || sessions.isFetching)
                  return;
                revoke.mutate({
                  sessionId: session.id,
                  operationId: `settings-revoke-session-${Date.now()}`
                });
              }}
            />
          ) : null}
        </SurfaceCard>
      ))}
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
