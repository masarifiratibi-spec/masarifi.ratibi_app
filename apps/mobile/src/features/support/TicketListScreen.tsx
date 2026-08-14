import React from 'react';
import { FlatList, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import type { SupportTicket } from '@/domain/support';
import { useSupportTickets } from './support-queries';
import { ActionButton } from '@/design-system/components/ActionButton';
import { router } from 'expo-router';

export function TicketListScreen() {
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [items, setItems] = React.useState<SupportTicket[]>([]);
  const tickets = useSupportTickets(cursor);
  React.useEffect(() => {
    if (!tickets.data?.items) return;
    setItems((current) => cursor ? mergeTickets(current, tickets.data.items) : tickets.data.items);
  }, [cursor, tickets.data?.items]);

  if (tickets.isLoading) return <StyledText>support.ticket.loading</StyledText>;
  if (tickets.isError) return <StyledText>support.ticket.error</StyledText>;
  if (!items.length) return <StyledText>support.ticket.empty</StyledText>;

  return (
    <FlatList
      data={items}
      keyExtractor={(ticket: SupportTicket) => ticket.id}
      onEndReached={() => tickets.data?.nextCursor && setCursor(tickets.data.nextCursor)}
      renderItem={({ item: ticket }: { item: SupportTicket }) => (
        <View key={ticket.id}>
          <StyledText>{ticket.reference}</StyledText>
          <StyledText>{ticket.subject}</StyledText>
          <StyledText>{`support.ticket.status.${ticket.status}`}</StyledText>
          <StyledText>{String(ticket.updatedAt)}</StyledText>
          <ActionButton label="support.ticket.open" variant="secondary" onPress={() => router.push(`/support/tickets/${ticket.id}`)} />
        </View>
      )}
    />
  );
}

function mergeTickets(current: SupportTicket[], next: SupportTicket[]) {
  const byId = new Map(current.map((ticket) => [ticket.id, ticket]));
  next.forEach((ticket) => byId.set(ticket.id, ticket));
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
}
