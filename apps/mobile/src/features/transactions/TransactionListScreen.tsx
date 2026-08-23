import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { StateView } from '@/design-system/components/feedback/StateView';
import { SkeletonBlock } from '@/design-system/components/feedback/Skeleton';
import {
  AmountText,
  financialMinorAmountNeedsFullWidth
} from '@/design-system/components/financial/FinancialPrimitives';
import { TransactionRow } from '@/design-system/components/financial/TransactionRow';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import {
  colorTokens,
  elevation,
  minTouchTarget,
  radius,
  spacing
} from '@/design-system/tokens';
import { fontFamilyForLocale } from '@/design-system/typography';
import type {
  Account,
  Category,
  Transaction,
  TransactionFilterSet
} from '@/domain/core-finance';
import {
  useAccounts,
  useCategories,
  useHomeSummary,
  useInfiniteTransactions
} from '@/features/core-finance/core-finance-queries';
import { AccountScopeSheet } from '@/features/accounts/AccountScopeSheet';
import { DateRangeSheet } from '@/features/filters/DateRangeSheet';
import {
  formatPeriodLabel,
  periodFilters,
  periodFromRange
} from '@/features/filters/date-period';
import { PrimaryShellHeader } from '@/features/shell/PrimaryShellHeader';
import { currentLocale, translate } from '@/localization/i18n';
import {
  applyAccountScope,
  useCoreFinanceViewState
} from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import {
  formatTransactionTimestamp,
  projectTransaction
} from './transaction-presentation';
import {
  buildTransactionSections,
  type TransactionGroupedPosition
} from './transaction-sections';
import { CategoryFilterPicker } from './CategoryFilterPicker';

type LedgerRow =
  | { kind: 'header'; key: string; label: string }
  | {
      kind: 'transaction';
      key: string;
      item: Transaction;
      groupedPosition: TransactionGroupedPosition;
    };

type QuickScope = {
  key: string;
  label: string;
  categoryIds: string[];
  types: TransactionFilterSet['types'];
};

const quickCategoryIds = [
  'food',
  'transportation',
  'shopping',
  'health'
] as const;

const quickSortValues = [
  'newest',
  'oldest',
  'amount_high',
  'amount_low'
] as const;
const quickTypeValues = ['expense', 'income', 'transfer'] as const;

