import React from 'react';
import { FlatList, StyleSheet } from 'react-native';

import type { SecurityEvent } from '@/domain/settings';
import { useSecurityEvents } from './settings-queries';
import { router } from 'expo-router';
import { StateView } from '@/design-system/components/feedback/StateView';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { formatDateTime } from '@/utils/format-financial-value';
import { currentLocale, translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';

export function SecurityEventScreen() {
  const events = useSecurityEvents();
  const direction = usePreferenceStore((state) => state.direction);

  if (events.isLoading)
    return (
      <StateView
        state="loading"
        title={translateDynamic('settings.securityEvents.loading')}
      />
    );
  if (!events.data)
    return (
      <StateView
        state="error"
        title={translateDynamic('settings.securityEvents.error')}
        actionLabel={translateDynamic('coreFinance.action.retry')}
        onAction={() => void events.refetch()}
      />
    );

  const legacyEvents = events.data as unknown as { items?: SecurityEvent[] };
  const items =
    events.data.pages?.flatMap((page) => page.items) ??
    legacyEvents.items ??
    [];

  return (
    <FlatList
      data={items}
      contentContainerStyle={styles.stack}
      keyExtractor={(event) => event.id}
      ListEmptyComponent={
        <StateView
          state="empty"
          title={translateDynamic('settings.securityEvents.empty')}
        />
      }
      ListHeaderComponent={
        <AppBar
          direction={direction}
          onBack={() => router.back()}
          title={translateDynamic('settings.securityEvents.title')}
        />
      }
      ListFooterComponent={
        events.isError ? (
          <ActionButton
            label={translateDynamic('coreFinance.action.retry')}
            onPress={() => void events.refetch()}
          />
        ) : null
      }
      onEndReached={() =>
        events.hasNextPage &&
        !events.isFetchingNextPage &&
        events.fetchNextPage?.()
      }
      renderItem={({ item: event }: { item: SecurityEvent }) => (
        <GroupedList label={eventLabel(event)}>
          <StyledText>
            {formatDateTime(event.occurredAt, currentLocale())}
          </StyledText>
          <NavigationRow
            label={eventLabel(event)}
            value={translateDynamic(recoveryLabel(event.recoveryDestination))}
            onPress={() =>
              router.push(
                event.recoveryDestination.kind === 'security'
                  ? '/security/settings'
                  : '/profile/privacy'
              )
            }
          />
        </GroupedList>
      )}
    />
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  }
});

function recoveryLabel(destination: SecurityEvent['recoveryDestination']) {
  return destination.kind === 'security'
    ? 'settings.securityEvents.recover.security'
    : 'settings.securityEvents.recover.settings';
}

const eventTypes = new Set([
  'admin.role_assigned',
  'admin.role_revoked',
  'support_access.requested',
  'support_access.granted',
  'support_access.revoked',
  'security.incident_opened',
  'privacy.export_ready',
  'privacy.export_expired',
  'privacy.deletion_requested',
  'privacy.deletion_completed'
]);
function eventLabel(event: SecurityEvent) {
  return translateDynamic(
    event.eventType && eventTypes.has(event.eventType)
      ? `settings.securityEvent.${event.eventType}`
      : `settings.securityEvents.${event.type}`
  );
}
