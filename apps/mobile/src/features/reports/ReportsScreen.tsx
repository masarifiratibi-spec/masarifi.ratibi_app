import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { AccessibleChartFrame } from '@/design-system/charts/AccessibleChartFrame';
import { DonutChart } from '@/design-system/charts/DonutChart';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { ComparisonIndicator } from '@/design-system/components/financial/ComparisonIndicator';
import { ReportMetricCard } from '@/design-system/components/financial/ReportMetricCard';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useReportsViewState } from '@/state/reports-view-state';
import { useTheme } from '@/state/theme-context';
import type {
  FinancialReport,
  ReportBreakdownItem,
  ReportInsight,
  ReportValue
} from '@/domain/reports';
import type { MoneyValue } from '@/domain/core-finance';
import { formatAmount } from '@/utils/format-financial-value';
import { useReport, useReportInput } from './report-queries';
import { reportStateTitle } from './report-state';

const periods = ['monthly', 'three_months', 'half_year', 'annual'] as const;

export function ReportsScreen() {
  const theme = useTheme();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const {
    selectedKind,
    anchorDate,
    setPeriod,
    setReturnContext,
    setScrollOffset
  } = useReportsViewState();
  const initialScrollOffset = React.useRef(
    useReportsViewState.getState().scrollOffset
  ).current;
  const input = useReportInput(selectedKind, anchorDate, currencyCode);
  const query = useReport(input);
  const report = query.data;

  return (
    <ScrollView
      contentContainerStyle={styles.stack}
      contentOffset={{ x: 0, y: initialScrollOffset }}
      onMomentumScrollEnd={(event) =>
        setScrollOffset(event.nativeEvent.contentOffset.y)
      }
      onScrollEndDrag={(event) =>
        setScrollOffset(event.nativeEvent.contentOffset.y)
      }
    >
      <View style={styles.header}>
        <StyledText variant="title">
          {translate('appShell.tabs.reports')}
        </StyledText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('reports.action.schedule')}
          onPress={() => router.push('/reports/schedule')}
          style={[styles.smallButton, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.primary }}>
            {translate('reports.action.schedule')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.periodRow}>
        {periods.map((period) => (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityLabel={translate(`reports.period.${period}`)}
            accessibilityState={{ selected: selectedKind === period }}
            onPress={() => setPeriod(period, anchorDate)}
            style={[
              styles.period,
              {
                borderColor:
                  selectedKind === period
                    ? theme.colors.primary
                    : theme.colors.border
              }
            ]}
          >
            <Text style={{ color: theme.colors.textPrimary }}>
              {translate(`reports.period.${period}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {report ? (
        <>
          <StyledText>{`${report.period.startDate} - ${report.period.endDate}`}</StyledText>
          <StyledText variant="caption">
            {reportStateTitle(report.dataState)}
          </StyledText>
          <View style={styles.grid}>
            <ReportMetricCard
              title={translate('reports.metric.income')}
              value={value(report.summary.income)}
              currency={currencyCode}
              meaning="income"
              masked={hideBalances}
              comparison={comparison(report.summary.comparisons[0])}
            />
            <ReportMetricCard
              title={translate('reports.metric.expense')}
              value={value(report.summary.expense)}
              currency={currencyCode}
              meaning="expense"
              masked={hideBalances}
              comparison={comparison(report.summary.comparisons[1])}
            />
            <ReportMetricCard
              title={translate('reports.metric.netCashFlow')}
              value={value(report.summary.netCashFlow)}
              currency={currencyCode}
              meaning={
                value(report.summary.netCashFlow) >= 0 ? 'income' : 'expense'
              }
              masked={hideBalances}
              comparison={comparison(report.summary.comparisons[2])}
            />
            <ReportMetricCard
              title={translate('reports.metric.obligations')}
              value={value(report.summary.obligationPayments)}
              currency={currencyCode}
              meaning="debt"
              masked={hideBalances}
            />
          </View>
          <ReportFacts report={report} hidden={hideBalances} />
          <StyledText variant="subtitle">
            {translate('reports.insight.title')}
          </StyledText>
          <View style={styles.grid}>
            {report.insights.map((insight: ReportInsight) => (
              <InsightCard
                key={insight.kind}
                insight={insight}
                hidden={hideBalances}
                currencyCode={currencyCode}
              />
            ))}
          </View>
          {report.summary.comparisons[0] ? (
            <SurfaceCard>
              <StyledText>{`${translate('reports.comparison.currentPeriod')}: ${report.summary.comparisons[0].currentRange}`}</StyledText>
              <StyledText>{`${translate('reports.comparison.previousPeriod')}: ${report.summary.comparisons[0].previousRange}`}</StyledText>
            </SurfaceCard>
          ) : null}
          <AccessibleChartFrame
            question={translate('reports.chart.categories')}
            summary={categorySummary(
              report.breakdowns[0]?.items ?? [],
              currencyCode,
              hideBalances
            )}
            empty={!report.breakdowns[0]?.items.length}
            drillDownLabel={translate('reports.action.drillDown')}
            onDrillDown={() => {
              setReturnContext({
                reportKey: report.key,
                period: report.period,
                dimension: 'category'
              });
              router.push('/reports/drill-down');
            }}
          >
            <DonutChart
              hidden={hideBalances}
              data={
                report.breakdowns[0]?.items.map(
                  (item: ReportBreakdownItem) => ({
                    id: item.id,
                    label: item.label,
                    value: value(item.value),
                    memberIds: item.memberIds
                  })
                ) ?? []
              }
            />
          </AccessibleChartFrame>
          <AssistantActions reportKey={report.key} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('reports.action.preview')}
            onPress={() => router.push('/reports/preview')}
            style={[styles.action, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={{ color: theme.colors.textInverse }}>
              {translate('reports.action.preview')}
            </Text>
          </Pressable>
        </>
      ) : (
        <StyledText>
          {query.isError
            ? translate('reports.state.error')
            : translate('reports.state.loading')}
        </StyledText>
      )}
    </ScrollView>
  );
}

function ReportFacts({
  report,
  hidden
}: {
  report: FinancialReport;
  hidden: boolean;
}) {
  const savingsRate = report.summary.savingsRateBasisPoints.value;
  const category = report.summary.largestCategory.value;
  const transaction = report.summary.largestTransaction.value;
  return (
    <View style={styles.grid}>
      <FactCard
        label={translate('reports.metric.savingsRate')}
        value={
          savingsRate === null
            ? translate('reports.state.unavailable')
            : hidden
              ? translate('designSystem.privacy.hidden')
              : `${Math.round(savingsRate / 100)}%`
        }
      />
      <FactCard
        label={translate('reports.metric.largestCategory')}
        value={
          !category
            ? translate('reports.state.unavailable')
            : hidden
              ? translate('designSystem.privacy.hidden')
              : `${category.label}: ${formatReportMoney(category.value)}`
        }
      />
      <FactCard
        label={translate('reports.metric.largestTransaction')}
        value={
          !transaction
            ? translate('reports.state.unavailable')
            : hidden
              ? translate('designSystem.privacy.hidden')
              : `${transaction.title}: ${formatMoney(transaction.amount)}`
        }
      />
    </View>
  );
}

function FactCard({
  label,
  value: factValue
}: {
  label: string;
  value: string;
}) {
  return (
    <SurfaceCard>
      <StyledText variant="subtitle">{label}</StyledText>
      <StyledText>{factValue}</StyledText>
    </SurfaceCard>
  );
}

function InsightCard({
  insight,
  hidden,
  currencyCode
}: {
  insight: ReportInsight;
  hidden: boolean;
  currencyCode: string;
}) {
  const label = translate(`reports.insight.${insight.kind}` as MessageKey);
  const insightValue = insight.value.value;
  const display = hidden
    ? translate('designSystem.privacy.hidden')
    : typeof insightValue === 'number'
      ? String(insightValue)
      : insightValue
        ? formatMoney(insightValue)
        : translate('reports.state.unavailable');
  return <FactCard label={label} value={display || currencyCode} />;
}

function AssistantActions({ reportKey }: { reportKey: string }) {
  const actions = [
    ['explain', 'reports.action.explain'],
    ['spending_increase', 'reports.action.spendingIncrease'],
    ['find_savings', 'reports.action.findSavings'],
    ['compare', 'reports.action.compare'],
    ['create_plan', 'reports.action.createPlan']
  ] as const;
  return (
    <View style={styles.grid}>
      {actions.map(([action, labelKey]) => (
        <ActionButton
          key={action}
          label={translate(labelKey)}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/assistant',
              params: { action, reportKey, returnTo: '/(tabs)/reports' }
            })
          }
        />
      ))}
    </View>
  );
}

function categorySummary(
  items: readonly ReportBreakdownItem[],
  currencyCode: string,
  hidden: boolean
): string {
  if (!items.length) return translate('designSystem.chart.empty');
  return items
    .map(
      (item) =>
        `${item.label}: ${hidden ? translate('designSystem.privacy.hidden') : formatReportMoney(item.value, currencyCode)}`
    )
    .join(', ');
}

function formatReportMoney(
  reportValue: ReportValue<MoneyValue>,
  fallbackCurrency?: string
): string {
  return reportValue.value
    ? formatMoney(reportValue.value)
    : `${translate('reports.state.unavailable')} ${fallbackCurrency ?? ''}`.trim();
}

function formatMoney(amount: MoneyValue): string {
  return formatAmount(
    amount.minorUnits / 100,
    amount.currencyCode,
    currentLocale()
  );
}

function value(reportValue: { value: { minorUnits: number } | null }): number {
  return reportValue.value?.minorUnits ?? 0;
}

function comparison(
  item:
    | {
        direction: 'higher' | 'lower' | 'unchanged';
        percentageBasisPoints: number | null;
      }
    | undefined
) {
  if (!item) return null;
  return (
    <ComparisonIndicator
      direction={item.direction === 'unchanged' ? 'neutral' : item.direction}
      label={
        item.percentageBasisPoints === null
          ? translate('reports.comparison.new')
          : `${Math.round(item.percentageBasisPoints / 100)}%`
      }
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16, padding: 16 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  period: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10
  },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12
  },
  grid: { gap: 10 },
  action: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48
  }
});
