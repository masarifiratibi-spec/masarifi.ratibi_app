import React from 'react';

import { ReportScheduleScreen } from '@/features/reports/ReportScheduleScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function ReportScheduleRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('reports.backendUnavailable')} />;
  return <ReportScheduleScreen />;
}
