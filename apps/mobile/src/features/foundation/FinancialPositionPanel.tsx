/**
 * FinancialPositionPanel — proves User Story 1.
 *
 * Communicates a clear current financial position for populated, empty, and
 * partial data. Amounts and statuses get priority over decoration (FR-013).
 * Never shows a misleading total when data is missing. Every amount uses the
 * shared formatter (FR-023).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { currentLocale, translate } from '@/localization/i18n';
import { formatAmount } from '@/utils/format-financial-value';
import type { FinancialSummary } from '@/services/contracts/foundation-service';

export interface FinancialPositionPanelProps {
  summary: FinancialSummary;
}

export function FinancialPositionPanel({
  summary
}: FinancialPositionPanelProps) {
  const theme = useTheme();

  if (isEmpty(summary)) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        <StyledText
          variant="title"
          accessibilityLabel={translate('position.empty.title')}
        >
          {translate('position.empty.title')}
        </StyledText>
        <StyledText
          variant="subtitle"
          accessibilityLabel={translate('position.empty.action')}
        >
          {translate('position.empty.action')}
        </StyledText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <StyledText variant="title">{translate('position.title')}</StyledText>

      <AmountRow
        labelKey="position.balance"
        amount={summary.balance.originalAmount}
        currencyCode={summary.balance.currencyCode}
        estimated={summary.balance.isEstimated}
      />
      <AmountRow
        labelKey="position.spending"
        amount={summary.recentSpending.originalAmount}
        currencyCode={summary.recentSpending.currencyCode}
        estimated={summary.recentSpending.isEstimated}
      />
      {summary.nextObligation && (
        <AmountRow
          labelKey="position.nextObligation"
          amount={summary.nextObligation.amount.originalAmount}
          currencyCode={summary.nextObligation.amount.currencyCode}
          estimated={summary.nextObligation.amount.isEstimated}
        />
      )}

      {summary.reviewItemCount > 0 && (
        <StyledText
          variant="body"
          accessibilityLabel={`${translate('position.reviewItems')}: ${summary.reviewItemCount}`}
        >
          {translate('position.reviewItems')}: {summary.reviewItemCount}
        </StyledText>
      )}

      {!summary.dataComplete && (
        <View style={styles.notice}>
          <StyledText
            variant="body"
            accessibilityLabel={translate('position.partial.title')}
          >
            {translate('position.partial.title')}
          </StyledText>
          <StyledText
            variant="subtitle"
            accessibilityLabel={translate('position.partial.action')}
          >
            {translate('position.partial.action')}
          </StyledText>
        </View>
      )}

      <StyledText variant="subtitle" style={styles.nextAction}>
        {translate('position.nextAction')}
      </StyledText>
    </View>
  );
}

function isEmpty(summary: FinancialSummary): boolean {
  return (
    summary.balance.originalAmount === 0 &&
    summary.recentSpending.originalAmount === 0 &&
    summary.nextObligation === null &&
    summary.reviewItemCount === 0
  );
}

interface AmountRowProps {
  labelKey:
    'position.balance' | 'position.spending' | 'position.nextObligation';
  amount: number;
  currencyCode: string;
  estimated: boolean;
}

function AmountRow({
  labelKey,
  amount,
  currencyCode,
  estimated
}: AmountRowProps) {
  const theme = useTheme();
  const formatted = formatAmount(amount, currencyCode, currentLocale());
  const label = translate(labelKey);
  const display = estimated
    ? `${formatted} (${translate('position.estimated')})`
    : formatted;
  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      <StyledText variant="body">{label}</StyledText>
      <StyledText
        variant="amount"
        accessibilityLabel={`${label} ${display}`}
        style={{ color: theme.colors.financialNegative }}
      >
        {display}
      </StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    gap: 12
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  notice: {
    gap: 4,
    marginTop: 4
  },
  nextAction: {
    marginTop: 8
  }
});
