import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

import { StateView } from '@/design-system/components/feedback/StateView';
import { DesignIcon } from '@/design-system/icons';
import { colorTokens, radius, spacing } from '@/design-system/tokens';
import type { Account } from '@/domain/core-finance';
import { AccountRow } from '@/features/accounts/AccountRow';
import { projectAccount } from '@/features/accounts/account-presentation';
import {
  useAccountBalances,
  useAccounts
} from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import type { AccountBalanceProjection } from '@/services/contracts/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';

export function AccountPicker({
  selectedId,
  selectedIds = [],
  excludedIds = [],
  onSelect
}: {
  selectedId?: string;
  selectedIds?: string[];
  excludedIds?: string[];
  onSelect?: (account: Account) => void;
}) {
  const accounts = useAccounts(true);
  const balances = useAccountBalances(true);
  const [search, setSearch] = useState('');
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const { revealed } = useSensitiveVisibility();

  const balanceByAccount = useMemo(
    () =>
      new Map<string, AccountBalanceProjection>(
        ((balances.data ?? []) as AccountBalanceProjection[]).map((item) => [
          item.accountId,
          item
        ])
      ),
    [balances.data]
  );

  const filtered = useMemo<Account[]>(
    () =>
      (accounts.data ?? []).filter(
        (account: Account) =>
          account.status === 'active' &&
          !excludedIds.includes(account.id) &&
          `${account.name} ${account.currencyCode} ${account.lastFour ?? ''}`
            .toLocaleLowerCase('en')
            .includes(search.trim().toLocaleLowerCase('en'))
      ),
    [accounts.data, excludedIds, search]
  );

  const hasEligibleAccounts = (accounts.data ?? []).some(
    (account: Account) => account.status === 'active'
  );

  const loading = accounts.isLoading || balances.isLoading;

  if (accounts.isError || balances.isError) {
    return (
      <StateView
        state="error"
        title={translate('coreFinance.state.error')}
        actionLabel={translate('coreFinance.action.retry')}
        onAction={() => {
          void accounts.refetch();
          void balances.refetch();
        }}
      />
    );
  }

  return (
    <FlatList
      testID="account-picker-list"
      contentContainerStyle={styles.listContent}
      data={filtered}
      keyExtractor={(account) => account.id}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.searchBoxContainer}>
          <View style={[styles.searchField, { direction }]}>
            {/* Search Icon */}
            <DesignIcon
              name="search"
              size="sm"
              color={colorTokens.ink['500']}
              direction={direction}
              decorative
            />

            {/* Input field */}
            <TextInput
              testID="account-search-input"
              accessibilityLabel={translate('coreFinance.accounts.search')}
              placeholder={translate('coreFinance.accounts.search')}
              placeholderTextColor={colorTokens.ink['500']}
              value={search}
              onChangeText={setSearch}
              style={[
                styles.searchInput,
                {
                  textAlign: isRtl ? 'right' : 'left',
                  writingDirection: direction
                }
              ]}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />

            {/* Clear search button */}
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={8}
                accessibilityLabel={translate('appShell.navigation.close')}
                accessibilityRole="button"
              >
                <DesignIcon
                  name="close"
                  size="xs"
                  color={colorTokens.ink['500']}
                  direction={direction}
                  decorative
                />
              </Pressable>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        <StateView
          state={loading ? 'loading' : 'empty'}
          title={
            loading
              ? translate('coreFinance.state.loading')
              : translate(
                  hasEligibleAccounts
                    ? 'coreFinance.accounts.noSearchResults'
                    : 'coreFinance.accounts.noEligible'
                )
          }
        />
      }
      renderItem={({ item }) => (
        <AccountRow
          presentation={projectAccount(
            item,
            balanceByAccount.get(item.id),
            hideBalances && !revealed
          )}
          selected={selectedId === item.id || selectedIds.includes(item.id)}
          onPress={() => onSelect?.(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs
  },
  searchBoxContainer: {
    marginBottom: spacing.md
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: colorTokens.sand['50'],
    borderColor: colorTokens.sand['400'],
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md
  },
  searchInput: {
    color: colorTokens.ink['900'],
    flex: 1,
    fontSize: 14.5,
    height: '100%'
  },
  separator: {
    height: spacing.sm
  }
});
