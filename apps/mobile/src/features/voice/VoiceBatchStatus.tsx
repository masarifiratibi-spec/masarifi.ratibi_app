import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import type { useVoiceBatches } from './useVoiceBatches';

export function VoiceBatchStatus({
  batches,
  showProgress = true
}: {
  batches: ReturnType<typeof useVoiceBatches>;
  showProgress?: boolean;
}) {
  const result = batches.latest;
  return (
    <View testID="voice-batch-status" accessibilityLiveRegion="polite">
      {showProgress && (batches.processing || batches.uncertain) ? (
        <StyledText>{translate('voice.state.processing')}</StyledText>
      ) : null}
      {result?.status === 'completed' &&
      result.addedCount === 0 &&
      !result.analysis ? (
        <StyledText>{translate('voice.batch.empty')}</StyledText>
      ) : null}
      {result?.status === 'failed' || batches.localFailure ? (
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
