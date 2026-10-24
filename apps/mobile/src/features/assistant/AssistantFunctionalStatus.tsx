import React from 'react';
import { View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { translateDynamic as t } from '@/localization/i18n';
import type { AssistantService } from '@/services/contracts/assistant-notifications-service';

export type AssistantAvailability = Awaited<
  ReturnType<AssistantService['getAvailability']>
>;
export type QuestionOperation = NonNullable<
  Awaited<ReturnType<NonNullable<AssistantService['readQuestionOperation']>>>
>;

/** Capability diagnostics remain internal; they never create a screen/card. */
export function assistantCapabilityState(availability?: AssistantAvailability) {
  return (
    availability?.capabilities ?? {
      directRead: 'unknown',
      provider: 'unknown',
      actions: 'unknown'
    }
  );
}

/** Compact recovery in the existing chat footer. The question itself uses the normal chat bubble. */
export function AssistantQuestionRecovery({
  operation,
  loading,
  error,
  onCheck,
  onRetry
}: {
  operation?: QuestionOperation | null;
  loading?: boolean;
  error?: boolean;
  onCheck: () => void;
  onRetry?: () => void;
}) {
  if (
    !error &&
    (!operation || ['completed', 'failed'].includes(operation.phase))
  )
    return null;
  const state =
    operation?.phase === 'accepted'
      ? 'pending'
      : operation?.phase === 'failed'
        ? 'failed'
        : 'unknown';
  return (
    <View testID="assistant-inline-recovery">
      <StyledText variant="caption" accessibilityLiveRegion="polite">
        {t(
          error
            ? 'assistant.operation.checkFailed'
            : `assistant.operation.state.${state}`
        )}
      </StyledText>
      <StyledText
        variant="caption"
        accessibilityRole="button"
        disabled={loading}
        onPress={loading ? undefined : onCheck}
      >
        {t('assistant.operation.check')}
      </StyledText>
      {operation &&
      ['prepared', 'created'].includes(operation.phase) &&
      onRetry ? (
        <StyledText
          variant="caption"
          accessibilityRole="button"
          disabled={loading}
          onPress={loading ? undefined : onRetry}
        >
          {t('assistant.operation.retrySame')}
        </StyledText>
      ) : null}
    </View>
  );
}
