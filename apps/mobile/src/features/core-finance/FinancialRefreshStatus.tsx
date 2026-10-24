import React from 'react';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';

export function FinancialRefreshStatus({
  query
}: {
  query: { dataUpdatedAt: number; isFetching: boolean; isError: boolean };
}) {
  if (!query.dataUpdatedAt || (!query.isFetching && !query.isError))
    return null;
  return (
    <StyledText variant="caption" accessibilityLiveRegion="polite">
      {translate(
        query.isError
          ? 'coreFinance.state.refreshFailedSnapshot'
          : 'coreFinance.state.refreshingSnapshot'
      )}
    </StyledText>
  );
}
