import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { translate, translateDynamic } from '@/localization/i18n';
import type { useVoiceBatches } from './useVoiceBatches';
import { voiceBatchResultSchema } from '@/services/live/voice-batch-api-service';

export function VoiceBatchStatus({
  batches,
  showProgress = true,
  showEmpty = true
}: {
  batches: ReturnType<typeof useVoiceBatches>;
  showProgress?: boolean;
  showEmpty?: boolean;
}) {
  const checked = voiceBatchResultSchema.safeParse(batches.latest);
  const result = checked.success ? checked.data : null;
  const finished =
    result && ['completed', 'failed', 'cancelled'].includes(result.status);
  const notSaved =
    result?.outcomes?.filter((event) =>
      ['skipped', 'execution_failed', 'cancelled'].includes(event.status)
    ).length ?? 0;
  const saved = finished && !result.analysis && result.addedCount > 0;
  const partial = saved && (notSaved > 0 || result.status !== 'completed');
  return (
    <View testID="voice-batch-status" accessibilityLiveRegion="polite">
      {partial ? (
        <StyledText>
          {notSaved > 0
            ? translateDynamic('voice.batch.partial', {
                saved: result.addedCount,
                failed: notSaved
              })
            : translateDynamic('voice.batch.partialUnknown', {
                count: result.addedCount
              })}
        </StyledText>
      ) : null}
      {showProgress && batches.processing ? (
        <StyledText>{translate('voice.state.processing')}</StyledText>
      ) : null}
      {showEmpty &&
      result?.status === 'completed' &&
      result.addedCount === 0 &&
      !result.analysis ? (
        <StyledText>{translate('voice.batch.empty')}</StyledText>
      ) : null}
      {(!saved && result?.status === 'failed') || batches.localFailure ? (
        <StyledText>
          {translate(
            batches.localFailureCode === 'voice_canary_restricted'
              ? 'voice.batch.restricted'
              : 'voice.batch.failed'
          )}
        </StyledText>
      ) : null}
    </View>
  );
}
