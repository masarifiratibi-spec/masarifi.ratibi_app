import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { StyledText } from '@/components/StyledText';
import type { SupportTicket } from '@/domain/support';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSupportTickets } from './support-queries';

export function TicketListScreen() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [items, setItems] = React.useState<SupportTicket[]>([]);
  const tickets = useSupportTickets(cursor);
  React.useEffect(() => {
    if (!tickets.data?.items) return;
    setItems((current) => cursor ? mergeTickets(current, tickets.data.items) : tickets.data.items);
  }, [cursor, tickets.data?.items]);

  if (tickets.isLoading) return <StateView state="loading" title={translateDynamic('support.ticket.loading')} />;
  if (tickets.isError) return <StateView state="error" title={translateDynamic('support.ticket.error')} />;
  if (!items.length) return <StateView state="empty" title={translateDynamic('support.ticket.empty')} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}>
      <AppBar
        title={translateDynamic('support.home.ticketHistory')}
        onBack={() => router.back()}
        direction={direction}
      />
      <FlatList
        data={items}
        contentContainerStyle={styles.stack}
        keyExtractor={(ticket: SupportTicket) => ticket.id}
        ListHeaderComponent={<StyledText variant="title">{translateDynamic('support.ticket.listTitle')}</StyledText>}
        onEndReached={() => tickets.data?.nextCursor && setCursor(tickets.data.nextCursor)}
        renderItem={({ item: ticket }: { item: SupportTicket }) => (
          <SurfaceCard key={ticket.id} style={styles.ticket}>
            <StyledText variant="subtitle">{ticket.reference}</StyledText>
            <StyledText>{ticket.subject}</StyledText>
            <StyledText>{translateDynamic(`support.ticket.status.${ticket.status}`)}</StyledText>
            <StyledText>{String(ticket.updatedAt)}</StyledText>
            <ActionButton label="support.ticket.open" variant="secondary" onPress={() => router.push(`/support/tickets/${ticket.id}`)} />
          </SurfaceCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  },
  ticket: {
    gap: 8
  }
});

function mergeTickets(current: SupportTicket[], next: SupportTicket[]) {
  const byId = new Map(current.map((ticket) => [ticket.id, ticket]));
  next.forEach((ticket) => byId.set(ticket.id, ticket));
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
}
