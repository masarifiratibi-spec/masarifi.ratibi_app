import React from 'react';

import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function SecurityEventsRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('settings.securityEvents.error')} />;
  const { SecurityEventScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/SecurityEventScreen') as typeof import('@/features/settings/SecurityEventScreen');
  return <SecurityEventScreen />;
}
