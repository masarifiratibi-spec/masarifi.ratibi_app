import React from 'react';

import { supportService } from '@/services/engagement-service';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketsRoute() {
  if (supportService.metadata.availability !== 'available')
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  const { TicketListScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/support/TicketListScreen') as typeof import('@/features/support/TicketListScreen');
  return <TicketListScreen />;
}
