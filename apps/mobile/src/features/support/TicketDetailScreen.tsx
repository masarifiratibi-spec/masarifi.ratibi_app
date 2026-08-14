import React, { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { canRateTicket, type SupportTicket } from '@/domain/support';
import { useRateTicket, useReplyToTicket, useSupportTicket } from './support-queries';
import { translateDynamic } from '@/localization/i18n';

export function TicketDetailScreen({ ticketId }: { ticketId: string }) {
  const ticket = useSupportTicket(ticketId);
  const reply = useReplyToTicket();
  const rate = useRateTicket();
  const [body, setBody] = useState('');

  if (ticket.isLoading) return <StyledText>support.ticket.loading</StyledText>;
  if (ticket.isError || !ticket.data) return <StyledText>support.ticket.error</StyledText>;

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText>{ticket.data.reference}</StyledText>
      <StyledText>{ticket.data.subject}</StyledText>
      <StyledText>{`support.ticket.status.${ticket.data.status}`}</StyledText>
      {ticket.data.messages.map((message: SupportTicket['messages'][number]) => <StyledText key={message.id}>{message.body}</StyledText>)}
      <TextInput accessibilityLabel={translateDynamic('support.ticket.reply')} value={body} onChangeText={setBody} />
      <ActionButton label="support.ticket.sendReply" loading={reply.isPending} onPress={() => reply.mutate({ ticketId, input: { description: body }, expectedVersion: ticket.data.version, operationId: `support-reply-${Date.now()}` })} />
      {reply.isError ? <StyledText>support.ticket.replyFailed</StyledText> : null}
      {canRateTicket(ticket.data.status) ? <ActionButton label="support.ticket.rate.5" loading={rate.isPending} onPress={() => rate.mutate({ ticketId, rating: 5, expectedVersion: ticket.data.version, operationId: `support-rate-${Date.now()}` })} /> : null}
    </ScrollView>
  );
}
