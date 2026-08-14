import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { TicketDetailScreen } from '@/features/support/TicketDetailScreen';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams();
  return <TicketDetailScreen ticketId={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
