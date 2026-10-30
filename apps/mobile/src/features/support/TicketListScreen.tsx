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
import { useAppShellStore } from '@/state/app-shell';
import {
  hasReadableSnapshot,
  isAuthoritativeReadDenial
} from '@/services/read-snapshot';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { formatDateTime } from '@/utils/format-financial-value';

export function TicketListScreen() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const [paging, setPaging] = React.useState<{
    ownerId: string | null;
    cursor?: string;
  }>({ ownerId });
  const [pages, setPages] = React.useState<{
    ownerId: string | null;
    items: SupportTicket[];
    updatedAt: number;
  }>({ ownerId, items: [], updatedAt: 0 });
  const cursor = paging.ownerId === ownerId ? paging.cursor : undefined;
  const tickets = useSupportTickets(cursor);
  const incoming = tickets.data?.items;
  const updatedAt = tickets.dataUpdatedAt ?? 0;
  const items =
    !cursor && incoming
      ? incoming
      : pages.ownerId === ownerId
        ? pages.items
        : [];
  React.useEffect(() => {
    if (!incoming) return;
    setPages((current) => ({
      ownerId,
      items:
        cursor && current.ownerId === ownerId
          ? mergeTickets(current.items, incoming)
          : incoming,
      updatedAt
    }));
  }, [cursor, incoming, ownerId, updatedAt]);

  if (tickets.isLoading && !items.length)
    return (
      <StateView
        state="loading"
        title={translateDynamic('support.ticket.loading')}
      />
    );
  if (
    tickets.isError &&
    (isAuthoritativeReadDenial(tickets.error) ||
      (!items.length && !hasReadableSnapshot(tickets)))
  )
    return (
      <StateView
        state="error"
        title={translateDynamic('support.ticket.error')}
      />
    );
  if (!items.length)
    return (
      <StateView
        state="empty"
        title={translateDynamic('support.ticket.empty')}
      />
    );

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
        ListHeaderComponent={
          <>
            <StyledText variant="title">
              {translateDynamic('support.ticket.listTitle')}
            </StyledText>
            <FinancialRefreshStatus
              query={{
                ...tickets,
                dataUpdatedAt: Math.max(
                  updatedAt,
                  pages.ownerId === ownerId ? pages.updatedAt : 0
                )
              }}
            />
          </>
        }
        onEndReached={() => {
          const next = tickets.data?.nextCursor;
          if (!tickets.isFetching && next)
            setPaging((current) =>
              current.ownerId === ownerId && current.cursor === next
                ? current
                : { ownerId, cursor: next }
            );
        }}
        renderItem={({ item: ticket }: { item: SupportTicket }) => (
          <SurfaceCard key={ticket.id} style={styles.ticket}>
            <StyledText variant="subtitle">{ticket.reference}</StyledText>
            <StyledText>{ticket.subject}</StyledText>
            <StyledText>
              {translateDynamic(`support.ticket.status.${ticket.status}`)}
            </StyledText>
            <StyledText>{formatDateTime(ticket.updatedAt, locale)}</StyledText>
            <ActionButton
              label="support.ticket.open"
              variant="secondary"
              onPress={() => router.push(`/support/tickets/${ticket.id}`)}
            />
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
  return [...byId.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id)
  );
}
