import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import type { FinancialReport } from '@/domain/reports';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';

export function ReportLocalStatus({ report }: { report?: FinancialReport }) {
  const locale = usePreferenceStore((state) => state.locale);
  if (!report?.localData) return null;
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      <StyledText variant="caption">reports.local.basedOn</StyledText>
      {report.localData.empty ? (
        <StyledText variant="caption">reports.local.empty</StyledText>
      ) : null}
      {report.localData.pendingSyncCount ? (
        <StyledText variant="caption">{`${translate('reports.local.pending')}: ${number(report.localData.pendingSyncCount)}`}</StyledText>
      ) : null}
      {report.localData.excludedCount ? (
        <StyledText variant="caption">{`${translate('reports.local.excluded')}: ${number(report.localData.excludedCount)}`}</StyledText>
      ) : null}
      {report.completenessReasons.includes('missing_rate') ? (
        <StyledText variant="caption">reports.local.missingRates</StyledText>
      ) : null}
    </View>
  );
}
