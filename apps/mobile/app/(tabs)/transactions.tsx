import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { sanitizeReturnRoute } from '@/features/shell/navigation-context';

export default function TransactionsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = sanitizeReturnRoute(params.returnTo ?? null);
  const { TransactionListScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/transactions/TransactionListScreen') as typeof import('@/features/transactions/TransactionListScreen');

  return (
    <TransactionListScreen
      onBack={returnTo ? () => router.navigate(returnTo) : undefined}
    />
  );
}
