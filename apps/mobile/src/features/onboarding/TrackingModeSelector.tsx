import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { TrackingPreference } from '@/domain/app-shell';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';

interface TrackingModeSelectorProps {
  onChange: (preference: TrackingPreference) => void;
  now?: () => number;
}

const modes: { mode: TrackingPreference['mode']; label: string; description: string }[] = [
  {
    mode: 'automatic_clear',
    label: 'appShell.tracking.mode.automatic',
    description: 'appShell.tracking.mode.automaticDescription'
  },
  {
    mode: 'review_all',
    label: 'appShell.tracking.mode.review',
    description: 'appShell.tracking.mode.reviewDescription'
  },
  {
    mode: 'paused',
    label: 'appShell.tracking.mode.paused',
    description: 'appShell.tracking.mode.pausedDescription'
  }
];

export function TrackingModeSelector({
  onChange,
  now = Date.now
}: TrackingModeSelectorProps) {
  const [selected, setSelected] =
    useState<TrackingPreference['mode']>('automatic_clear');

  function choose(mode: TrackingPreference['mode']) {
    setSelected(mode);
    onChange({ mode, selectedAt: now(), isRecommended: mode === 'automatic_clear' });
  }

  return (
    <View style={styles.stack}>
      {modes.map((item) => (
        <View key={item.mode} style={styles.option}>
          <ActionButton
            accessibilityState={{ selected: selected === item.mode }}
            label={translate(item.label as never)}
            onPress={() => choose(item.mode)}
            variant={selected === item.mode ? 'primary' : 'secondary'}
          />
          <StyledText variant="caption">
            {translate(item.description as never)}
          </StyledText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  option: {
    gap: 6
  }
});
