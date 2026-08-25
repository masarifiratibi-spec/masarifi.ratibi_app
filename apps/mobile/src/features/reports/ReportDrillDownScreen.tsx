import React from 'react';
import {
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { router } from 'expo-router';

import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppIcon, IconBadge } from '@/design-system/icons';
import {
  borderWidth,
  controlHeight,
  minTouchTarget,
  radius,
  spacing,
  typography
} from '@/design-system/tokens';
import { currentLocale, translate, translateDynamic } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { useReportsViewState } from '@/state/reports-view-state';
import { useTheme } from '@/state/theme-context';
import type { ReportBreakdown, ReportBreakdownItem } from '@/domain/reports';
import type { MoneyValue } from '@/domain/core-finance';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useReport, useReportInput } from './report-queries';
import {
  reportBreakdownItemLabel,
  reportBreakdownMemberLabels
} from './report-labels';

export function ReportDrillDownScreen() {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { selectedKind, anchorDate, returnContext, setReturnContext } =
    useReportsViewState();
  const editFilters = useCoreFinanceViewState((state) => state.editFilters);
  const applyFilters = useCoreFinanceViewState((state) => state.applyFilters);
  const input = useReportInput(selectedKind, anchorDate, currencyCode);
  const report = useReport(input).data;
  const breakdown =
    report?.breakdowns.find(
      (candidate: ReportBreakdown) =>
        candidate.dimension === returnContext?.dimension
    ) ?? report?.breakdowns[0];

  const openItem = (item: ReportBreakdownItem) => {
    setReturnContext(item.drillDown.returnContext);
    if (item.drillDown.kind === 'obligation') {
      router.push(`/obligations/${item.drillDown.obligationId}`);
      return;
    }
    editFilters(item.drillDown.filters);
    applyFilters();
    router.push({
      pathname: '/(tabs)/transactions',
      params: { returnTo: '/(tabs)/reports' }
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.stack}
    >
      <SurfaceCard style={styles.headerCard}>
        <View
          style={[
            styles.headerRow,
            {
              direction: 'ltr',
              flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
            }
          ]}
        >
          <IconBadge
            icon="reports"
            label={translate('reports.drillDown.title')}
            tone="primary"
            size="md"
            decorative
          />
          <View style={styles.headerCopy}>
            <StyledText
              variant="title"
              style={{ textAlign: direction === 'rtl' ? 'right' : 'left' }}
            >
              {translate('reports.drillDown.title')}
            </StyledText>
            {report ? (
              <Text
                style={[
                  styles.periodText,
                  {
                    color: theme.colors.textSecondary,
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                    writingDirection: 'ltr'
                  }
                ]}
              >
                {`${report.period.startDate} - ${report.period.endDate}`}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('appShell.navigation.back')}
            hitSlop={8}
            onPress={() => router.back()}
            style={[styles.backButton, { borderColor: theme.colors.border }]}
          >
            <AppIcon
              name="back"
              label={translate('appShell.navigation.back')}
              size="sm"
              color={theme.colors.primary}
              direction={direction}
              decorative
            />
          </Pressable>
        </View>
      </SurfaceCard>

      {breakdown ? (
        <SurfaceCard style={styles.listCard}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.textPrimary,
                textAlign: direction === 'rtl' ? 'right' : 'left'
              }
            ]}
          >
            {translateDynamic(breakdown.questionKey)}
          </Text>
          {breakdown.items.map((item: ReportBreakdownItem, index) => (
            <DrillDownRow
              key={item.id}
              direction={direction}
              hidden={hideBalances}
              index={index}
              breakdownItem={item}
              onPress={() => openItem(item)}
            />
          ))}
        </SurfaceCard>
      ) : (
        <StyledText>{translate('reports.state.loading')}</StyledText>
      )}
    </ScrollView>
  );
}

function DrillDownRow({
  direction,
  hidden,
  index,
  breakdownItem,
  onPress
}: {
  direction: 'ltr' | 'rtl';
  hidden: boolean;
  index: number;
  breakdownItem: ReportBreakdownItem;
  onPress: () => void;
}) {
  const theme = useTheme();
  const largeText = PixelRatio.getFontScale() >= 1.5;
  const label = reportBreakdownItemLabel(breakdownItem);
  const memberLabels = reportBreakdownMemberLabels(breakdownItem);
  const valueText = hidden
    ? translate('designSystem.privacy.hidden')
    : formatReportMoney(breakdownItem.value.value);
  return (
    <Pressable
      testID={`report-drill-down-row-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${valueText}, ${breakdownItem.transactionIds.length} ${translate('reports.drillDown.recordCount')}`}
      onPress={onPress}
      style={[
        styles.row,
        {
          alignItems: largeText ? 'stretch' : 'center',
          borderColor: theme.colors.borders.subtle,
          flexDirection: largeText
            ? 'column'
            : direction === 'rtl'
              ? 'row-reverse'
              : 'row'
        }
      ]}
    >
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: theme.colors.surfaceMuted }
        ]}
      >
        <Text style={[styles.rankText, { color: theme.colors.primary }]}>
          {index + 1}
        </Text>
      </View>
      <View style={styles.rowCopy}>
        <Text
          numberOfLines={largeText ? undefined : 1}
          style={[
            styles.rowTitle,
            {
              color: theme.colors.textPrimary,
              textAlign: direction === 'rtl' ? 'right' : 'left'
            }
          ]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={
            largeText ? undefined : memberLabels.length ? 2 : 1
          }
          style={[
            styles.rowMeta,
            {
              color: theme.colors.textSecondary,
              textAlign: direction === 'rtl' ? 'right' : 'left'
            }
          ]}
        >
          {memberLabels.length
            ? `${translate('reports.drillDown.otherMembers')}: ${memberLabels.join(', ')}`
            : `${breakdownItem.transactionIds.length} ${translate('reports.drillDown.recordCount')}`}
        </Text>
      </View>
      <View
        testID={`report-drill-down-amount-${index}`}
        style={[
          styles.amountCopy,
          largeText
            ? { alignItems: direction === 'rtl' ? 'flex-start' : 'flex-end' }
            : null
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.amountText,
            {
              color: theme.colors.financial.expense,
              textAlign: direction === 'rtl' ? 'left' : 'right'
            }
          ]}
        >
          {valueText}
        </Text>
      </View>
      <AppIcon
        name="chevronEnd"
        label={label}
        size="sm"
        color={theme.colors.textSecondary}
        direction={direction}
        decorative
      />
    </Pressable>
  );
}

function formatReportMoney(amount: MoneyValue | null): string {
  return amount
    ? formatMinorAmount(amount.minorUnits, amount.currencyCode, currentLocale())
    : translate('reports.state.unavailable');
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  headerCard: {
    borderRadius: radius.card,
    gap: spacing.md
  },
  headerRow: {
    alignItems: 'center',
    gap: spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  periodText: {
    fontSize: 14,
    lineHeight: 22
  },
  backButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: borderWidth.default,
    height: minTouchTarget,
    justifyContent: 'center',
    width: minTouchTarget
  },
  listCard: {
    borderRadius: radius.card,
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: spacing.xs
  },
  row: {
    ...layoutDirectionStyle('ltr'),
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    minHeight: controlHeight.lg,
    paddingVertical: spacing.md
  },
  rankBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24
  },
  rowMeta: {
    fontSize: 13,
    lineHeight: 20
  },
  amountCopy: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    minWidth: 108
  },
  amountText: {
    ...typography.amount,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    writingDirection: 'ltr'
  }
});
