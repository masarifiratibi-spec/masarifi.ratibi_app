import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HomeSummary as HomeSummaryValue } from '@/domain/core-finance';
import { BalanceCard } from '@/design-system/components/financial/BalanceCard';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { translate } from '@/localization/i18n';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { useTheme } from '@/state/theme-context';

export function HomeSummary({ summary }: { summary: HomeSummaryValue }) {
  const { revealed, reveal } = useSensitiveVisibility();
  const hidden = !revealed;
  return (
    <View style={styles.stack}>
      <BalanceCard
        title={translate('coreFinance.home.total')}
        value={summary.totalBalanceMinor / 100}
        currency={summary.currencyCode}
        hidden={hidden}
        trend={
          summary.isEstimated
            ? translate('coreFinance.home.estimated')
            : undefined
        }
        actionLabel={hidden ? translate('coreFinance.home.reveal') : undefined}
        onAction={reveal}
      />
      <SurfaceCard>
        <View style={styles.metrics}>
          <Metric
            label={translate('coreFinance.home.income')}
            value={summary.periodIncomeMinor}
            hidden={hidden}
          />
          <Metric
            label={translate('coreFinance.home.expense')}
            value={summary.periodExpenseMinor}
            hidden={hidden}
          />
          <Metric
            label={translate('coreFinance.home.accounts')}
            value={summary.activeAccountCount}
            count
          />
        </View>
      </SurfaceCard>
      {summary.excludedAccountIds.length ? (
        <StatusBadge
          status="warning"
          label={translate('coreFinance.home.excluded')}
        />
      ) : null}
      {summary.reviewCount ? (
        <StatusBadge
          status="warning"
          label={`${translate('coreFinance.home.review')} ${summary.reviewCount}`}
        />
      ) : null}
      {summary.pendingSyncCount ? (
        <StatusBadge
          status="sync"
          label={`${translate('coreFinance.home.pendingSync')} ${summary.pendingSyncCount}`}
        />
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  hidden = false,
  count = false
}: {
  label: string;
  value: number;
  hidden?: boolean;
  count?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityLabel={`${label} ${hidden ? translate('designSystem.privacy.hidden') : value}`}
    >
      <Text style={{ color: theme.colors.textSecondary }}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
        {hidden && !count
          ? '••••'
          : count
            ? value
            : (value / 100).toLocaleString('en-US')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metric: { flexGrow: 1, gap: 4, minWidth: 88 },
  value: { fontSize: 18, fontWeight: '700' }
});
