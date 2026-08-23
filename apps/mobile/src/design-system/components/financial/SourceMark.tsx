import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { minTouchTarget, spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function SourceMark({
  label,
  description,
  onPress
}: {
  label: string;
  description?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const accessibilityLabel = [label, description].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : 'text'}
      onPress={onPress}
      style={[
        styles.root,
        {
          borderColor: theme.colors.borders.subtle,
          minHeight: onPress ? minTouchTarget : undefined,
          minWidth: onPress ? minTouchTarget : undefined
        }
      ]}
    >
      <StyledText
        accessible={false}
        variant="title"
        style={[styles.cue, { color: theme.colors.content.muted }]}
      >
        {translate('designSystem.financial.source')}
      </StyledText>
      <StyledText
        accessible={false}
        variant="subtitle"
        style={[styles.label, { color: theme.colors.content.primary }]}
      >
        {label}
      </StyledText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 2
  },
  cue: {
    fontSize: 10,
    lineHeight: 14
  },
  label: {
    fontSize: 12,
    lineHeight: 16
  }
});
