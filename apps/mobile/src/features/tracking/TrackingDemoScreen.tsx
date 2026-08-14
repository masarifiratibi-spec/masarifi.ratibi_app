import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import type { AutomaticFeedback as AutomaticFeedbackValue } from '@/domain/automatic-tracking';
import { automaticTrackingScenarios } from '@/services/mocks/automatic-tracking-fixtures';
import { AutomaticFeedback } from './AutomaticFeedback';
import { useProcessMockEvent } from './useAutomaticTracking';
import { translate } from '@/localization/i18n';

export function TrackingDemoScreen() {
  const mutation = useProcessMockEvent();
  const [feedback, setFeedback] = useState<AutomaticFeedbackValue | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">{translate('tracking.demo.title')}</StyledText>
      <AutomaticFeedback feedback={feedback} onDone={() => setFeedback(null)} />
      {automaticTrackingScenarios.map((scenario) => (
        <SurfaceCard key={scenario.sourceFingerprint}>
          <View style={styles.stack}>
            <StyledText variant="subtitle">
              {scenario.merchant ?? scenario.eventType}
            </StyledText>
            <StyledText>
              {translate('tracking.demo.confidence').replace(
                '{{value}}',
                String(scenario.confidenceBasisPoints / 100)
              )}
            </StyledText>
            <ActionButton
              label={translate('tracking.action.process')}
              loading={mutation.isPending}
              onPress={async () => {
                const result = await mutation.mutateAsync(scenario);
                setFeedback(result.feedback);
              }}
            />
          </View>
        </SurfaceCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
