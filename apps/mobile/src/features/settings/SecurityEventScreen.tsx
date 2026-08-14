import React from 'react';
import { FlatList, View } from 'react-native';

import type { SecurityEvent } from '@/domain/settings';
import { useSecurityEvents } from './settings-queries';
import { ActionButton } from '@/design-system/components/ActionButton';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';

export function SecurityEventScreen() {
  const events = useSecurityEvents();

  if (events.isLoading) return <StyledText>settings.securityEvents.loading</StyledText>;
  if (events.isError || !events.data) return <StyledText>settings.securityEvents.error</StyledText>;

  const legacyEvents = events.data as unknown as { items?: SecurityEvent[] };
  const items = events.data.pages?.flatMap((page) => page.items) ?? legacyEvents.items ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(event) => event.id}
      onEndReached={() => events.hasNextPage && !events.isFetchingNextPage && events.fetchNextPage?.()}
      renderItem={({ item: event }: { item: SecurityEvent }) => (
        <View key={event.id}>
          <StyledText>{`settings.securityEvents.${event.type}`}</StyledText>
          <ActionButton label={recoveryLabel(event.recoveryDestination)} variant="secondary" onPress={() => router.push(event.recoveryDestination.kind === 'security' ? '/security/settings' : '/profile/privacy')} />
        </View>
      )}
    />
  );
}

function recoveryLabel(destination: SecurityEvent['recoveryDestination']) {
  return destination.kind === 'security' ? 'settings.securityEvents.recover.security' : 'settings.securityEvents.recover.settings';
}
