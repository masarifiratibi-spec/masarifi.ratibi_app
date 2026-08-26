import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

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
import { useTheme } from '@/state/theme-context';

export function AccountPicker({
  selectedId,
  selectedIds = [],
  excludedIds = [],
  currencyCode,
  appearance = 'cards',
  onSelect
}: {
  selectedId?: string;
  selectedIds?: string[];
  excludedIds?: string[];
  currencyCode?: string;
  appearance?: 'cards' | 'grouped';
  onSelect?: (account: Account) => void;
}) {
  const accounts = useAccounts(true);
  const balances = useAccountBalances(true);
  const [search, setSearch] = useState('');
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const { revealed } = useSensitiveVisibility();
  const theme = useTheme();
  const grouped = appearance === 'grouped';

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

  const eligible = useMemo<Account[]>(
    () =>
      (accounts.data ?? []).filter(
        (account: Account) =>
          account.status === 'active' &&
          !excludedIds.includes(account.id) &&
          (!currencyCode ||
            account.currencyCode === currencyCode ||
            account.id === selectedId)
      ),
    [accounts.data, currencyCode, excludedIds, selectedId]
  );

  const filtered = useMemo<Account[]>(
    () =>
      eligible.filter((account: Account) =>
        `${account.name} ${account.currencyCode} ${account.lastFour ?? ''}`
          .toLocaleLowerCase('en')
          .includes(search.trim().toLocaleLowerCase('en'))
      ),
    [eligible, search]
  );

  const hasEligibleAccounts = eligible.length > 0;

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
      contentContainerStyle={[
        styles.listContent,
        grouped && styles.groupedListContent
      ]}
      data={filtered}
      keyExtractor={(account) => account.id}
      ItemSeparatorComponent={
        grouped ? undefined : () => <View style={styles.separator} />
      }
      ListHeaderComponent={
        grouped ? null : (
          <View style={styles.searchBoxContainer}>
            <View
              testID="account-search-field"
              style={[
                styles.searchField,
                {
                  backgroundColor: theme.colors.surfaces.card,
                  borderColor: theme.colors.borders.subtle,
                  direction
                }
              ]}
            >
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
        )
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
      renderItem={({ item, index }) => (
        <AccountRow
          presentation={projectAccount(
            item,
            balanceByAccount.get(item.id),
            hideBalances && !revealed
          )}
          selected={selectedId === item.id || selectedIds.includes(item.id)}
          groupedPosition={
            grouped
              ? filtered.length === 1
                ? 'only'
                : index === 0
                  ? 'first'
                  : index === filtered.length - 1
                    ? 'last'
                    : 'middle'
              : undefined
          }
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
  groupedListContent: {
    paddingBottom: 0,
    paddingTop: 0
  },
  searchBoxContainer: {
    marginBottom: spacing.md
  },
  searchField: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
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
