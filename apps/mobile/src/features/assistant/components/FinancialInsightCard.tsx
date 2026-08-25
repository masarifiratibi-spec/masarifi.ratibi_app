import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';

export interface FinancialInsightCardProps {
  title?: string;
  totalMinor?: number;
  totalCurrency?: string;
  categoryName?: string;
  categoryMinor?: number;
  categoryEmoji?: string;
  trendPercentage?: number;
  trendDirection?: 'down' | 'up';
  onPressDetails?: () => void;
  testID?: string;
}

export function FinancialInsightCard({
  title = 'ملخص الشهر',
  totalMinor,
  totalCurrency = 'SAR',
  categoryName,
  categoryMinor,
  categoryEmoji = '🛍️',
  trendPercentage,
  trendDirection = 'down',
  onPressDetails,
  testID = 'financial-insight-card'
}: FinancialInsightCardProps) {
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const isRtl = direction === 'rtl';

  const formatDisplayAmount = (minor?: number) => {
    if (typeof minor !== 'number') return null;
    if (hideBalances) return `•••• ${totalCurrency}`;
    return formatMinorAmount(minor, totalCurrency, locale);
  };

  const formattedTotal = formatDisplayAmount(totalMinor);
  const formattedCategory = formatDisplayAmount(categoryMinor);

  return (
    <View testID={testID} style={styles.container}>
      {/* Header Title */}
      <StyledText variant="subtitle" style={styles.title}>
        {title}
      </StyledText>

      {/* 3 Metric Columns / Tiles */}
      <View
        style={[
          styles.metricsRow,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {/* Metric 1: Trend percentage if present */}
        {typeof trendPercentage === 'number' && (
          <View style={styles.metricBox}>
            <View style={styles.trendBadge}>
              <Text style={styles.trendArrow}>
                {trendDirection === 'down' ? '↓' : '↑'}
              </Text>
              <StyledText style={styles.trendValue}>
                {`%${trendPercentage}`}
              </StyledText>
            </View>
            <StyledText style={styles.metricCaption}>
              {trendDirection === 'down'
                ? translate('assistant.insight.lessThan')
                : translate('assistant.insight.moreThan')}
            </StyledText>
          </View>
        )}

        {/* Metric 2: Top Category if present */}
        {categoryName && (
          <View style={styles.metricBox}>
            <View
              style={[
                styles.categoryHeader,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
              <StyledText style={styles.categoryLabel}>
                {categoryName}
              </StyledText>
            </View>
            {formattedCategory && (
              <StyledText style={styles.metricCaption}>
                {formattedCategory}
              </StyledText>
            )}
          </View>
        )}

        {/* Metric 3: Total Expenses if present */}
        {formattedTotal && (
          <View style={styles.metricBox}>
            <View
              style={[
                styles.categoryHeader,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Text style={styles.categoryEmoji}>💳</Text>
              <StyledText style={styles.categoryLabel}>
                {translate('assistant.insight.total')}
              </StyledText>
            </View>
            <StyledText style={styles.totalAmount}>
              {formattedTotal}
            </StyledText>
          </View>
        )}
      </View>

      {/* Action Link Footer */}
      {onPressDetails && (
        <Pressable
          testID="financial-insight-details-button"
          onPress={onPressDetails}
          style={({ pressed }) => [
            styles.footerAction,
            pressed && styles.footerActionPressed
          ]}
          accessibilityRole="button"
        >
          <StyledText style={styles.footerActionText}>
            {`${translate('assistant.insight.details')} >`}
          </StyledText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorTokens.raw["F8FAF9"],
    borderColor: colorTokens.raw["D7E1DC"],
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm
  },
  title: {
    color: colorTokens.raw["10231F"],
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  metricsRow: {
    alignItems: 'center',
    ...layoutDirectionStyle('ltr'),
    gap: spacing.xs,
    justifyContent: 'space-between'
  },
  metricBox: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["FFFFFF"],
    borderColor: colorTokens.raw["EEF3F0"],
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  trendBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2
  },
  trendArrow: {
    color: colorTokens.raw["0D684A"],
    fontSize: 13,
    fontWeight: '700'
  },
  trendValue: {
    color: colorTokens.raw["0D684A"],
    fontSize: 13,
    fontWeight: '700'
  },
  metricCaption: {
    color: colorTokens.raw["657872"],
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center'
  },
  categoryHeader: {
    alignItems: 'center',
    gap: 3
  },
  categoryEmoji: {
    fontSize: 12
  },
  categoryLabel: {
    color: colorTokens.raw["10231F"],
    fontSize: 11,
    fontWeight: '600'
  },
  totalAmount: {
    color: colorTokens.raw["0D684A"],
    fontSize: 12,
    fontWeight: '700'
  },
  footerAction: {
    alignItems: 'center',
    borderTopColor: colorTokens.raw["EEF3F0"],
    borderTopWidth: 1,
    justifyContent: 'center',
    paddingTop: spacing.xs
  },
  footerActionPressed: {
    opacity: 0.6
  },
  footerActionText: {
    color: colorTokens.raw["103F37"],
    fontSize: 12,
    fontWeight: '600'
  }
});