export function TransactionListScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const filters = useCoreFinanceViewState((state) => state.filters);
  const draft = useCoreFinanceViewState((state) => state.draftFilters);
  const beginFilterSession = useCoreFinanceViewState(
    (state) => state.beginFilterSession
  );
  const editFilters = useCoreFinanceViewState((state) => state.editFilters);
  const applyFilters = useCoreFinanceViewState((state) => state.applyFilters);
  const cancelFilterSession = useCoreFinanceViewState(
    (state) => state.cancelFilterSession
  );
  const removeFilter = useCoreFinanceViewState((state) => state.removeFilter);
  const selectedAccountId = useCoreFinanceViewState(
    (state) => state.selectedAccountId
  );
  const reconcileSelectedAccount = useCoreFinanceViewState(
    (state) => state.reconcileSelectedAccount
  );
  const direction = usePreferenceStore((state) => state.direction);
  const firstDayOfWeek = usePreferenceStore((state) => state.firstDayOfWeek);
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const monthStartDay = usePreferenceStore((state) => state.monthStartDay);
  const now = useMemo(() => Date.now(), []);
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.search));
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [accountScopeOpen, setAccountScopeOpen] = useState(false);
  const quickScopeRailRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (direction === 'rtl') {
      quickScopeRailRef.current?.scrollToEnd({ animated: false });
    } else {
      quickScopeRailRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [direction]);

  const scopedFilters = useMemo(
    () => applyAccountScope(filters, selectedAccountId),
    [filters, selectedAccountId]
  );
  const query = useInfiniteTransactions(scopedFilters);
  const accounts = useAccounts(true);
  const categories = useCategories(true);
  const activeAccountIds = useMemo(
    () =>
      ((accounts.data ?? []) as Account[])
        .filter((account) => account.status === 'active')
        .map((account) => account.id),
    [accounts.data]
  );

  useEffect(() => {
    if (accounts.data) reconcileSelectedAccount(activeAccountIds);
  }, [accounts.data, activeAccountIds, reconcileSelectedAccount]);

  const accountById = useMemo(
    () =>
      new Map<string, Account>(
        ((accounts.data ?? []) as Account[]).map((item) => [item.id, item])
      ),
    [accounts.data]
  );
  const categoryById = useMemo(
    () =>
      new Map<string, Category>(
        ((categories.data ?? []) as Category[]).map((item) => [item.id, item])
      ),
    [categories.data]
  );
  const quickCategoryById = useMemo(() => {
    return new Map(
      ((categories.data ?? []) as Category[])
        .filter((category) => category.status === 'active')
        .map((category) => [category.id, category])
    );
  }, [categories.data]);
  const locale = currentLocale();
  const appliedPeriod = periodFromRange(
    filters.periodStart,
    filters.periodEnd,
    now,
    { timeZone, monthStartDay }
  );
  const draftPeriod = periodFromRange(draft.periodStart, draft.periodEnd, now, {
    timeZone,
    monthStartDay
  });
  const periodLabel = formatPeriodLabel(appliedPeriod, locale, timeZone);
  const categoryScopes = quickCategoryIds.flatMap((id) => {
    const category = quickCategoryById.get(id);
    return category
      ? [
          {
            key: id,
            label: locale === 'ar' ? category.labelAr : category.labelEn,
            categoryIds: [category.id],
            types: []
          } satisfies QuickScope
        ]
      : [];
  });
  const quickScopes: QuickScope[] = [
    {
      key: 'all',
      label: translate('coreFinance.ledger.quick.all'),
      categoryIds: [],
      types: []
    },
    ...categoryScopes.slice(0, 1),
    {
      key: 'transfer',
      label: translate('coreFinance.ledger.quick.transfer'),
      categoryIds: [],
      types: ['transfer']
    },
    ...categoryScopes.slice(1)
  ];
  const quickSelection = quickScopes.find(
    (scope) =>
      scope.categoryIds.length === filters.categoryIds.length &&
      scope.categoryIds.every((id) => filters.categoryIds.includes(id)) &&
      scope.types.length === filters.types.length &&
      scope.types.every((type) => filters.types.includes(type))
  );
  const quickCategorySelected = Boolean(quickSelection?.categoryIds.length);
  const quickTypeSelected = Boolean(quickSelection?.types.length);
  const transactions = useMemo(() => {
    const byId = new Map<string, Transaction>();
    query.data?.pages.forEach((page) =>
      page.items.forEach((item) => byId.set(item.id, item))
    );
    return [...byId.values()];
  }, [query.data?.pages]);
  const rows = useMemo<LedgerRow[]>(() => {
    return buildTransactionSections(transactions, now, firstDayOfWeek).flatMap(
      (group) => [
        {
          kind: 'header' as const,
          key: `header-${group.key}`,
          label: translate(`coreFinance.ledger.period.${group.key}` as never)
        },
        ...group.items.map(({ item, groupedPosition }) => ({
          kind: 'transaction' as const,
          key: item.id,
          item,
          groupedPosition
        }))
      ]
    );
  }, [firstDayOfWeek, now, transactions]);
  const activeFilters = useMemo(() => {
    const values: { key: keyof TransactionFilterSet; label: string }[] = [];
    const addCount = (
      key: keyof TransactionFilterSet,
      labelKey: string,
      count: number
    ) => {
      if (count)
        values.push({
          key,
          label: `${translate(labelKey as never)}: ${count}`
        });
    };
    if (filters.search)
      values.push({
        key: 'search',
        label: `${translate('coreFinance.ledger.search')}: ${filters.search}`
      });
    if (filters.periodStart)
      values.push({
        key: 'periodStart',
        label: translate('coreFinance.filters.periodStart')
      });
    if (filters.periodEnd)
      values.push({
        key: 'periodEnd',
        label: translate('coreFinance.filters.periodEnd')
      });
    addCount(
      'accountIds',
      'coreFinance.filters.accounts',
      filters.accountIds.length
    );
    if (!quickCategorySelected) {
      addCount(
        'categoryIds',
        'coreFinance.filters.categories',
        filters.categoryIds.length
      );
    }
    if (!quickTypeSelected) {
      addCount('types', 'coreFinance.filters.types', filters.types.length);
    }
    addCount('sources', 'coreFinance.filters.sources', filters.sources.length);
    addCount(
      'statuses',
      'coreFinance.filters.statuses',
      filters.statuses.length
    );
    addCount(
      'syncStatuses',
      'coreFinance.filters.syncStatuses',
      filters.syncStatuses.length
    );
    if (filters.reviewRequired !== null)
      values.push({
        key: 'reviewRequired',
        label: translate(
          filters.reviewRequired
            ? 'coreFinance.filters.reviewRequired'
            : 'coreFinance.filters.reviewNotRequired'
        )
      });
    if (filters.minMinor !== null)
      values.push({
        key: 'minMinor',
        label: translate('coreFinance.filters.minimum')
      });
    if (filters.maxMinor !== null)
      values.push({
        key: 'maxMinor',
        label: translate('coreFinance.filters.maximum')
      });
    if (filters.sort !== 'newest')
      values.push({
        key: 'sort',
        label: translate(`coreFinance.filters.sort.${filters.sort}` as never)
      });
    return values;
  }, [filters, quickCategorySelected, quickTypeSelected]);
  const applyQuickFilter = (patch: Partial<TransactionFilterSet>) => {
    beginFilterSession();
    editFilters(patch);
    applyFilters();
  };
  const applyQuickScopes = (
    categoryIds: string[],
    types: TransactionFilterSet['types']
  ) => applyQuickFilter({ categoryIds, types });
  const headerCenter = (
    <View
      testID="transaction-toolbar-actions"
      style={[
        styles.titleActions,
        styles.physicalLtr,
        {
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
        }
      ]}
    >
      <StyledText
        variant="title"
        numberOfLines={PixelRatio.getFontScale() >= 1.5 ? undefined : 1}
        style={[
          styles.shellTitle,
          {
            color: theme.colors.content.primary,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {translate('appShell.tabs.transactions')}
      </StyledText>
      <View
        testID="transaction-header-actions"
        style={[
          styles.headerActions,
          styles.physicalLtr,
          {
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
          }
        ]}
      >
        <ToolbarButton
          testID="transaction-search-action"
          icon="search"
          label={translate('coreFinance.ledger.search')}
          onPress={() => {
            beginFilterSession();
            setSearchOpen(true);
          }}
        />
        <ToolbarButton
          testID="transaction-filter-action"
          icon="more"
          label={translate('designSystem.navigation.moreOptions')}
          onPress={() => setQuickFiltersOpen(true)}
        />
      </View>
    </View>
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      style={{ backgroundColor: theme.colors.surfaces.page }}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <View
            testID="transactions-page-header"
            style={[
              styles.pageHeader,
              { backgroundColor: theme.colors.surfaces.page }
            ]}
          >
            <PrimaryShellHeader
              origin="/(tabs)/transactions"
              showReports={false}
              showAvatar={false}
              onBack={onBack}
            >
              {headerCenter}
            </PrimaryShellHeader>
            {searchOpen ? (
              <View
                testID="transaction-search-control"
                style={[
                  styles.search,
                  styles.physicalLtr,
                  {
                    backgroundColor: theme.colors.surfaces.card,
                    borderColor: theme.colors.borders.subtle,
                    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
                  }
                ]}
              >
                <DesignIcon
                  name="search"
                  label={translate('coreFinance.ledger.search')}
                  color={theme.colors.content.primary}
                  decorative
                />
                <TextInput
                  accessibilityLabel={translate('coreFinance.ledger.search')}
                  autoFocus
                  placeholder={translate('coreFinance.ledger.search')}
                  placeholderTextColor={theme.colors.content.secondary}
                  style={[
                    styles.searchInput,
                    {
                      color: theme.colors.content.primary,
                      fontFamily: fontFamilyForLocale(locale, 400),
                      textAlign: direction === 'rtl' ? 'right' : 'left'
                    }
                  ]}
                  value={draft.search}
                  onChangeText={(search) => editFilters({ search })}
                  onSubmitEditing={applyFilters}
                />
                <Pressable
                  accessibilityLabel={translate(
                    'coreFinance.ledger.clearSearch'
                  )}
                  accessibilityRole="button"
                  onPress={() => {
                    editFilters({ search: '' });
                    applyFilters();
                    setSearchOpen(false);
                  }}
                  style={styles.iconButton}
                >
                  <DesignIcon
                    name="close"
                    label={translate('coreFinance.ledger.clearSearch')}
                    color={theme.colors.content.primary}
                    decorative
                  />
                </Pressable>
              </View>
            ) : null}
            {/* Side-by-side Filter Bar: All Accounts Card + Period Card */}
            <View style={[styles.filterBarRow, { direction }]}>
              {/* 1. Account Scope Card (when 2+ active accounts) */}
              {activeAccountIds.length >= 2 ? (
                <Pressable
                  testID="transaction-account-scope"
                  accessibilityLabel={`${translate('coreFinance.home.accountScope.title')}: ${
                    (selectedAccountId &&
                      accountById.get(selectedAccountId)?.name) ||
                    translate('coreFinance.home.allAccounts')
                  }`}
                  accessibilityRole="button"
                  onPress={() => setAccountScopeOpen(true)}
                  style={({ pressed }) => [
                    styles.filterBarCard,
                    styles.physicalLtr,
                    {
                      flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
                    },
                    pressed && styles.filterCardPressed
                  ]}
                >
                  {/* Account Icon Badge */}
                  <View style={styles.filterIconBadge}>
                    <DesignIcon
                      name="accounts"
                      size="sm"
                      color={colorTokens.teal['700']}
                      direction={direction}
                      decorative
                    />
                  </View>

                  {/* Account label */}
                  <StyledText
                    variant="subtitle"
                    numberOfLines={1}
                    style={styles.filterBarText}
                  >
                    {(selectedAccountId &&
                      accountById.get(selectedAccountId)?.name) ||
                      translate('coreFinance.home.allAccounts')}
                  </StyledText>

                  {/* Chevron Down */}
                  <DesignIcon
                    name="chevronDown"
                    size="sm"
                    color={colorTokens.ink['900']}
                    direction={direction}
                    decorative
                  />
                </Pressable>
              ) : null}

              {/* 2. Date Period Card */}
              <Pressable
                testID="transaction-period-control"
                accessibilityLabel={periodLabel}
                accessibilityRole="button"
                onPress={() => {
                  beginFilterSession();
                  setPeriodOpen(true);
                }}
                style={({ pressed }) => [
                  styles.filterBarCard,
                  styles.physicalLtr,
                  {
                    alignSelf: 'center',
                    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
                  },
                  pressed && styles.filterCardPressed
                ]}
              >
                {/* Calendar Icon Badge */}
                <View style={styles.filterIconBadge}>
                  <DesignIcon
                    name="calendar"
                    size="sm"
                    color={colorTokens.teal['700']}
                    direction={direction}
                    decorative
                  />
                </View>

                {/* Period label */}
                <StyledText
                  variant="subtitle"
                  numberOfLines={1}
                  style={styles.filterBarText}
                >
                  {periodLabel}
                </StyledText>

                {/* Chevron Down */}
                <DesignIcon
                  name="chevronDown"
                  size="sm"
                  color={colorTokens.ink['900']}
                  direction={direction}
                  decorative
                />
              </Pressable>
            </View>

            <AccountScopeSheet
              visible={accountScopeOpen}
              onDismiss={() => setAccountScopeOpen(false)}
            />
            <MonthlySummary
              period={appliedPeriod}
              selectedAccountId={selectedAccountId}
            />
            <DateRangeSheet
              visible={periodOpen}
              period={draftPeriod}
              onApply={(period) => {
                editFilters({
                  periodStart: period.periodStart,
                  periodEnd: period.periodEnd
                });
                applyFilters();
              }}
              onDismiss={() => {
                cancelFilterSession();
                setPeriodOpen(false);
              }}
            />
            <ScrollView
              ref={quickScopeRailRef}
              testID="transaction-quick-scope-rail"
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.physicalLtr}
              contentContainerStyle={styles.quickScopesScroll}
              onContentSizeChange={() => {
                if (direction === 'rtl') {
                  quickScopeRailRef.current?.scrollToEnd({ animated: false });
                }
              }}
            >
              <View
                testID="transaction-quick-scopes"
                style={[
                  styles.quickScopes,
                  styles.physicalLtr,
                  {
                    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
                  }
                ]}
              >
                {quickScopes.map((scope) => (
                  <QuickScopeChip
                    key={scope.key}
                    label={scope.label}
                    selected={quickSelection?.key === scope.key}
                    onPress={() =>
                      applyQuickScopes(scope.categoryIds, scope.types)
                    }
                  />
                ))}
              </View>
            </ScrollView>
          </View>
          {activeFilters.length ? (
            <View style={styles.activeFilters}>
              {activeFilters.map((filter) => (
                <Pressable
                  key={filter.key}
                  testID="active-filter-chip"
                  accessibilityLabel={`${translate('designSystem.action.remove')} ${filter.label}`}
                  accessibilityRole="button"
                  onPress={() => removeFilter(filter.key)}
                  style={[
                    styles.filterChip,
                    { borderColor: theme.colors.borders.subtle }
                  ]}
                >
                  <StyledText
                    accessible={false}
                    variant="caption"
                    style={{ color: theme.colors.content.primary }}
                  >
                    {filter.label} ×
                  </StyledText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <QuickTransactionFilterMenu
            filters={filters}
            visible={quickFiltersOpen}
            onChange={applyQuickFilter}
            onCategoryPress={() => {
              setQuickFiltersOpen(false);
              setQuickCategoryOpen(true);
            }}
            onDismiss={() => setQuickFiltersOpen(false)}
          />
          {quickCategoryOpen ? (
            <AppSheet
              title={translate('coreFinance.filters.category')}
              visible
              onDismiss={() => setQuickCategoryOpen(false)}
            >
              <View
                testID="transaction-quick-category-picker"
                style={styles.quickCategoryPicker}
              >
                <CategoryFilterPicker
                  selectedIds={filters.categoryIds}
                  onSelect={(category) => {
                    applyQuickFilter({
                      categoryIds: filters.categoryIds.includes(category.id)
                        ? filters.categoryIds.filter((id) => id !== category.id)
                        : [...filters.categoryIds, category.id]
                    });
                    setQuickCategoryOpen(false);
                  }}
                />
              </View>
            </AppSheet>
          ) : null}
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
                : selectedAccountId
                  ? translate('coreFinance.ledger.accountEmpty')
                  : translate('coreFinance.ledger.empty')
            }
          />
        )
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        <View style={styles.footer}>
          {query.isFetchingNextPage ? (
            <StateView
              state="loading"
              title={translate('coreFinance.state.loading')}
            />
          ) : query.isFetchNextPageError ? (
            <StateView
              state="error"
              title={translate('coreFinance.state.error')}
              actionLabel={translate('coreFinance.action.retry')}
              onAction={() => void query.fetchNextPage()}
            />
          ) : null}
          <ProtectedFooter />
        </View>
      }
      renderItem={({ item }) =>
        item.kind === 'header' ? (
          <StyledText
            testID="transaction-date-header"
            variant="subtitle"
            style={styles.sectionHeading}
          >
            {item.label}
          </StyledText>
        ) : (
          <TransactionItem
            item={item.item}
            now={now}
            timeZone={timeZone}
            groupedPosition={item.groupedPosition}
            account={accountById.get(item.item.accountId)}
            category={
              item.item.categoryId
                ? categoryById.get(item.item.categoryId)
                : undefined
            }
          />
        )
      }
    />
  );
}

function MonthlySummary({
  period,
  selectedAccountId
}: {
  period: ReturnType<typeof periodFromRange>;
  selectedAccountId: string | null;
}) {
  const theme = useTheme();
  const largeText = PixelRatio.getFontScale() >= 1.5;
  const direction = usePreferenceStore((state) => state.direction);
  const baseCurrencyCode = usePreferenceStore(
    (state) => state.baseCurrencyCode
  );
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const summaryFilters = useMemo(
    () => applyAccountScope(periodFilters(period), selectedAccountId),
    [period, selectedAccountId]
  );
  const summary = useHomeSummary(baseCurrencyCode, summaryFilters);
  const locale = currentLocale();
  const masked = hideBalances && !revealed;
  const summaryData = summary.data;
  const stacked =
    largeText ||
    Boolean(
      summaryData &&
      !masked &&
      [summaryData.periodIncomeMinor, summaryData.periodExpenseMinor].some(
        (minor) =>
          financialMinorAmountNeedsFullWidth(
            minor,
            summaryData.currencyCode,
            locale
          )
      )
    );

  if (summary.isLoading) {
    return (
      <View testID="transaction-month-summary" style={styles.monthSummary}>
        <View style={[styles.summaryValues, styles.physicalLtr]}>
          <SkeletonBlock width={132} height={48} />
          <SkeletonBlock width={132} height={48} />
        </View>
      </View>
    );
  }

  if (summary.isError) {
    return (
      <View testID="transaction-month-summary" style={styles.monthSummary}>
        <View style={styles.summaryError}>
          <StyledText style={{ color: theme.colors.content.primary }}>
            {translate('coreFinance.ledger.summaryError')}
          </StyledText>
          <Pressable
            accessibilityLabel={translate('coreFinance.action.retry')}
            accessibilityRole="button"
            onPress={() => void summary.refetch()}
            style={styles.summaryRetry}
          >
            <StyledText
              variant="subtitle"
              style={{ color: theme.colors.content.link }}
            >
              {translate('coreFinance.action.retry')}
            </StyledText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (summary.data) {
    return (
      <View testID="transaction-month-summary" style={styles.monthSummary}>
        <View
          testID="transaction-summary-values"
          style={[
            styles.summaryValues,
            styles.physicalLtr,
            {
              flexDirection: stacked
                ? 'column'
                : direction === 'rtl'
                  ? 'row-reverse'
                  : 'row'
            }
          ]}
        >
          <SummaryMetric
            label={translate('coreFinance.home.income')}
            amountMinor={summary.data.periodIncomeMinor}
            currency={summary.data.currencyCode}
            meaning="income"
            masked={masked}
          />
          <SummaryMetric
            label={translate('coreFinance.home.expense')}
            amountMinor={summary.data.periodExpenseMinor}
            currency={summary.data.currencyCode}
            meaning="expense"
            masked={masked}
          />
        </View>
      </View>
    );
  }

  return null;
}

function SummaryMetric({
  label,
  amountMinor,
  currency,
  meaning,
  masked
}: {
  label: string;
  amountMinor: number;
  currency: string;
  meaning: 'income' | 'expense';
  masked: boolean;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const color =
    meaning === 'income'
      ? theme.colors.financial.income
      : theme.colors.financial.expense;
  return (
    <View
      testID={`transaction-summary-${meaning}`}
      style={[
        styles.summaryMetric,
        {
          backgroundColor:
            meaning === 'income'
              ? theme.colors.financial.incomeSurface
              : theme.colors.financial.expenseSurface,
          borderColor: theme.colors.borders.subtle
        }
      ]}
    >
      <View
        testID={`transaction-summary-${meaning}-header`}
        style={[
          styles.summaryMetricHeader,
          styles.physicalLtr,
          {
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
          }
        ]}
      >
        <StyledText
          style={{ color: theme.colors.content.primary, fontSize: 16 }}
        >
          {label}
        </StyledText>
        <View
          style={[
            styles.summaryArrow,
            { backgroundColor: theme.colors.surfaces.card }
          ]}
        >
          <DesignIcon
            name={meaning === 'income' ? 'trendUp' : 'trendDown'}
            label={label}
            color={color}
            decorative
          />
        </View>
      </View>
      <AmountText
        minorUnits={amountMinor}
        currency={currency}
        meaning={meaning}
        color={color}
        masked={masked}
        size="row"
      />
    </View>
  );
}

function ProtectedFooter() {
  const theme = useTheme();
  return (
    <View style={styles.protectedFooter}>
      <DesignIcon
        name="security"
        label={translate('appShell.security.protectedContent')}
        color={theme.colors.content.muted}
        decorative
      />
      <StyledText
        variant="caption"
        style={{ color: theme.colors.content.muted }}
      >
        {translate('appShell.security.protectedContent')}
      </StyledText>
    </View>
  );
}

function TransactionItem({
  item,
  account,
  category,
  now,
  timeZone,
  groupedPosition
}: {
  item: Transaction;
  account?: Account;
  category?: Category;
  now: number;
  timeZone: string;
  groupedPosition: TransactionGroupedPosition;
}) {
  const locale = currentLocale();
  const presentation = projectTransaction(item, locale, account, category);
  const categoryVisualKey =
    category?.iconKey ??
    (presentation.meaning === 'transfer'
      ? 'transfers'
      : presentation.meaning === 'income'
        ? 'salary'
        : null);
  return (
    <TransactionRow
      title={presentation.title}
      category={
        presentation.categoryName ??
        translate('coreFinance.ledger.uncategorized')
      }
      categoryVisualKey={categoryVisualKey}
      date={formatTransactionTimestamp(item.occurredAt, now, locale, timeZone)}
      account={
        presentation.accountName ?? translate('coreFinance.accounts.missing')
      }
      source={translate(presentation.sourceLabelKey as never)}
      meaning={presentation.meaning}
      statusLabel={
        presentation.syncLabelKey
          ? translate(presentation.syncLabelKey as never)
          : undefined
      }
      amountMinor={item.amountMinor}
      currency={item.currencyCode}
      groupedPosition={groupedPosition}
      onPress={() => router.push(`/transactions/${item.id}/edit`)}
    />
  );
}

function ToolbarButton({
  testID,
  icon,
  label,
  onPress
}: {
  testID?: string;
  icon: DesignIconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.iconButton,
        styles.headerIconButton,
        {
          backgroundColor: theme.colors.surfaces.card,
          borderColor: theme.colors.borders.subtle
        }
      ]}
    >
      <DesignIcon
        name={icon}
        label={label}
        color={theme.colors.content.primary}
        decorative
      />
    </Pressable>
  );
}

function QuickScopeChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.quickScopeChip,
        {
          backgroundColor: selected
            ? theme.colors.interactions.primary
            : theme.colors.surfaces.card,
          borderColor: selected
            ? theme.colors.interactions.primary
            : theme.colors.borders.subtle
        }
      ]}
    >
      <StyledText
        accessible={false}
        variant="subtitle"
        style={{
          color: selected
            ? theme.colors.content.inverse
            : theme.colors.content.primary
        }}
      >
        {label}
      </StyledText>
    </Pressable>
  );
}

