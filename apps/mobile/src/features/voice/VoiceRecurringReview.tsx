import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import type { VoiceRecurringSuggestion } from '@/domain/voice-capture';
import { translate } from '@/localization/i18n';

const choices: readonly [VoiceRecurringSuggestion['kind'], string][] = [
  ['one_time', 'voice.recurring.oneTime'],
  ['recurring', 'voice.recurring.recurring'],
  ['existing_obligation', 'voice.recurring.existing'],
  ['new_obligation', 'voice.recurring.new']
];

export function VoiceRecurringReview({
  value,
  onChange
}: {
  value: VoiceRecurringSuggestion;
  onChange(value: VoiceRecurringSuggestion): void;
}) {
  const labels = choices.map(([, label]) => translate(label as never));
  const selected = choices.find(([kind]) => kind === value.kind);
  return (
    <View style={styles.stack}>
      <StyledText variant="subtitle">{translate('voice.recurring.title')}</StyledText>
      <ChipSelector
        options={labels}
        selected={
          value.confirmed
            ? [translate((selected ?? choices[0])[1] as never)]
            : []
        }
        onToggle={(label) => {
          const index = labels.indexOf(label);
          if (index >= 0)
            onChange({ ...value, kind: choices[index][0], confirmed: true });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: 8 } });
