import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ActionButton } from '@/design-system/components/ActionButton';
import { UndoSnackbar } from '@/design-system/components/feedback/TransientFeedback';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AmountText } from '@/design-system/components/financial/FinancialPrimitives';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { Account, Category } from '@/domain/core-finance';
import {
  invalidateCoreFinanceScopes,
  useAccounts,
  useCategories,
  useTransaction
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { automaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { invalidateTrackingScopes } from '@/features/tracking/useAutomaticTracking';
import { useTheme } from '@/state/theme-context';
import { formatDate } from '@/utils/format-financial-value';
import { buildTransactionSupportContext } from '@/features/support/support-context';

export function TransactionDetailScreen({ id }: { id: string }) {
  const theme = useTheme();
  const client = useQueryClient();
  const query = useTransaction(id);
  const accounts = useAccounts(true);
  const categories = useCategories(true);
  const [deletedUntil, setDeletedUntil] = useState<number | null>(null);
  if (query.isLoading)
    return (
      <StateView
        state="loading"
        title={translate('coreFinance.state.loading')}
      />
    );
  if (query.isError || !query.data)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.transaction.missing')}
        actionLabel={translate('appShell.navigation.back')}
        onAction={() => router.back()}
      />
    );
  const item = query.data;
  const locale = currentLocale();
  const accountName = accounts.data?.find(
    (account: Account) => account.id === item.accountId
  )?.name;
  const category = categories.data?.find(
    (candidate: Category) => candidate.id === item.categoryId
  );
  const restoredDeletedUntil =
    item.status === 'deleted' &&
    item.undoExpiresAt !== null &&
    item.undoExpiresAt > Date.now()
      ? item.undoExpiresAt
      : null;
  const activeDeletedUntil = deletedUntil ?? restoredDeletedUntil;
  const meaning =
    item.type === 'income'
      ? 'income'
      : item.type === 'transfer'
        ? 'transfer'
        : item.type === 'refund'
          ? 'refund'
          : 'expense';
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <SurfaceCard>
        <View style={styles.stack}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {item.title}
          </Text>
          <AmountText
            value={item.amountMinor / 100}
            currency={item.currencyCode}
            meaning={meaning}
          />
          <Detail
            label={translate('coreFinance.transaction.type')}
            value={translate(`coreFinance.type.${item.type}` as never)}
          />
          <Detail
            label={translate('coreFinance.transaction.date')}
            value={formatDate(item.occurredAt, locale)}
          />
          <Detail
            label={translate('coreFinance.transaction.account')}
            value={accountName ?? translate('coreFinance.accounts.missing')}
          />
          <Detail
            label={translate('coreFinance.transaction.category')}
            value={
              category
                ? locale === 'ar'
                  ? category.labelAr
                  : category.labelEn
                : translate('coreFinance.ledger.uncategorized')
            }
          />
          <Detail
            label={translate('coreFinance.transaction.source')}
            value={translate(`coreFinance.source.${item.source}` as never)}
          />
          <Detail
            label={translate('coreFinance.transaction.status')}
            value={translate(`coreFinance.sync.${item.syncStatus}` as never)}
          />
        </View>
      </SurfaceCard>
      <ActionButton
        label={translate('coreFinance.transaction.edit')}
        variant="secondary"
        onPress={() => router.push(`/transactions/${id}/edit`)}
      />
      <ActionButton
        label="support.report.transaction"
        variant="secondary"
        onPress={() => router.push({ pathname: '/support/new', params: { mode: 'transaction_report', context: JSON.stringify(buildTransactionSupportContext(item, { appVersion: '1.0.0' })) } })}
      />
      {item.source === 'automatic' ? (
        <ActionButton
          label={translate('tracking.action.reportWrong')}
          variant="secondary"
          onPress={async () => {
            const result =
              await automaticTrackingService.reportWrongDetection(id);
            await invalidateTrackingScopes(client, result.affectedScopes);
          }}
        />
      ) : null}
      {!activeDeletedUntil ? (
        <ActionButton
          label={translate('coreFinance.transaction.delete')}
          variant="destructive"
          onPress={async () => {
            const result = await coreFinanceService.deleteTransaction(id);
            setDeletedUntil(result.undoExpiresAt);
            await invalidateCoreFinanceScopes(client, result.affectedScopes);
          }}
        />
      ) : null}
      {activeDeletedUntil ? (
        <UndoSnackbar
          message={translate('coreFinance.transaction.deleted')}
          timeoutMs={Math.max(0, activeDeletedUntil - Date.now())}
          onUndo={async () => {
            const result = await coreFinanceService.undoDelete(id);
            setDeletedUntil(null);
            await invalidateCoreFinanceScopes(client, result.affectedScopes);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={{ color: theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ color: theme.colors.textPrimary }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' }
});
