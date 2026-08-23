import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { minTouchTarget } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';

export interface IconButtonProps extends Omit<
  PressableProps,
  'children' | 'style'
> {
  icon: DesignIconName;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, style, ...props }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          minHeight: minTouchTarget,
          minWidth: minTouchTarget,
          borderColor: theme.colors.border
        },
        style
      ]}
      {...props}
    >
      <DesignIcon
        name={icon}
        label={label}
        color={theme.colors.primary}
        decorative
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center'
  }
});
