import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StateView } from '@/design-system/components/feedback/StateView';
import { useTransaction } from '@/features/core-finance/core-finance-queries';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { translate } from '@/localization/i18n';
export default function TransactionEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTransaction(id ?? '');
  if (!query.data)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  return <TransactionForm transaction={query.data} />;
}
