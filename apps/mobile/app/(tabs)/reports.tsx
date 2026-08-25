import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { sanitizePrimaryTabRoute } from '@/features/shell/navigation-context';

export default function ReportsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = sanitizePrimaryTabRoute(
    typeof params.returnTo === 'string' ? params.returnTo : null
  );
  return <ReportsScreen onBack={() => router.navigate(returnTo)} />;
}
