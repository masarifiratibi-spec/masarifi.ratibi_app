import React from 'react';

import { SecurityEventScreen } from '@/features/settings/SecurityEventScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function SecurityEventsRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('settings.securityEvents.error')} />;
  return <SecurityEventScreen />;
}
