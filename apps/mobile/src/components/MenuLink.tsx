/**
 * MenuLink — a tappable list row for the validation menu.
 *
 * Enforces the 44x44 minimum touch target (Constitution Principle III,
 * UI Contract §8) and uses semantic tokens only.
 */

import React, { forwardRef, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type AccessibilityProps,
  type View
} from 'react-native';

import { useTheme } from '@/state/theme-context';
import { StyledText } from './StyledText';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { minTouchTarget, spacing } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';

export interface MenuLinkProps extends AccessibilityProps {
  label: string;
  onPress?: () => void;
  icon?: DesignIconName;
  showChevron?: boolean;
  accessory?: ReactNode;
}

export const MenuLink = forwardRef<View, MenuLinkProps>(function MenuLink(
  { label, onPress, icon, showChevron = false, accessory, ...a11y },
  ref
) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      {...a11y}
      accessibilityRole="link"
      accessibilityLabel={a11y.accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          minHeight: Math.max(48, minTouchTarget)
        },
        pressed && { backgroundColor: theme.colors.surfaceMuted }
      ]}
    >
      {icon ? (
        <DesignIcon
          name={icon}
          label={label}
          color={theme.colors.primary}
          direction={direction}
          decorative
        />
      ) : null}
      <StyledText accessible={false} style={styles.label}>
        {label}
      </StyledText>
      {accessory}
      {showChevron ? (
        <DesignIcon
          name="chevronEnd"
          label={label}
          color={theme.colors.textSecondary}
          direction={direction}
          decorative
        />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  label: {
    flex: 1
  }
});
