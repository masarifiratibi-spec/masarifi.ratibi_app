import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { useTheme } from '@/state/theme-context';
import { minTouchTarget } from '@/design-system/tokens';
import { translateDynamic } from '@/localization/i18n';

export type ActionButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'quiet' | 'destructive' | 'premium';

export interface ActionButtonProps extends Omit<
  PressableProps,
  'children' | 'style'
> {
  label: string;
  variant?: ActionButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ActionButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: ActionButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const colors = variantColors(theme.colors, variant);
  const localizedLabel = translateDynamic(label);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={localizedLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: Math.max(48, minTouchTarget),
          minWidth: minTouchTarget,
          backgroundColor: colors.background,
          borderColor: colors.border
        },
        pressed && !isDisabled && { backgroundColor: colors.pressed },
        isDisabled && styles.disabled,
        style
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: colors.text }]}>{localizedLabel}</Text>
    </Pressable>
  );
}

function variantColors(
  colors: ReturnType<typeof useTheme>['colors'],
  variant: ActionButtonVariant
) {
  if (variant === 'destructive') {
    return {
      background: colors.status.danger,
      border: colors.status.danger,
      pressed: colors.status.danger,
      text: colors.textInverse
    };
  }
  if (variant === 'premium') {
    return {
      background: colors.accent,
      border: colors.accent,
      pressed: colors.accent,
      text: colors.textInverse
    };
  }
  if (variant === 'quiet') {
    return {
      background: 'transparent',
      border: 'transparent',
      pressed: colors.surfaceMuted,
      text: colors.primary
    };
  }
  if (variant === 'secondary' || variant === 'tertiary') {
    return {
      background: colors.surfaceMuted,
      border: colors.border,
      pressed: colors.surface,
      text: colors.primary
    };
  }
  return {
    background: colors.primary,
    border: colors.primary,
    pressed: colors.primaryPressed,
    text: colors.textInverse
  };
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  label: {
    fontSize: 15,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.56
  }
});
