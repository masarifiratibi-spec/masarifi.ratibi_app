import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { VOICE_MAX_DURATION_MS, type VoiceSessionState } from '@/domain/voice-capture';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function VoiceRecorder({
  state,
  durationMs,
  onStart,
  onStop,
  onCancel
}: {
  state: VoiceSessionState;
  durationMs: number;
  onStart(): void;
  onStop(): void;
  onCancel(): void;
}) {
  const theme = useTheme();
  const recording = state === 'recording';
  const elapsedSeconds = Math.floor(durationMs / 1000);
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(
    elapsedSeconds % 60
  ).padStart(2, '0')}`;
  return (
    <SurfaceCard
      accessibilityLiveRegion="polite"
      testID="voice-recorder"
      style={styles.stack}
    >
      <StyledText variant="subtitle">
        {translate(recording ? 'voice.record.active' : 'voice.record.ready')}
      </StyledText>
      <StyledText variant="amount">
        {elapsed}
      </StyledText>
      <View accessibilityElementsHidden style={styles.waveform}>
        {Array.from({ length: 12 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: recording ? theme.colors.primary : theme.colors.border,
                height: 8 + (index % 4) * 6
              }
            ]}
          />
        ))}
      </View>
      {durationMs >= VOICE_MAX_DURATION_MS - 10_000 ? (
        <StyledText>{translate('voice.record.warning')}</StyledText>
      ) : null}
      {recording ? (
        <>
          <ActionButton
            label={translate('voice.record.stop')}
            onPress={onStop}
            style={styles.stop}
          />
          <ActionButton
            label={translate('voice.record.cancel')}
            variant="quiet"
            onPress={onCancel}
          />
        </>
      ) : (
        <ActionButton label={translate('voice.record.start')} onPress={onStart} />
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 12,
    maxWidth: 320,
    width: '100%'
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    height: 40,
    justifyContent: 'center'
  },
  bar: { borderRadius: 2, width: 4 },
  stop: { borderRadius: 44, height: 88, width: 88 }
});
