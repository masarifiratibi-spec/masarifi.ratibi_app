import React, { useCallback, useLayoutEffect } from 'react';
import { BackHandler } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';

export default function TransactionsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string; accountId?: string | string[] }>();
  const accountId = typeof params.accountId === 'string' && /^[A-Za-z0-9_-]+$/.test(params.accountId)
    ? params.accountId
    : null;
  useLayoutEffect(() => {
    if (accountId) useCoreFinanceViewState.getState().selectAccount(accountId);
  }, [accountId]);
  const returnTo = sanitizeReturnRoute(params.returnTo ?? null);
  useFocusEffect(useCallback(() => {
    if (!returnTo) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissTo(returnTo);
      return true;
    });
    return () => subscription.remove();
  }, [returnTo]));
  const { TransactionListScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/transactions/TransactionListScreen') as typeof import('@/features/transactions/TransactionListScreen');

  return (
    <TransactionListScreen
      onBack={returnTo ? () => router.dismissTo(returnTo) : undefined}
    />
  );
}
