import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StateView } from '@/design-system/components/feedback/StateView';
import { useTransaction } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
export default function TransactionEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTransaction(id ?? '');
  if (query.isLoading)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  if (query.isError)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void query.refetch()}
      />
    );
  if (!query.data)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.transaction.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  const { TransactionForm } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/transactions/TransactionForm') as typeof import('@/features/transactions/TransactionForm');
  return <TransactionForm transaction={query.data} />;
}
