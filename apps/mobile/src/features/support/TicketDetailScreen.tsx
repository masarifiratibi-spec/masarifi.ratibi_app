import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { FormField } from '@/design-system/components/forms/FormField';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { StyledText } from '@/components/StyledText';
import { canRateTicket, type SupportTicket } from '@/domain/support';
import { useRateTicket, useReplyToTicket, useSupportTicket } from './support-queries';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { isFixtureModeEnabled } from '@/config/demo-mode';

export function TicketDetailScreen({ ticketId }: { ticketId: string }) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const ticket = useSupportTicket(ticketId);
  const reply = useReplyToTicket();
  const rate = useRateTicket();
  const [body, setBody] = useState('');

  if (ticket.isLoading) return <StateView state="loading" title={translateDynamic('support.ticket.loading')} />;
  if (!ticket.data) return <StateView state="error" title={translateDynamic('support.ticket.error')} />;
  const canReply = ['open','waiting_user','waiting_support'].includes(ticket.data.status);

  return (
    <ScrollView contentContainerStyle={[styles.stack, { backgroundColor: theme.colors.surfaces.page }]}>
      <AppBar
        title={translateDynamic('support.ticket.detailTitle', { reference: ticket.data.reference })}
        onBack={() => router.back()}
        direction={direction}
      />
      <SurfaceCard style={styles.card}>
        <StyledText variant="subtitle">{ticket.data.reference}</StyledText>
        <StyledText>{ticket.data.subject}</StyledText>
        <StyledText>{translateDynamic(`support.ticket.status.${ticket.data.status}`)}</StyledText>
      </SurfaceCard>
      {ticket.data.messages.map((message: SupportTicket['messages'][number]) => <SurfaceCard key={message.id}><StyledText>{message.body}</StyledText></SurfaceCard>)}
      {canReply ? <>
        <FormField label="support.ticket.reply" value={body} onChangeText={setBody} />
        <ActionButton label="support.ticket.sendReply" loading={reply.isPending} disabled={!body.trim()} onPress={() => reply.mutate({ ticketId, input: { description: body }, expectedVersion: ticket.data.version, operationId: `support-reply-${Date.now()}` })} />
      </> : <StyledText>{translateDynamic('support.ticket.replyUnavailable')}</StyledText>}
      {reply.isError || ticket.isError ? <>
        <StyledText>{translateDynamic('support.ticket.replyFailed')}</StyledText>
        <ActionButton label="support.ticket.refresh" variant="secondary" onPress={() => { void ticket.refetch(); }} />
      </> : null}
      {isFixtureModeEnabled() && canRateTicket(ticket.data.status) ? <ActionButton label="support.ticket.rate.5" loading={rate.isPending} onPress={() => rate.mutate({ ticketId, rating: 5, expectedVersion: ticket.data.version, operationId: `support-rate-${Date.now()}` })} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16,
    minHeight: '100%'
  },
  card: {
    gap: 8
  }
});
