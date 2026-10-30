import React, { useState } from 'react';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { View } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type {
  SavingsLifecycle,
  Calculation
} from '@/domain/financial-planning';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import {
  PlanningScreen,
  PlanningState,
  planningReason
} from '@/features/financial-planning/PlanningScaffold';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { usePlanningMutation, useSavingsGoal } from './savings-queries';
import {
  SavingsHeader,
  SavingsProgressBar,
  savingsDate,
  savingsStyles as styles
} from './SavingsVisuals';

export function SavingsGoalDetailScreen({ goalId = '' }: { goalId?: string }) {
  const query = useSavingsGoal(goalId);
  const accounts = useAccounts();
  const item = query.data?.goal;
  const theme = useTheme();
  const hideBalances = usePreferenceStore((s) => s.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const hidden = hideBalances && !revealed;
  const [moreOpen, setMoreOpen] = useState(false);
  const lifecycle = usePlanningMutation((status: SavingsLifecycle) =>
    financialPlanningService.setGoalStatus(
      goalId,
      item!.version,
      status,
      `goal-status:${goalId}:${status}:${Date.now()}`
    )
  );
  const amount = (minor: number) =>
    hidden
      ? translate('planning.state.hidden')
      : `\u2066${formatMinorAmount(minor, item?.currencyCode ?? 'SAR', currentLocale())}\u2069`;
  const calculated = (calculation?: Calculation<number>) =>
    hidden
      ? translate('planning.state.hidden')
      : calculation?.status === 'available'
        ? amount(calculation.value)
        : calculation?.status === 'unavailable'
          ? planningReason(calculation.reason)
          : translate('reports.state.unavailable');
  const percentage = query.data?.progress.percentage;
  return (
    <PlanningScreen
      titleKey="planning.savings.detail"
      hideHeader
      backgroundColor={theme.colors.surfaces.page}
    >
      <FinancialRefreshStatus query={query} />
      {!goalId ? (
        <PlanningState state="empty" />
      ) : query.isLoading ? (
        <PlanningState state="loading" />
      ) : !query.data || !item || !hasReadableSnapshot(query) ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : (
        <>
          <SavingsHeader
            title={translate('planning.savings.detail')}
            description={item.title}
            label={translate('planning.savings.savedSoFar')}
            amount={calculated(query.data.progress.currentMinor)}
            action={{
              icon: 'more',
              label: translate('planning.savings.moreActions'),
              onPress: () => setMoreOpen(!moreOpen)
            }}
          >
            <SavingsProgressBar
              percentage={
                percentage?.status === 'available' ? percentage.value : null
              }
              hidden={hidden}
              inverse
            />
            <View style={styles.detailsRow}>
              <StyledText style={{ color: theme.colors.textInverse }}>
                {translate('planning.field.target')} ·{' '}
                {amount(item.targetMinor)}
              </StyledText>
              <StyledText style={{ color: theme.colors.textInverse }}>
                {translate('planning.field.remaining')} ·{' '}
                {calculated(query.data.progress.remainingMinor)}
              </StyledText>
            </View>
          </SavingsHeader>
          {moreOpen ? (
            <SurfaceCard style={styles.card}>
              {item.status === 'active' ? (
                <ActionButton
                  label={translate('planning.savings.pause')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('paused')}
                  variant="quiet"
                />
              ) : null}
              {item.status === 'paused' ? (
                <ActionButton
                  label={translate('planning.savings.resume')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('active')}
                  variant="quiet"
                />
              ) : null}
              {!['completed', 'archived'].includes(item.status) ? (
                <ActionButton
                  label={translate('planning.savings.complete')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('completed')}
                  variant="quiet"
                />
              ) : null}
            </SurfaceCard>
          ) : null}
          {lifecycle.isError ? (
            <StyledText accessibilityRole="alert">
              {translate('planning.state.error')}
            </StyledText>
          ) : null}
          <SurfaceCard style={styles.card}>
            <Detail
              label={translate('planning.savings.targetDate')}
              value={savingsDate(item.targetDate)}
            />
            <Detail
              label={translate('planning.savings.linkedAccount')}
              value={
                accounts.data?.find((a) => a.id === item.linkedAccountId)
                  ?.name ?? translate('reports.state.unavailable')
              }
            />
            <Detail
              label={translate('planning.field.status')}
              value={translate(
                `planning.savings.status.${item.status}` as MessageKey
              )}
            />
          </SurfaceCard>
          <SurfaceCard style={styles.card}>
            <StyledText variant="subtitle">
              {translate('planning.savings.history')}
            </StyledText>
            {!query.data.movements.length ? (
              <StyledText>
                {translate('planning.savings.noMovements')}
              </StyledText>
            ) : (
              query.data.movements.map((movement) => {
                const directional =
                  movement.status !== 'reversed' &&
                  ['contribution', 'withdrawal', 'correction'].includes(
                    movement.kind
                  );
                const negative =
                  movement.amountMinor < 0 || movement.kind === 'withdrawal';
                return (
                  <View
                    key={movement.id}
                    style={[
                      styles.detailsRow,
                      styles.separator,
                      { borderColor: theme.colors.border }
                    ]}
                  >
                    <View>
                      <StyledText>
                        {translate(
                          `planning.savings.movement.${movement.kind}` as MessageKey
                        )}
                      </StyledText>
                      <StyledText variant="caption">
                        {savingsDate(movement.movementDate)}
                      </StyledText>
                      {movement.status === 'reversed' ? (
                        <StyledText variant="caption">
                          {translate('coreFinance.status.reversed')}
                        </StyledText>
                      ) : null}
                    </View>
                    <StyledText
                      style={[
                        styles.money,
                        {
                          color: !directional
                            ? theme.colors.content.primary
                            : negative
                              ? theme.colors.financialNegative
                              : theme.colors.financialPositive
                        }
                      ]}
                    >
                      {hidden
                        ? translate('planning.state.hidden')
                        : `${directional ? (negative ? '−' : '+') : ''}${amount(Math.abs(movement.amountMinor))}`}
                    </StyledText>
                  </View>
                );
              })
            )}
          </SurfaceCard>
          <View style={styles.footer}>
            <ActionButton
              label={translate('planning.savings.addMovement')}
              onPress={() => router.push(`/savings/${goalId}/movement`)}
              style={styles.button}
            />
            <ActionButton
              label={translate('planning.action.edit')}
              onPress={() => router.push(`/savings/${goalId}/edit`)}
              variant="quiet"
            />
          </View>
        </>
      )}
    </PlanningScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailsRow}>
      <StyledText variant="caption">{label}</StyledText>
      <StyledText variant="subtitle" style={{ flexShrink: 1 }}>
        {value}
      </StyledText>
    </View>
  );
}
