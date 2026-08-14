import React from 'react';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatAmount } from '@/utils/format-financial-value';
import { useBudget, usePlanningMutation } from './budget-queries';

export function BudgetOverviewScreen() {
  const query = useBudget(new Date().toISOString().slice(0, 7));
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const item = query.data?.budget;
  const lifecycle = usePlanningMutation((status: 'active' | 'paused' | 'deleted') =>
    status === 'deleted'
      ? financialPlanningService.deleteBudget(item!.id, item!.version, `budget-delete:${item!.id}:${Date.now()}`)
      : financialPlanningService.setBudgetStatus(item!.id, item!.version, status, `budget-status:${item!.id}:${status}:${Date.now()}`)
  );
  const amount = (minor: number) =>
    hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatAmount(minor / 100, item?.currencyCode ?? 'SAR', currentLocale());

  return (
    <PlanningScreen titleKey="planning.budgets.title" action={{ labelKey: 'planning.budgets.new', onPress: () => router.push('/budgets/new') }}>
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : !query.data || !item ? (
        <PlanningState state="empty" />
      ) : (
        <>
          <PlanningMetric labelKey="planning.budget.period" value={item.periodKey} />
          <PlanningMetric
            labelKey="planning.field.remaining"
            value={query.data.progress.remainingMinor.status === 'available' ? amount(query.data.progress.remainingMinor.value) : query.data.progress.remainingMinor.reason}
          />
          <PlanningMetric
            labelKey="planning.field.progress"
            value={query.data.progress.percentage.status === 'available' ? `${query.data.progress.percentage.value}%` : query.data.progress.state}
          />
          <PlanningMetric labelKey="planning.field.status" value={translate(`planning.budget.status.${item.status}` as MessageKey)} />
          <ActionButton label={translate('planning.budgets.transactions')} onPress={() => router.push(`/budgets/transactions/${item.id}`)} />
          {query.data.categories.length > 1 ? <ActionButton label={translate('planning.budgets.allocation')} onPress={() => router.push(`/budgets/allocation/${item.id}`)} variant="secondary" /> : null}
          <ActionButton label={translate('planning.action.edit')} onPress={() => router.push(`/budgets/edit/${item.id}`)} variant="secondary" />
          {item.status === 'active' ? <ActionButton label={translate('planning.budget.pause')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('paused')} variant="secondary" /> : null}
          {item.status === 'paused' ? <ActionButton label={translate('planning.budget.resume')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('active')} variant="secondary" /> : null}
          <ActionButton label={translate('planning.budget.delete')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('deleted')} variant="secondary" />
        </>
      )}
    </PlanningScreen>
  );
}
