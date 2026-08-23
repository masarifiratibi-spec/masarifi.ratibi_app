import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { BalanceCard } from '@/design-system/components/financial/BalanceCard';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
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
  const [selected, setSelected] = useState<
    'keep_local' | 'keep_later' | null
  >(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();
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
        actionLabel={
          query.isError ? translate('coreFinance.action.retry') : undefined
        }
        onAction={query.isError ? () => void query.refetch() : undefined}
      />
    );
  const conflict = query.data;
  const resolve = async (choice: 'keep_local' | 'keep_later') => {
    if (working) return;
    setWorking(true);
    setError(undefined);
    try {
      const result = await coreFinanceService.resolveConflict(id, choice);
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
      router.replace('/(tabs)/transactions');
    } catch {
      setError(translate('coreFinance.state.error'));
    } finally {
      setWorking(false);
    }
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
        minorUnits={conflict.localSnapshot.amountMinor}
        currency={conflict.localSnapshot.currencyCode}
        hidden
      />
      <StyledText variant="subtitle">
        {translate('coreFinance.conflict.later')}
      </StyledText>
      <BalanceCard
        title={conflict.laterSnapshot.title}
        minorUnits={conflict.laterSnapshot.amountMinor}
        currency={conflict.laterSnapshot.currencyCode}
        hidden
      />
      <RadioCard
        label={translate('coreFinance.conflict.keepLocal')}
        selected={selected === 'keep_local'}
        onPress={() => setSelected('keep_local')}
      />
      <RadioCard
        label={translate('coreFinance.conflict.keepLater')}
        selected={selected === 'keep_later'}
        onPress={() => setSelected('keep_later')}
      />
      <ActionButton
        disabled={!selected || working}
        loading={working}
        label={translate('coreFinance.conflict.resolve')}
        onPress={() => {
          if (!selected) return;
          Alert.alert(
            translate('coreFinance.conflict.resolve'),
            translate('coreFinance.conflict.resolveConfirm'),
            [
              { text: translate('coreFinance.cancel'), style: 'cancel' },
              {
                text: translate('coreFinance.conflict.resolve'),
                onPress: () => void resolve(selected)
              }
            ]
          );
        }}
      />
      <ActionButton
        label={translate('coreFinance.cancel')}
        variant="quiet"
        onPress={() => router.back()}
      />
      {error ? <StyledText variant="caption">{error}</StyledText> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ stack: { gap: 12, padding: 16 } });
