import React from 'react';

export default function ReportPreviewRoute() {
  const { ReportPreviewScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/reports/ReportPreviewScreen') as typeof import('@/features/reports/ReportPreviewScreen');
  return <ReportPreviewScreen />;
}
