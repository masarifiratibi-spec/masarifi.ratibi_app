import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate, translateDynamic } from '@/localization/i18n';
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
      {showProgress && batches.processing && !batches.uncertain ? (
        <StyledText>{translate('voice.state.processing')}</StyledText>
      ) : null}
      {batches.uncertain ? (
        <>
          {showProgress ? (
            <StyledText>{translate('voice.batch.checking')}</StyledText>
          ) : null}
          <ActionButton
            label="voice.batch.checkResult"
            onPress={() => void batches.recover()}
          />
        </>
      ) : null}
      {result && result.addedCount > 0 ? (
        <StyledText>
          {translateDynamic('voice.batch.added', { count: result.addedCount })}
        </StyledText>
      ) : null}
      {result?.status === 'completed' && result.addedCount === 0 ? (
        <StyledText>{translate('voice.batch.empty')}</StyledText>
      ) : null}
      {result?.status === 'failed' || batches.localFailure ? (
        <StyledText>{translate('voice.batch.failed')}</StyledText>
      ) : null}
      {batches.cancelIds.map((id) => (
        <ActionButton
          key={id}
          label="voice.action.cancel"
          variant="secondary"
          onPress={() => void batches.cancel(id)}
        />
      ))}
    </View>
  );
}
