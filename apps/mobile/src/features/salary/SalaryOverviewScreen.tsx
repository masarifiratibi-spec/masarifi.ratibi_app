import React from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import {
  StatusBadge,
  type StatusBadgeStatus
} from '@/design-system/components/StatusBadge';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { radius, spacing, typography } from '@/design-system/tokens';
import type { Calculation } from '@/domain/financial-planning';
import type { MoneyValue } from '@/domain/core-finance';
import { localDateInTimeZone } from '@/domain/financial-period';
import { daysBetween, type LocalDate } from '@/domain/financial-planning';
import {
  PlanningScreen,
  PlanningState,
  planningReason
} from '@/features/financial-planning/PlanningScaffold';
import {
  currentLocale,
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useSalaryOverview } from './salary-queries';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatMoney(
  calculation: Calculation<MoneyValue>,
  hideBalances: boolean,
  revealed: boolean
): string {
  if (calculation.status === 'unavailable') {
    return planningReason(calculation.reason);
  }
  if (hideBalances && !revealed) {
    return translate('planning.state.hidden');
  }
  return formatMinorAmount(
    calculation.value.minorUnits,
    calculation.value.currencyCode,
    currentLocale()
  );
}

function salaryStatusBadge(salaryState: string): {
  status: StatusBadgeStatus;
  key: MessageKey;
} {
  switch (salaryState) {
    case 'early':
      return {
        status: 'success',
        key: 'planning.salary.status.early' as MessageKey
      };
    case 'late':
      return {
        status: 'warning',
        key: 'planning.salary.status.late' as MessageKey
      };
    case 'overdue':
      return {
        status: 'danger',
        key: 'planning.salary.status.overdue' as MessageKey
      };
    case 'unconfigured':
      return {
        status: 'neutral',
        key: 'planning.salary.status.unconfigured' as MessageKey
      };
    default:
      return {
        status: 'success',
        key: 'planning.salary.status.on_time' as MessageKey
      };
  }
}

function formatLocalDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-US-u-nu-latn';
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/* ─── Screen ──────────────────────────────────────────────────────────── */

