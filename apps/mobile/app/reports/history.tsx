import React from 'react';

export default function ReportHistoryRoute() {
  const { ReportHistoryScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/reports/ReportHistoryScreen') as typeof import('@/features/reports/ReportHistoryScreen');
  return <ReportHistoryScreen />;
}
