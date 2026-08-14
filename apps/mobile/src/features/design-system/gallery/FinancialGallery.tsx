import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AccountCard } from '@/design-system/components/financial/AccountCard';
import { BalanceCard } from '@/design-system/components/financial/BalanceCard';
import { BudgetCard } from '@/design-system/components/financial/BudgetCard';
import { FinancialBadge, type FinancialMeaning } from '@/design-system/components/financial/FinancialPrimitives';
import { ReportMetricCard } from '@/design-system/components/financial/ReportMetricCard';
import { SavingsGoalCard } from '@/design-system/components/financial/SavingsGoalCard';
import { TransactionRow } from '@/design-system/components/financial/TransactionRow';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

const FINANCIAL_MEANINGS: readonly FinancialMeaning[] = [
  'income',
  'expense',
  'transfer',
  'refund',
  'savings',
  'debt'
];

export function FinancialGallery() {
  const theme = useTheme();
  const currency = 'EGP';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <StyledText variant="title">
        {translate('designSystem.gallery.financial')}
      </StyledText>

      <View style={styles.row}>
        {FINANCIAL_MEANINGS.map((meaning) => (
          <FinancialBadge
            key={meaning}
            meaning={meaning}
            label={translate(`designSystem.financial.${meaning}`)}
          />
        ))}
      </View>

      <View style={styles.stack}>
        <BalanceCard
          title={translate('position.balance')}
          value={4200}
          currency={currency}
          trend={translate('position.estimated')}
        />
        <AccountCard
          name={translate('position.title')}
          type={translate('scenario.populated')}
          maskedIdentifier="•• 2481"
          balance={1800}
          currency={currency}
          statusLabel={translate('designSystem.state.success')}
        />
        <TransactionRow
          title={translate('scenario.populated')}
          category={translate('designSystem.financial.expense')}
          date="6 Aug"
          account={translate('position.balance')}
          source={translate('trust.source.manual')}
          meaning="expense"
          statusLabel={translate('designSystem.state.review')}
          amount={85}
          currency={currency}
        />
        <BudgetCard
          title={translate('designSystem.financial.expense')}
          spent={750}
          limit={1000}
          currency={currency}
        />
        <SavingsGoalCard
          title={translate('designSystem.financial.savings')}
          saved={3000}
          target={5000}
          currency={currency}
        />
        <ReportMetricCard
          title={translate('designSystem.chart.lineSummary')}
          value={2200}
          currency={currency}
        />
      </View>

      <StatusBadge
        status="warning"
        label={translate('designSystem.state.review')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    gap: 16,
    padding: 16
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  stack: {
    gap: 12
  }
});
