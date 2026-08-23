import React from 'react';

import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { emptyTransactionFilters, type Category, type Transaction } from '@/domain/core-finance';
import { useCategories, useTransactions } from '@/features/core-finance/core-finance-queries';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useBudgetById } from './budget-queries';

export function BudgetTransactionsScreen({ budgetId = '' }: { budgetId?: string }) {
  const query = useBudgetById(budgetId);
  const categories = useCategories(true);
  const periodKey = query.data?.budget.periodKey ?? '1970-01';
  const periodStart = Date.parse(`${periodKey}-01T00:00:00Z`);
  const periodEndDate = new Date(periodStart);
  periodEndDate.setUTCMonth(periodEndDate.getUTCMonth() + 1);
  const transactions = useTransactions({
    ...emptyTransactionFilters,
    periodStart,
    periodEnd: periodEndDate.getTime() - 1,
    categoryIds: query.data?.categories.map((item: { categoryId: string }) => item.categoryId) ?? []
  });
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const amount = (minor: number) =>
    hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatMinorAmount(minor, query.data?.budget.currencyCode ?? 'SAR', currentLocale());
  const categoryName = (id: string | null) => {
    const item = categories.data?.find((category: Category) => category.id === id);
    return currentLocale() === 'ar' ? item?.labelAr : item?.labelEn;
  };

  return (
    <PlanningScreen titleKey="planning.budgets.transactions">
      {!budgetId ? (
        <PlanningState state="empty" />
      ) : query.isLoading || transactions.isLoading || categories.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError || transactions.isError || categories.isError || !query.data ? (
        <PlanningState state="error" onRetry={() => { void query.refetch(); void transactions.refetch(); void categories.refetch(); }} />
      ) : (
        <>
          <PlanningMetric labelKey="planning.budget.period" value={query.data.budget.periodKey} />
          <PlanningMetric labelKey="planning.field.remaining" value={query.data.progress.remainingMinor.status === 'available' ? amount(query.data.progress.remainingMinor.value) : query.data.progress.remainingMinor.reason} />
          <PlanningMetric labelKey="planning.field.progress" value={query.data.progress.percentage.status === 'available' ? `${query.data.progress.percentage.value}%` : query.data.progress.state} />
          {!transactions.data?.items.length ? <PlanningState state="empty" /> : transactions.data.items.map((transaction: Transaction) => (
            <SurfaceCard key={transaction.id}>
              <StyledText variant="subtitle">{transaction.title}</StyledText>
              <StyledText>{categoryName(transaction.categoryId) ?? translate('coreFinance.ledger.uncategorized')}</StyledText>
              <StyledText>{amount(transaction.amountMinor)}</StyledText>
            </SurfaceCard>
          ))}
        </>
      )}
    </PlanningScreen>
  );
}
