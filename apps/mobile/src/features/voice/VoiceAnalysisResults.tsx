import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StyledText } from '@/components/StyledText';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { translate } from '@/localization/i18n';
import { formatFinancialDisplayValue } from '@/utils/format-financial-value';
import type { VoiceBatchResult } from '@/services/live/voice-batch-api-service';
import { voiceAnalysisKey } from './voice-analysis-query';

// Receipt-only results are deliberately separate from ledger queries and cards.
export function VoiceAnalysisResults() {
  const owner = useAppShellStore((state) =>
    state.session?.status === 'authenticated' ? state.session.userId : null
  );
  const locale = usePreferenceStore((state) => state.locale);
  const { revealed } = useSensitiveVisibility();
  const { data = [] } = useQuery<VoiceBatchResult[]>({
    queryKey: voiceAnalysisKey(owner),
    queryFn: async () => [],
    enabled: false,
    staleTime: Infinity
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const expiry = Math.min(
      ...data
        .filter(
          (row) =>
            row.analysis && Date.parse(row.analysis.expiresAt) > Date.now()
        )
        .map((row) => Date.parse(row.analysis!.expiresAt))
    );
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(1, expiry - Date.now() + 1)
    );
    return () => clearTimeout(timer);
  }, [data, now]);
  const visible = owner
    ? data.filter(
        (row) =>
          row.status === 'completed' &&
          row.analysis &&
          Date.parse(row.analysis.expiresAt) > Date.now()
      )
    : [];
  if (!visible.length) return null;
  return (
    <View testID="voice-analysis-results" accessibilityLiveRegion="polite">
      <StyledText>{translate('voice.analysis.unsaved')}</StyledText>
      {visible.flatMap((row) =>
        row.analysis!.events.map((event) => {
          const value = formatFinancialDisplayValue({
            minorUnits: event.amountMinor,
            currencyCode: event.currency,
            locale,
            sign: event.kind === 'expense' ? 'negative' : 'positive',
            state: revealed ? 'confirmed' : 'hidden'
          });
          return (
            <View
              key={`${row.sessionId}:${event.ordinal}`}
              testID={`voice-analysis-event-${row.sessionId}-${event.ordinal}`}
            >
              <StyledText>{event.title}</StyledText>
              <StyledText>
                {translate(
                  event.kind === 'expense'
                    ? 'voice.analysis.expense'
                    : 'voice.analysis.income'
                )}
              </StyledText>
              <StyledText accessibilityLabel={value.accessibilityLabel}>
                {value.text}
              </StyledText>
            </View>
          );
        })
      )}
      <StyledText>{translate('voice.analysis.noPosting')}</StyledText>
    </View>
  );
}