export function SalaryOverviewScreen() {
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const query = useSalaryOverview(
    localDateInTimeZone(Date.now(), timeZone),
    timeZone
  );
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = currentLocale();
  const largeText = PixelRatio.getFontScale() >= 1.5;

  const data = query.data;
  const money = (calc: Calculation<MoneyValue>) =>
    formatMoney(calc, hideBalances, revealed);

  return (
    <PlanningScreen
      titleKey="planning.salary.title"
      action={{
        labelKey: 'planning.salary.setup',
        onPress: () => router.push('/salary/profile')
      }}
    >
      {query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError || !data ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : data.dataState === 'empty' ? (
        <PlanningState state="empty" />
      ) : (
        <>
          {/* ── Hero: Remaining Salary ── */}
          <FinancialPulse
            accessibilityLabel={`${translate('planning.salary.remaining')}, ${money(data.remaining)}, ${translateDynamic('planning.salary.untilNext', { count: data.daysRemaining })}`}
            scope={translate('planning.salary.remaining')}
            statement={money(data.remaining)}
            supportingValue={translateDynamic('planning.salary.untilNext', {
              count: data.daysRemaining
            })}
          >
            {/* Status badge inside the hero */}
            <View style={styles.heroBadgeRow}>
              <StatusBadge
                status={salaryStatusBadge(data.salaryState).status}
                label={translate(salaryStatusBadge(data.salaryState).key)}
              />
            </View>
          </FinancialPulse>

          {/* ── Cycle Progress ── */}
          {data.startDate && data.projectedNextSalaryDate ? (
            <CycleProgress
              startDate={data.startDate}
              endDate={data.projectedNextSalaryDate}
              today={localDateInTimeZone(Date.now(), timeZone)}
              direction={direction}
              theme={theme}
            />
          ) : null}

          {/* ── Financial Summary ── */}
          <Text
            style={[
              styles.sectionLabel,
              {
                color: theme.colors.content.secondary,
                textAlign: direction === 'rtl' ? 'right' : 'left'
              }
            ]}
          >
            {translate('planning.salary.financialSummary')}
          </Text>

          <View style={largeText ? styles.metricsColumn : styles.metricsRow}>
            <MetricCard
              label={translate('planning.salary.income')}
              value={money(data.income)}
              color={theme.colors.financial.income}
              theme={theme}
              direction={direction}
            />
            <MetricCard
              label={translate('planning.salary.expenses')}
              value={money(data.expenses)}
              color={theme.colors.financial.expense}
              theme={theme}
              direction={direction}
            />
          </View>

          <MetricCard
            label={translate('planning.salary.reserved')}
            value={money(data.reservedObligations)}
            color={theme.colors.status.warning}
            theme={theme}
            direction={direction}
          />

          {/* ── Daily Spending Insight ── */}
          <DailyInsight
            suggestedDaily={data.suggestedDaily}
            hideBalances={hideBalances}
            revealed={revealed}
            theme={theme}
            direction={direction}
          />

          {/* ── Next Salary ── */}
          {data.projectedNextSalaryDate ? (
            <SurfaceCard
              accessibilityLabel={`${translate('planning.salary.nextSalary')}, ${formatLocalDate(data.projectedNextSalaryDate, locale)}, ${translateDynamic('planning.salary.untilNext', { count: data.daysRemaining })}`}
            >
              <Text
                style={[
                  styles.sectionLabel,
                  {
                    color: theme.colors.content.secondary,
                    textAlign: direction === 'rtl' ? 'right' : 'left'
                  }
                ]}
              >
                {translate('planning.salary.nextSalary')}
              </Text>
              <View
                style={[
                  styles.nextRow,
                  {
                    direction: 'ltr',
                    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
                  }
                ]}
              >
                <Text
                  style={[
                    styles.nextDate,
                    {
                      color: theme.colors.content.primary,
                      textAlign: direction === 'rtl' ? 'right' : 'left'
                    }
                  ]}
                >
                  {formatLocalDate(data.projectedNextSalaryDate, locale)}
                </Text>
                <Text
                  style={[
                    styles.nextDays,
                    { color: theme.colors.content.muted }
                  ]}
                >
                  {translateDynamic('planning.salary.untilNext', {
                    count: data.daysRemaining
                  })}
                </Text>
              </View>
            </SurfaceCard>
          ) : null}
        </>
      )}
    </PlanningScreen>
  );
}

/* ─── Cycle Progress ──────────────────────────────────────────────────── */

