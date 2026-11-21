import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { sanitizePrimaryTabRoute } from '@/features/shell/navigation-context';

export default function ReportsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = sanitizePrimaryTabRoute(
    typeof params.returnTo === 'string' ? params.returnTo : null
  );
  const { ReportsScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/reports/ReportsScreen') as typeof import('@/features/reports/ReportsScreen');
  return <ReportsScreen onBack={() => router.navigate(returnTo)} />;
}