function QuickTransactionFilterMenu({
  filters,
  visible,
  onChange,
  onCategoryPress,
  onDismiss
}: {
  filters: TransactionFilterSet;
  visible: boolean;
  onChange: (patch: Partial<TransactionFilterSet>) => void;
  onCategoryPress: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const selectedType =
    filters.types.length === 0
      ? null
      : filters.types.length === 1
        ? quickTypeValues.find((type) => type === filters.types[0])
        : undefined;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View
        accessibilityLabel={translate('coreFinance.filters.quick')}
        accessibilityViewIsModal
        style={styles.quickFilterOverlay}
      >
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onDismiss}
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: theme.colors.horizon.scrim }
          ]}
        />
        <View
          testID="transaction-quick-filter-menu"
          accessibilityRole="menu"
          style={[
            styles.quickFilterMenu,
            direction === 'rtl'
              ? styles.quickFilterMenuRtl
              : styles.quickFilterMenuLtr,
            elevation.raised,
            {
              backgroundColor: theme.colors.surfaces.overlay,
              borderColor: theme.colors.borders.default
            }
          ]}
        >
          <QuickFilterHeading label={translate('coreFinance.filters.sort')} />
          {quickSortValues.map((sort) => (
            <QuickFilterOption
              key={sort}
              label={translate(`coreFinance.filters.sort.${sort}` as never)}
              selected={filters.sort === sort}
              onPress={() => onChange({ sort })}
            />
          ))}
          <View
            style={[
              styles.quickFilterDivider,
              { backgroundColor: theme.colors.borders.subtle }
            ]}
          />
          <QuickFilterHeading label={translate('coreFinance.filters.type')} />
          <QuickFilterOption
            label={translate('coreFinance.filters.typeAll')}
            selected={selectedType === null}
            onPress={() => onChange({ types: [] })}
          />
          {quickTypeValues.map((type) => (
            <QuickFilterOption
              key={type}
              label={translate(
                type === 'expense'
                  ? 'coreFinance.filters.type.expenses'
                  : (`coreFinance.type.${type}` as never)
              )}
              selected={selectedType === type}
              onPress={() => onChange({ types: [type] })}
            />
          ))}
          <View
            style={[
              styles.quickFilterDivider,
              { backgroundColor: theme.colors.borders.subtle }
            ]}
          />
          <QuickFilterOption
            label={translate('coreFinance.filters.category')}
            icon="chevronEnd"
            onPress={onCategoryPress}
          />
        </View>
      </View>
    </Modal>
  );
}

