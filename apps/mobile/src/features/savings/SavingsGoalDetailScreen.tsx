import React from 'react';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { GoalMovement, SavingsLifecycle } from '@/domain/financial-planning';
import { PlanningMetric, PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatAmount } from '@/utils/format-financial-value';
import { usePlanningMutation, useSavingsGoal } from './savings-queries';

export function SavingsGoalDetailScreen({ goalId = '' }: { goalId?: string }) {
  const query = useSavingsGoal(goalId);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const item = query.data?.goal;
  const lifecycle = usePlanningMutation((status: SavingsLifecycle) =>
    financialPlanningService.setGoalStatus(goalId, item!.version, status, `goal-status:${goalId}:${status}:${Date.now()}`)
  );
  const amount = (minor: number) =>
    hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatAmount(minor / 100, item?.currencyCode ?? 'SAR', currentLocale());
  return (
    <PlanningScreen titleKey="planning.savings.detail">
      {!goalId ? (
        <PlanningState state="empty" />
      ) : query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError || !query.data || !item ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PlanningMetric labelKey="planning.savings.goalTitle" value={item.title} />
          <PlanningMetric labelKey="planning.field.target" value={amount(item.targetMinor)} />
          <PlanningMetric
            labelKey="planning.field.current"
            value={
              query.data.progress.currentMinor.status === 'available'
                ? amount(query.data.progress.currentMinor.value)
                : query.data.progress.currentMinor.reason
            }
          />
          <PlanningMetric labelKey="planning.field.progress" value={query.data.progress.percentage.status === 'available' ? `${query.data.progress.percentage.value}%` : query.data.progress.percentage.reason} />
          <PlanningMetric labelKey="planning.field.status" value={translate(`planning.savings.status.${item.status}` as MessageKey)} />
          <ActionButton label={translate('planning.savings.addMovement')} onPress={() => router.push(`/savings/${goalId}/movement`)} />
          <ActionButton label={translate('planning.action.edit')} onPress={() => router.push(`/savings/${goalId}/edit`)} variant="secondary" />
          {item.status === 'active' ? <ActionButton label={translate('planning.savings.pause')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('paused')} variant="secondary" /> : null}
          {item.status === 'paused' ? <ActionButton label={translate('planning.savings.resume')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('active')} variant="secondary" /> : null}
          {!['completed', 'archived'].includes(item.status) ? <ActionButton label={translate('planning.savings.complete')} loading={lifecycle.isPending} onPress={() => lifecycle.mutate('completed')} variant="secondary" /> : null}
          <StyledText variant="subtitle">{translate('planning.savings.history')}</StyledText>
          {!query.data.movements.length ? <StyledText>{translate('planning.savings.noMovements')}</StyledText> : query.data.movements.map((movement: GoalMovement) => (
            <SurfaceCard key={movement.id}>
              <StyledText>{translate(`planning.savings.movement.${movement.kind}` as MessageKey)}</StyledText>
              <StyledText>{amount(movement.amountMinor)}</StyledText>
              <StyledText>{movement.movementDate}</StyledText>
            </SurfaceCard>
          ))}
        </>
      )}
    </PlanningScreen>
  );
}
