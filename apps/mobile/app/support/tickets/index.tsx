import React from 'react';

import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function TicketsRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('support.backendUnavailable')} />;
  const { TicketListScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/support/TicketListScreen') as typeof import('@/features/support/TicketListScreen');
  return <TicketListScreen />;
}
