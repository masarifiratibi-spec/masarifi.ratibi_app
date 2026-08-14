import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AccountForm } from '@/features/accounts/AccountForm';
import { useAccount } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
export default function EditAccountRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useAccount(id ?? '');
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
        title={translate('coreFinance.accounts.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  return <AccountForm account={query.data} />;
}