function QuickFilterHeading({ label }: { label: string }) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  return (
    <StyledText
      variant="caption"
      style={[
        styles.quickFilterHeading,
        {
          color: theme.colors.content.muted,
          textAlign: direction === 'rtl' ? 'right' : 'left'
        }
      ]}
    >
      {label}
    </StyledText>
  );
}

function QuickFilterOption({
  label,
  selected = false,
  icon,
  onPress
}: {
  label: string;
  selected?: boolean;
  icon?: DesignIconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const displayIcon = selected ? 'check' : icon;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickFilterOption,
        styles.physicalLtr,
        {
          backgroundColor: selected
            ? theme.colors.surfaces.brandSubtle
            : pressed
              ? theme.colors.interactions.quietPressed
              : 'transparent',
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
        }
      ]}
    >
      <StyledText
        accessible={false}
        style={{
          color: selected
            ? theme.colors.interactions.primary
            : theme.colors.content.primary,
          flex: 1,
          textAlign: direction === 'rtl' ? 'right' : 'left'
        }}
      >
        {label}
      </StyledText>
      {displayIcon ? (
        <DesignIcon
          name={displayIcon}
          label={label}
          color={theme.colors.interactions.primary}
          direction={direction}
          decorative
        />
      ) : (
        <View style={styles.quickFilterIconSlot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  physicalLtr: { display: 'flex', writingDirection: 'ltr' },
  content: { padding: spacing.lg, paddingBottom: spacing.lg },
  header: { marginBottom: spacing.md },
  pageHeader: { gap: spacing.md },
  titleActions: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    width: '100%'
  },
  shellTitle: { flex: 1, minWidth: 0 },
  headerActions: {
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.sm
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  headerIconButton: {
    backgroundColor: colorTokens.surface.white,
    borderColor: colorTokens.sand['400'],
    borderRadius: radius.pill,
    borderWidth: 1
  },
  filterBarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%'
  },
  filterBarCard: {
    alignItems: 'center',
    backgroundColor: colorTokens.surface.white,
    borderColor: colorTokens.sand['400'],
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 52,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md
  },
  filterIconBadge: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
    borderRadius: radius.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  filterBarText: {
    color: colorTokens.ink['900'],
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    marginHorizontal: spacing.xs,
    textAlign: 'center'
  },
  filterCardPressed: {
    backgroundColor: colorTokens.sand['200'],
    opacity: 0.8
  },
  monthSummary: { gap: spacing.md, paddingVertical: spacing.xs },
  accountScopeControl: { maxWidth: '100%' },
  periodControl: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg
  },
  summaryValues: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  summaryMetric: {
    borderRadius: radius.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: spacing.sm,
    minHeight: 96,
    minWidth: 0,
    padding: spacing.md
  },
  summaryMetricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  summaryArrow: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  summaryError: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between'
  },
  summaryRetry: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouchTarget,
    minWidth: minTouchTarget
  },
  quickScopesScroll: { flexGrow: 1, paddingVertical: spacing.xs },
  quickScopes: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  quickScopeChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 44,
    paddingHorizontal: 14
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10
  },
  quickFilterOverlay: { flex: 1 },
  quickCategoryPicker: { flexShrink: 1, height: 560 },
  quickFilterMenu: {
    borderRadius: radius.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 320,
    padding: spacing.sm,
    position: 'absolute',
    top: 72,
    width: '78%'
  },
  quickFilterMenuRtl: { left: spacing.lg },
  quickFilterMenuLtr: { right: spacing.lg },
  quickFilterHeading: {
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs
  },
  quickFilterOption: {
    alignItems: 'center',
    borderRadius: radius.control,
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md
  },
  quickFilterIconSlot: { width: 24 },
  quickFilterDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs
  },
  search: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  searchInput: { flex: 1, minHeight: 44, paddingHorizontal: 10 },
  sectionHeading: {
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs
  },
  footer: { gap: spacing.lg },
  protectedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 56,
    paddingTop: spacing.lg
  }
});
