import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { supportService } from '@/services/engagement-service';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams();
  if (supportService.metadata.availability !== 'available')
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  const { TicketDetailScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/support/TicketDetailScreen') as typeof import('@/features/support/TicketDetailScreen');
  return <TicketDetailScreen ticketId={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
