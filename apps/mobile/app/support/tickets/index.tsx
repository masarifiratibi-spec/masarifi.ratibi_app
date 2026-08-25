import React from 'react';

import { TicketListScreen } from '@/features/support/TicketListScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketsRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  return <TicketListScreen />;
}
