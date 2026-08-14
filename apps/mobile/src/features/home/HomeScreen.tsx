import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { StateView } from '@/design-system/components/feedback/StateView';
import type { HomeSummary as HomeSummaryValue } from '@/domain/core-finance';
import { useHomeSummary } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { HomeQuickActions } from './HomeQuickActions';
import { HomeSummary } from './HomeSummary';

export function HomeScreen({
  summary,
  footer
}: {
  summary?: HomeSummaryValue;
  footer?: React.ReactNode;
}) {
  const query = useHomeSummary('SAR');
  const value = summary ?? query.data;
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('coreFinance.home.title')}
      </StyledText>
      {!summary && query.isLoading ? (
        <StateView
          state="loading"
          title={translate('coreFinance.state.loading')}
        />
      ) : !summary && query.isError ? (
        <StateView
          state="error"
          title={translate('coreFinance.state.error')}
          actionLabel={translate('coreFinance.action.retry')}
          onAction={() => void query.refetch()}
        />
      ) : value?.dataState === 'empty' ? (
        <StateView state="empty" title={translate('coreFinance.home.empty')} />
      ) : value ? (
        <HomeSummary summary={value} />
      ) : null}
      <StyledText variant="subtitle">
        {translate('coreFinance.home.quickActions')}
      </StyledText>
      <HomeQuickActions />
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16, padding: 16, paddingBottom: 32 }
});
