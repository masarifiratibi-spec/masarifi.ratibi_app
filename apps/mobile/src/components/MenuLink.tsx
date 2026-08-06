/**
 * MenuLink — a tappable list row for the validation menu.
 *
 * Enforces the 44x44 minimum touch target (Constitution Principle III,
 * UI Contract §8) and uses semantic tokens only.
 */

import React, { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  type AccessibilityProps,
  type View
} from 'react-native';

import { useTheme } from '@/state/theme-context';
import { StyledText } from './StyledText';
import { minTouchTarget } from '@/design-system/tokens';

export interface MenuLinkProps extends AccessibilityProps {
  label: string;
  onPress?: () => void;
}

export const MenuLink = forwardRef<View, MenuLinkProps>(function MenuLink(
  { label, onPress, ...a11y },
  ref
) {
  const theme = useTheme();
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={a11y.accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          minHeight: minTouchTarget
        },
        pressed && { backgroundColor: theme.colors.surfaceMuted }
      ]}
    >
      <StyledText variant="subtitle">{label}</StyledText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center'
  }
});
