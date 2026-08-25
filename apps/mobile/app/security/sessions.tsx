import React from 'react';

import { SessionListScreen } from '@/features/settings/SessionListScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function SecuritySessionsRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('settings.sessions.error')} />;
  return <SessionListScreen />;
}
