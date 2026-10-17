import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { StyledText } from '@/components/StyledText';
import { spacing } from '@/design-system/tokens';
import { emptyTransactionFilters } from '@/domain/core-finance';
import { translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function FirstVoicePrompt({ hasRecordedTransactions }: { hasRecordedTransactions: boolean }) {
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  const history = useQuery({
    queryKey: ['core-finance', 'transactions', 'has-any-recorded'],
    enabled: !hasRecordedTransactions,
    queryFn: async ({ signal }) => {
      const page = await coreFinanceService.listTransactions(emptyTransactionFilters, null, 1, signal);
      return page.items.length > 0 || page.nextCursor !== null;
    }
  });
  if (hasRecordedTransactions || !history.isSuccess || history.data) return null;
  return (
    <StyledText testID="home-first-voice-prompt" style={{
      color: theme.colors.content.link, paddingVertical: spacing.md,
      textAlign: 'center', writingDirection: direction
    }}>
      {translate('coreFinance.home.firstVoicePrompt')}
    </StyledText>
  );
}
