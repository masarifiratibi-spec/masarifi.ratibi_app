import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { TicketDetailScreen } from '@/features/support/TicketDetailScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams();
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  return <TicketDetailScreen ticketId={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
