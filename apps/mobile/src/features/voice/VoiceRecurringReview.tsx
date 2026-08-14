import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { RadioCard } from '@/design-system/components/forms/SelectionControls';
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
  return (
    <View style={styles.stack}>
      <StyledText variant="subtitle">{translate('voice.recurring.title')}</StyledText>
      {choices.map(([kind, label]) => (
        <RadioCard
          key={kind}
          label={translate(label as never)}
          selected={value.kind === kind && value.confirmed}
          onPress={() => onChange({ ...value, kind, confirmed: true })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: 8 } });
