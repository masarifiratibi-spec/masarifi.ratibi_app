import React from 'react';
import { router } from 'expo-router';

import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import type { SavingsGoal } from '@/domain/financial-planning';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useSavingsGoals } from './savings-queries';

export function SavingsGoalsScreen() {
  const query = useSavingsGoals();
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const amount = (goal: SavingsGoal) =>
    hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatMinorAmount(goal.targetMinor, goal.currencyCode, currentLocale());
  return (
    <PlanningScreen titleKey="planning.savings.title" action={{ labelKey: 'planning.savings.new', onPress: () => router.push('/savings/new') }}>
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <PlanningState state="empty" />
      ) : (
        <>
          <FinancialPulse
            accessibilityLabel={`${translate('planning.savings.activeGoals')}, ${query.data.filter((goal: SavingsGoal) => goal.status === 'active').length}`}
            scope={translate('planning.savings.activeGoals')}
            statement={String(query.data.filter((goal: SavingsGoal) => goal.status === 'active').length)}
            supportingValue={translate('planning.savings.title')}
          />
          <GroupedList label={translate('planning.savings.title')}>
            {query.data.map((goal: SavingsGoal) => (
              <NavigationRow
                key={goal.id}
                label={goal.title}
                description={translate(`planning.savings.status.${goal.status}` as MessageKey)}
                value={amount(goal)}
                onPress={() => router.push(`/savings/${goal.id}`)}
              />
            ))}
          </GroupedList>
        </>
      )}
    </PlanningScreen>
  );
}
