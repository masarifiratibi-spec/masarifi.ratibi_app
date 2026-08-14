import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { useReportsViewState } from '@/state/reports-view-state';
import type { ReportBreakdown, ReportBreakdownItem } from '@/domain/reports';
import { useReport, useReportInput } from './report-queries';

export function ReportDrillDownScreen() {
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
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
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('reports.drillDown.title')}
      </StyledText>
      {report ? (
        <StyledText>{`${report.period.startDate} - ${report.period.endDate}`}</StyledText>
      ) : null}
      {breakdown?.items.map((item: ReportBreakdownItem) => (
        <View key={item.id} style={styles.item}>
          <ActionButton
            label={item.label}
            variant="secondary"
            onPress={() => openItem(item)}
          />
          <StyledText variant="caption">{`${item.transactionIds.length} ${translate('reports.drillDown.recordCount')}`}</StyledText>
          {item.memberLabels?.length ? (
            <StyledText variant="caption">{`${translate('reports.drillDown.otherMembers')}: ${item.memberLabels.join(', ')}`}</StyledText>
          ) : null}
        </View>
      ))}
      <ActionButton
        label={translate('appShell.navigation.back')}
        variant="secondary"
        onPress={() => router.back()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  item: { gap: 6 }
});
