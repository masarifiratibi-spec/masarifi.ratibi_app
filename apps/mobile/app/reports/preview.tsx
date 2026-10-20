import React from 'react';

import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function ReportPreviewRoute() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('reports.backendUnavailable')} />;
  const { ReportPreviewScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/reports/ReportPreviewScreen') as typeof import('@/features/reports/ReportPreviewScreen');
  return <ReportPreviewScreen />;
}