function CycleProgress({
  startDate,
  endDate,
  today,
  direction,
  theme
}: {
  startDate: LocalDate;
  endDate: LocalDate;
  today: LocalDate;
  direction: 'rtl' | 'ltr';
  theme: ReturnType<typeof useTheme>;
}) {
  const totalDays = Math.max(1, daysBetween(startDate, endDate));
  const elapsed = Math.max(
    0,
    Math.min(totalDays, daysBetween(startDate, today))
  );
  const percent = Math.round((elapsed / totalDays) * 100);

  return (
    <SurfaceCard
      accessibilityLabel={`${translate('planning.salary.cycleProgress')}, ${translateDynamic('planning.salary.cycleDays', { elapsed, total: totalDays })}`}
    >
      <Text
        style={[
          styles.sectionLabel,
          {
            color: theme.colors.content.secondary,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {translate('planning.salary.cycleProgress')}
      </Text>
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: theme.colors.surfaces.inset }
        ]}
      >
        <View
          testID="cycle-progress-fill"
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.interactions.primary,
              width: `${percent}%` as `${number}%`
            }
          ]}
        />
      </View>
      <Text
        style={[
          styles.progressLabel,
          {
            color: theme.colors.content.muted,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {translateDynamic('planning.salary.cycleDays', {
          elapsed,
          total: totalDays
        })}
      </Text>
    </SurfaceCard>
  );
}

/* ─── Metric Card ─────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  color,
  theme,
  direction
}: {
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof useTheme>;
  direction: 'rtl' | 'ltr';
}) {
  return (
    <SurfaceCard
      accessibilityLabel={`${label}, ${value}`}
      style={styles.metricCard}
    >
      <View style={[styles.metricIndicator, { backgroundColor: color }]} />
      <Text
        style={[
          styles.metricLabel,
          {
            color: theme.colors.content.secondary,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricValue,
          {
            color: theme.colors.content.primary,
            textAlign: direction === 'rtl' ? 'right' : 'left',
            writingDirection: 'ltr'
          }
        ]}
      >
        {value}
      </Text>
    </SurfaceCard>
  );
}

/* ─── Daily Insight ───────────────────────────────────────────────────── */

function DailyInsight({
  suggestedDaily,
  hideBalances,
  revealed,
  theme,
  direction
}: {
  suggestedDaily: Calculation<MoneyValue>;
  hideBalances: boolean;
  revealed: boolean;
  theme: ReturnType<typeof useTheme>;
  direction: 'rtl' | 'ltr';
}) {
  const isAvailable = suggestedDaily.status === 'available';
  const displayValue = isAvailable
    ? formatMoney(suggestedDaily, hideBalances, revealed)
    : null;
  const reason = !isAvailable ? planningReason(suggestedDaily.reason) : null;

  return (
    <SurfaceCard
      accessibilityLabel={`${translate('planning.salary.dailyInsight')}, ${displayValue ?? reason}`}
      style={[
        styles.dailyCard,
        {
          backgroundColor: isAvailable
            ? theme.colors.surfaces.brandSubtle
            : theme.colors.surfaces.card,
          borderColor: isAvailable
            ? theme.colors.interactions.primary
            : theme.colors.borders.subtle
        }
      ]}
    >
      <Text
        style={[
          styles.dailyLabel,
          {
            color: isAvailable
              ? theme.colors.interactions.primary
              : theme.colors.content.secondary,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      >
        {translate('planning.salary.dailyInsight')}
      </Text>
      {displayValue ? (
        <Text
          style={[
            styles.dailyAmount,
            {
              color: theme.colors.interactions.primary,
              textAlign: direction === 'rtl' ? 'right' : 'left',
              writingDirection: 'ltr'
            }
          ]}
        >
          {displayValue}
        </Text>
      ) : (
        <Text
          style={[
            styles.dailyReason,
            {
              color: theme.colors.content.muted,
              textAlign: direction === 'rtl' ? 'right' : 'left'
            }
          ]}
        >
          {reason}
        </Text>
      )}
    </SurfaceCard>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  heroBadgeRow: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: spacing.xs
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  metricsColumn: {
    gap: spacing.md
  },
  metricCard: {
    flex: 1,
    gap: spacing.xs
  },
  metricIndicator: {
    borderRadius: 3,
    height: 4,
    width: 28
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 18
  },
  metricValue: {
    ...typography.subtitle,
    fontVariant: ['tabular-nums']
  },
  progressTrack: {
    borderRadius: 4,
    height: 8,
    overflow: 'hidden'
  },
  progressFill: {
    borderRadius: 4,
    height: 8
  },
  progressLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs
  },
  dailyCard: {
    borderWidth: 1,
    gap: spacing.xs,
    borderRadius: radius.overlay
  },
  dailyLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22
  },
  dailyAmount: {
    ...typography.amount,
    fontSize: 32
  },
  dailyReason: {
    fontSize: 14,
    lineHeight: 20
  },
  nextRow: {
    alignItems: 'baseline',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  nextDate: {
    ...typography.subtitle
  },
  nextDays: {
    fontSize: 14,
    lineHeight: 20
  }
});
