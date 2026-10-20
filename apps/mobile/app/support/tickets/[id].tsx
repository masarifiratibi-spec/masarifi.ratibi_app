import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams();
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  const { TicketDetailScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/support/TicketDetailScreen') as typeof import('@/features/support/TicketDetailScreen');
  return <TicketDetailScreen ticketId={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
