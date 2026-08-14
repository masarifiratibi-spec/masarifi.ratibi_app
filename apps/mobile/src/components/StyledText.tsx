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
import { currentLocale, translateDynamic } from '@/localization/i18n';
import { fontFamilyForLocale } from '@/design-system/typography';

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
  const base = variantStyles(theme.typography)[variant];
  const children = typeof rest.children === 'string'
    ? translateDynamic(rest.children)
    : rest.children;
  return (
    <Text
      style={[
        base,
        {
          color: theme.colors.textPrimary,
          flexShrink: 1,
          fontFamily: fontFamilyForLocale(
            currentLocale(),
            weightForVariant(variant)
          ),
          writingDirection: 'auto'
        },
        style
      ]}
      {...withDerivedAccessibilityLabel({ ...rest, children })}
    />
  );
}

function weightForVariant(variant: Variant) {
  return variant === 'caption' || variant === 'body' ? 'regular' : 'bold';
}

/**
 * Ensures every Text node exposes an accessible name. An explicit
 * accessibilityLabel wins; otherwise we derive one from string children so
 * screen readers always announce the visible text.
 */
function withDerivedAccessibilityLabel(rest: TextProps): TextProps {
  if (rest.accessible === false || rest.accessibilityLabel) {
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
    caption: t.caption,
    body: t.body,
    subtitle: t.subtitle,
    title: t.title,
    headline: t.headline,
    amount: t.amount
  };
}
