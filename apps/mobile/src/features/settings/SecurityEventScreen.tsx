import React from 'react';
import { FlatList, StyleSheet } from 'react-native';

import type { SecurityEvent } from '@/domain/settings';
import { useSecurityEvents } from './settings-queries';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { StateView } from '@/design-system/components/feedback/StateView';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import { translateDynamic } from '@/localization/i18n';

export function SecurityEventScreen() {
  const events = useSecurityEvents();

  if (events.isLoading) return <StateView state="loading" title={translateDynamic('settings.securityEvents.loading')} />;
  if (events.isError || !events.data) return <StateView state="error" title={translateDynamic('settings.securityEvents.error')} />;

  const legacyEvents = events.data as unknown as { items?: SecurityEvent[] };
  const items = events.data.pages?.flatMap((page) => page.items) ?? legacyEvents.items ?? [];

  return (
    <FlatList
      data={items}
      contentContainerStyle={styles.stack}
      keyExtractor={(event) => event.id}
      ListHeaderComponent={<StyledText variant="title">settings.securityEvents.title</StyledText>}
      onEndReached={() => events.hasNextPage && !events.isFetchingNextPage && events.fetchNextPage?.()}
      renderItem={({ item: event }: { item: SecurityEvent }) => (
        <GroupedList label={translateDynamic(`settings.securityEvents.${event.type}`)}>
          <NavigationRow label={translateDynamic(`settings.securityEvents.${event.type}`)} value={translateDynamic(recoveryLabel(event.recoveryDestination))} onPress={() => router.push(event.recoveryDestination.kind === 'security' ? '/security/settings' : '/profile/privacy')} />
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
  return destination.kind === 'security' ? 'settings.securityEvents.recover.security' : 'settings.securityEvents.recover.settings';
}
