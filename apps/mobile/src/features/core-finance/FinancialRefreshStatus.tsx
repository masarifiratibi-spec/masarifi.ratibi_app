import React from 'react';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { isAuthoritativeReadDenial } from '@/services/read-snapshot';

export function FinancialRefreshStatus({
  query
}: {
  query: {
    dataUpdatedAt: number;
    isFetching: boolean;
    isError: boolean;
    error?: unknown;
  };
}) {
  if (
    isAuthoritativeReadDenial(query.error) ||
    !query.dataUpdatedAt ||
    (!query.isFetching && !query.isError)
  )
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
