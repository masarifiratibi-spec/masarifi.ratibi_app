import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { TransactionListScreen } from '@/features/transactions/TransactionListScreen';

export default function TransactionsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = sanitizeReturnRoute(params.returnTo ?? null);

  return (
    <TransactionListScreen
      onBack={returnTo ? () => router.navigate(returnTo) : undefined}
    />
  );
}
