import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';

import type { Locale } from '@/domain/foundation';
import { typography } from './tokens';

export const FONT_ASSETS = {
  'IBMPlexSans-Regular': require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
  'IBMPlexSans-SemiBold': require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
  'IBMPlexSans-Bold': require('../../assets/fonts/IBMPlexSans-Bold.ttf'),
  'IBMPlexSansArabic-Regular': require('../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  'IBMPlexSansArabic-SemiBold': require('../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
  'IBMPlexSansArabic-Bold': require('../../assets/fonts/IBMPlexSansArabic-Bold.ttf')
} as const;

type Weight = 'regular' | 'semibold' | 'bold';

export const typographyStyles = {
  heading: typography.title,
  body: typography.body,
  helper: typography.caption,
  label: typography.subtitle,
  amount: typography.amount
} as const;

export function fontFamilyForLocale(locale: Locale, weight: Weight): string {
  const prefix = locale === 'ar' ? 'IBMPlexSansArabic' : 'IBMPlexSans';
  const suffix =
    weight === 'regular' ? 'Regular' : weight === 'semibold' ? 'SemiBold' : 'Bold';
  return `${prefix}-${suffix}`;
}

export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(FONT_ASSETS);

  if (!loaded && !error) {
    return React.createElement(View, {
      testID: 'font-loading',
      style: { flex: 1 }
    });
  }

  return React.createElement(React.Fragment, null, children);
}
