import React, { useMemo } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { TransactionRow } from '@/design-system/components/financial/TransactionRow';
import type { Account, Category, Transaction } from '@/domain/core-finance';
import {
  useAccounts,
  useCategories,
  useTransactions
} from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { useTheme } from '@/state/theme-context';
import { formatDate } from '@/utils/format-financial-value';

export function TransactionListScreen() {
  const theme = useTheme();
  const filters = useCoreFinanceViewState((state) => state.filters);
  const editFilters = useCoreFinanceViewState((state) => state.editFilters);
  const applyFilters = useCoreFinanceViewState((state) => state.applyFilters);
  const query = useTransactions(filters);
  const accounts = useAccounts(true);
  const categories = useCategories(true);
  const locale = currentLocale();
  const accountNames = useMemo(
    () =>
      new Map<string, string>(
        (accounts.data ?? []).map((item: Account) => [item.id, item.name])
      ),
    [accounts.data]
  );
  const categoryNames = useMemo(
    () =>
      new Map<string, string>(
        (categories.data ?? []).map((item: Category) => [
          item.id,
          locale === 'ar' ? item.labelAr : item.labelEn
        ])
      ),
    [categories.data, locale]
  );
  return (
    <FlatList
      data={query.data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <StyledText variant="title">
            {translate('appShell.tabs.transactions')}
          </StyledText>
          <TextInput
            accessibilityLabel={translate('coreFinance.ledger.search')}
            placeholder={translate('coreFinance.ledger.search')}
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.search,
              {
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }
            ]}
            defaultValue={filters.search}
            onChangeText={(search) => editFilters({ search })}
            onSubmitEditing={applyFilters}
          />
          <ActionButton
            label={translate('coreFinance.ledger.filters')}
            variant="secondary"
            onPress={() => router.push('/modals/transaction-filters')}
          />
        </View>
      }
      ListEmptyComponent={
        query.isLoading ? (
          <StateView
            state="loading"
            title={translate('coreFinance.state.loading')}
          />
        ) : query.isError ? (
          <StateView
            state="error"
            title={translate('coreFinance.state.error')}
            actionLabel={translate('coreFinance.action.retry')}
            onAction={() => void query.refetch()}
          />
        ) : (
          <StateView
            state="empty"
            title={
              filters.search
                ? translate('coreFinance.ledger.filteredEmpty')
                : translate('coreFinance.ledger.empty')
            }
          />
        )
      }
      renderItem={({ item }) => (
        <TransactionItem
          item={item}
          accountName={accountNames.get(item.accountId)}
          categoryName={
            item.categoryId ? categoryNames.get(item.categoryId) : undefined
          }
        />
      )}
    />
  );
}

function TransactionItem({
  item,
  accountName,
  categoryName
}: {
  item: Transaction;
  accountName?: string;
  categoryName?: string;
}) {
  const meaning =
    item.type === 'income'
      ? 'income'
      : item.type === 'transfer'
        ? 'transfer'
        : item.type === 'refund'
          ? 'refund'
          : 'expense';
  return (
    <TransactionRow
      title={item.title}
      category={categoryName ?? translate('coreFinance.ledger.uncategorized')}
      date={formatDate(item.occurredAt, currentLocale())}
      account={accountName ?? translate('coreFinance.accounts.missing')}
      source={translate(`coreFinance.source.${item.source}` as never)}
      meaning={meaning}
      statusLabel={
        item.syncStatus !== 'synced'
          ? translate(`coreFinance.sync.${item.syncStatus}` as never)
          : undefined
      }
      amount={item.amountMinor / 100}
      currency={item.currencyCode}
      onPress={() => router.push(`/transactions/${item.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 8, marginBottom: 8 },
  search: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12
  }
});
