import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { AccountCard } from '@/design-system/components/financial/AccountCard';
import {
  deriveAccountBalance,
  emptyTransactionFilters,
  type Account
} from '@/domain/core-finance';
import {
  useAccounts,
  useTransactions
} from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function AccountListScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const accounts = useAccounts(true);
  const transactions = useTransactions(emptyTransactionFilters);
  const filtered = useMemo(
    () =>
      (accounts.data ?? []).filter((item: Account) =>
        item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      ),
    [accounts.data, search]
  );
  if (accounts.isLoading)
    return (
      <View style={styles.content}>
        <StyledText variant="title">
          {translate('appShell.shell.accounts')}
        </StyledText>
        <StateView
          state="loading"
          title={translate('coreFinance.state.loading')}
        />
      </View>
    );
  if (accounts.isError)
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => void accounts.refetch()}
      />
    );
  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <StyledText variant="title">
            {translate('appShell.shell.accounts')}
          </StyledText>
          <TextInput
            accessibilityLabel={translate('coreFinance.accounts.search')}
            placeholder={translate('coreFinance.accounts.search')}
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.search,
              {
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }
            ]}
          />
          <ActionButton
            label={translate('coreFinance.accounts.add')}
            onPress={() => router.push('/accounts/new')}
          />
        </View>
      }
      ListEmptyComponent={
        <StateView
          state="empty"
          title={translate('coreFinance.accounts.empty')}
        />
      }
      renderItem={({ item }) => (
        <AccountCard
          name={item.name}
          type={translate(`coreFinance.accountType.${item.type}` as never)}
          maskedIdentifier={
            item.lastFour ? `•••• ${item.lastFour}` : item.currencyCode
          }
          balance={
            deriveAccountBalance(item, transactions.data?.items ?? []) / 100
          }
          currency={item.currencyCode}
          statusLabel={
            item.status === 'archived'
              ? translate('coreFinance.accounts.archived')
              : item.isDefault
                ? translate('coreFinance.accounts.default')
                : undefined
          }
          actionLabel={translate('coreFinance.accounts.open')}
          onAction={() => router.push(`/accounts/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, padding: 16, paddingBottom: 40 },
  header: { gap: 10 },
  search: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12
  }
});
