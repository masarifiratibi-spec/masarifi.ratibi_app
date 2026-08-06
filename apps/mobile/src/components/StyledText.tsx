/**
 * StyledText — typography primitive that resolves the active theme.
 *
 * The only text component feature code should use for foundation strings. It
 * consumes semantic tokens and applies the app's typography scale. Raw font
 * values never appear in feature components (Constitution Principle IV).
 */

import React from 'react';
import {
  Text,
  type TextProps,
  type StyleProp,
  type TextStyle
} from 'react-native';

import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';

type Variant = keyof ReturnType<typeof variantStyles>;

export interface StyledTextProps extends TextProps {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
}

export function StyledText({
  variant = 'body',
  style,
  ...rest
}: StyledTextProps) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const base = variantStyles(theme.typography)[variant];
  return (
    <Text
      style={[
        base,
        { color: theme.colors.textPrimary, writingDirection: direction },
        style
      ]}
      {...withDerivedAccessibilityLabel(rest)}
    />
  );
}

/**
 * Ensures every Text node exposes an accessible name. An explicit
 * accessibilityLabel wins; otherwise we derive one from string children so
 * screen readers always announce the visible text.
 */
function withDerivedAccessibilityLabel(rest: TextProps): TextProps {
  if (rest.accessibilityLabel) {
    return rest;
  }
  const children = rest.children;
  if (typeof children === 'string') {
    return { ...rest, accessibilityLabel: children };
  }
  return rest;
}

function variantStyles(t: ReturnType<typeof useTheme>['typography']) {
  return {
    caption: { fontSize: t.caption },
    body: { fontSize: t.body },
    subtitle: { fontSize: t.subtitle },
    title: { fontSize: t.title, fontWeight: '700' as const },
    headline: { fontSize: t.headline, fontWeight: '700' as const },
    amount: { fontSize: t.amount, fontWeight: '700' as const }
  };
}
