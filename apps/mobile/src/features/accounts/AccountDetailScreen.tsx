import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { BalanceCard } from '@/design-system/components/financial/BalanceCard';
import {
  deriveAccountBalance,
  emptyTransactionFilters
} from '@/domain/core-finance';
import {
  invalidateCoreFinanceScopes,
  useAccount,
  useTransactions
} from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export function AccountDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const account = useAccount(id);
  const transactions = useTransactions({
    ...emptyTransactionFilters,
    accountIds: [id]
  });
  if (account.isLoading || transactions.isLoading)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  if (account.isError || transactions.isError)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => {
          void account.refetch();
          void transactions.refetch();
        }}
      />
    );
  if (!account.data)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.accounts.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  const value = account.data;
  const balance =
    deriveAccountBalance(value, transactions.data?.items ?? []) / 100;
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <BalanceCard
        title={value.name}
        value={balance}
        currency={value.currencyCode}
      />
      <ActionButton
        label={translate('coreFinance.accounts.edit')}
        variant="secondary"
        onPress={() => router.push(`/accounts/${id}/edit`)}
      />
      <ActionButton
        label={
          value.status === 'archived'
            ? translate('coreFinance.accounts.restore')
            : translate('coreFinance.accounts.archive')
        }
        variant={value.status === 'archived' ? 'secondary' : 'destructive'}
        onPress={async () => {
          const result =
            value.status === 'archived'
              ? await coreFinanceService.restoreAccount(id)
              : await coreFinanceService.archiveAccount(id);
          await invalidateCoreFinanceScopes(client, result.affectedScopes);
          router.replace('/accounts');
        }}
      />
      <ActionButton
        label={translate('coreFinance.action.transfer')}
        variant="secondary"
        onPress={() => router.push(`/(tabs)/add?type=transfer&accountId=${id}`)}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({ stack: { gap: 12, padding: 16 } });
