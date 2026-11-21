import React from 'react';

export default function ReportDrillDownRoute() {
  const { ReportDrillDownScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/reports/ReportDrillDownScreen') as typeof import('@/features/reports/ReportDrillDownScreen');
  return <ReportDrillDownScreen />;
}
