import React from 'react';

import { ReportPreviewScreen } from '@/features/reports/ReportPreviewScreen';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function ReportPreviewRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('reports.backendUnavailable')} />;
  return <ReportPreviewScreen />;
}
