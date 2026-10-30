import React, { useState } from 'react';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { ActionButton } from '@/design-system/components/ActionButton';
import { DesignIcon } from '@/design-system/icons';
import { safeMinorSum } from '@/domain/core-finance';
import type { Calculation } from '@/domain/financial-planning';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import {
  currentLocale,
  translate,
  translateDynamic
} from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useSavingsGoals, useSavingsListProgress } from './savings-queries';
import {
  SavingsHeader,
  SavingsProgressBar,
  SavingsSegments,
  savingsDate,
  savingsStyles as styles
} from './SavingsVisuals';

type Filter = 'all' | 'active' | 'completed';
const value = (calculation?: Calculation<number>) =>
  calculation?.status === 'available' ? calculation.value : null;

export function SavingsGoalsScreen() {
  const query = useSavingsGoals();
  const goals = query.data ?? [];
  const summaries = useSavingsListProgress(goals);
  const [filter, setFilter] = useState<Filter>('all');
  const hideBalances = usePreferenceStore((s) => s.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const theme = useTheme();
  const hidden = hideBalances && !revealed;
  const money = (minor: number | null, currency: string) =>
    hidden
      ? translate('planning.state.hidden')
      : minor === null
        ? translate('reports.state.unavailable')
        : `\u2066${formatMinorAmount(minor, currency, currentLocale())}\u2069`;
  const active = goals.filter((goal) => goal.status === 'active');
  const visible = goals.filter((goal) =>
    filter === 'all' ? true : goal.status === filter
  );
  const totals = (field: 'currentMinor' | 'remainingMinor') => {
    if (hidden) return translate('planning.state.hidden');
    if (!active.length) return '—';
    return [...new Set(active.map((goal) => goal.currencyCode))]
      .map((currency) => {
        let sum: number | null = 0;
        for (const goal of active.filter(
          (goal) => goal.currencyCode === currency
        )) {
          const minor = value(summaries.progress.get(goal.id)?.[field]);
          sum =
            sum === null || minor === null ? null : safeMinorSum(sum, minor);
        }
        return money(sum, currency);
      })
      .join('\n');
  };
  return (
    <PlanningScreen
      titleKey="planning.savings.title"
      hideHeader
      backgroundColor={theme.colors.surfaces.page}
    >
      <SavingsHeader
        title={translate('planning.savings.title')}
        label={translate('planning.savings.totalSaved')}
        amount={totals('currentMinor')}
        action={{
          icon: 'add',
          label: translate('planning.savings.new'),
          onPress: () => router.push('/savings/new')
        }}
      >
        <View style={styles.detailsRow}>
          <StyledText
            style={{ color: theme.colors.textInverse }}
            accessibilityLabel={`${translate('planning.savings.activeGoals')}, ${query.data ? active.length : '—'}`}
          >
            {translate('planning.savings.activeGoals')} ·{' '}
            {query.data ? active.length : '—'}
          </StyledText>
          <StyledText style={{ color: theme.colors.textInverse }}>
            {translate('planning.savings.remainingAll')} ·{' '}
            {totals('remainingMinor')}
          </StyledText>
        </View>
      </SavingsHeader>
      <FinancialRefreshStatus query={query} />
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError && !hasReadableSnapshot(query) ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : !goals.length ? (
        <PlanningState state="empty" />
      ) : (
        <>
          <SavingsSegments
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: translate('planning.savings.filterAll') },
              {
                value: 'active',
                label: translate('planning.savings.filterActive')
              },
              {
                value: 'completed',
                label: translate('planning.savings.filterCompleted')
              }
            ]}
          />
          <StyledText variant="subtitle">
            {translate('planning.savings.yourGoals')}
          </StyledText>
          {!visible.length ? (
            <StyledText>{translate('planning.savings.emptyFilter')}</StyledText>
          ) : null}
          {visible.map((goal) => {
            const progress = summaries.progress.get(goal.id);
            const current = money(
              value(progress?.currentMinor),
              goal.currencyCode
            );
            const target = money(goal.targetMinor, goal.currencyCode);
            return (
              <SurfaceCard key={goal.id} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${goal.title}, ${current}, ${target}`}
                  onPress={() => router.push(`/savings/${goal.id}`)}
                >
                  <View style={styles.row}>
                    <DesignIcon
                      name={goal.emergencyFund ? 'security' : 'goal'}
                      decorative
                      color={theme.colors.primary}
                      size="lg"
                    />
                    <View style={styles.grow}>
                      <StyledText variant="subtitle">{goal.title}</StyledText>
                      <StyledText variant="caption">
                        {savingsDate(goal.targetDate)}
                      </StyledText>
                    </View>
                    <DesignIcon name="chevronEnd" decorative />
                  </View>
                </Pressable>
                <StyledText>
                  {translateDynamic('planning.savings.progressOf', {
                    current,
                    target
                  })}
                </StyledText>
                <SavingsProgressBar
                  percentage={value(progress?.percentage)}
                  hidden={hidden}
                />
              </SurfaceCard>
            );
          })}
          {summaries.isError ? (
            <ActionButton
              variant="quiet"
              label={translate('planning.action.retry')}
              onPress={() => void summaries.retry()}
            />
          ) : null}
        </>
      )}
    </PlanningScreen>
  );
}
