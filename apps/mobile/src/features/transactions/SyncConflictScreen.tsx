import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { BalanceCard } from '@/design-system/components/financial/BalanceCard';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import {
  coreFinanceKeys,
  invalidateCoreFinanceScopes
} from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export function SyncConflictScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: coreFinanceKeys.conflict(id),
    queryFn: () => coreFinanceService.getConflict(id)
  });
  if (!query.data)
    return (
      <StateView
        state={query.isError ? 'error' : 'loading'}
        title={
          query.isError
            ? translate('coreFinance.conflict.missing')
            : translate('coreFinance.state.loading')
        }
      />
    );
  const conflict = query.data;
  const resolve = async (choice: 'keep_local' | 'keep_later') => {
    const result = await coreFinanceService.resolveConflict(id, choice);
    await invalidateCoreFinanceScopes(client, result.affectedScopes);
    router.replace('/(tabs)/transactions');
  };
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('coreFinance.conflict.title')}
      </StyledText>
      <StyledText variant="subtitle">
        {translate('coreFinance.conflict.local')}
      </StyledText>
      <BalanceCard
        title={conflict.localSnapshot.title}
        value={conflict.localSnapshot.amountMinor / 100}
        currency={conflict.localSnapshot.currencyCode}
        hidden
      />
      <StyledText variant="subtitle">
        {translate('coreFinance.conflict.later')}
      </StyledText>
      <BalanceCard
        title={conflict.laterSnapshot.title}
        value={conflict.laterSnapshot.amountMinor / 100}
        currency={conflict.laterSnapshot.currencyCode}
        hidden
      />
      <ActionButton
        label={translate('coreFinance.conflict.keepLocal')}
        onPress={() => void resolve('keep_local')}
      />
      <ActionButton
        label={translate('coreFinance.conflict.keepLater')}
        variant="secondary"
        onPress={() => void resolve('keep_later')}
      />
      <ActionButton
        label={translate('coreFinance.cancel')}
        variant="quiet"
        onPress={() => router.back()}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({ stack: { gap: 12, padding: 16 } });
