import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { SavingsGoal } from '@/domain/financial-planning';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatAmount } from '@/utils/format-financial-value';
import { useSavingsGoals } from './savings-queries';

export function SavingsGoalsScreen() {
  const query = useSavingsGoals();
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const amount = (goal: SavingsGoal) =>
    hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatAmount(goal.targetMinor / 100, goal.currencyCode, currentLocale());
  return (
    <PlanningScreen titleKey="planning.savings.title" action={{ labelKey: 'planning.savings.new', onPress: () => router.push('/savings/new') }}>
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <PlanningState state="empty" />
      ) : (
        query.data.map((goal: SavingsGoal) => (
          <SurfaceCard key={goal.id}>
            <View>
              <StyledText variant="subtitle">{goal.title}</StyledText>
              <StyledText>{translate('planning.field.target')}: {amount(goal)}</StyledText>
              <StyledText>{translate(`planning.savings.status.${goal.status}` as MessageKey)}</StyledText>
              <ActionButton label={translate('planning.action.open')} onPress={() => router.push(`/savings/${goal.id}`)} variant="secondary" />
            </View>
          </SurfaceCard>
        ))
      )}
    </PlanningScreen>
  );
}
