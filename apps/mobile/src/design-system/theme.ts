/**
 * Theme resolution for the Masarifi mobile app.
 *
 * Resolves the user's theme preference against the system preference and
 * returns the concrete ThemeColors to apply. Components consume this via the
 * foundation providers; they never read raw tokens directly.
 */

import { Appearance } from 'react-native';

import {
  darkThemeColors,
  lightThemeColors,
  spacing,
  radius,
  typography,
  minTouchTarget,
  type ThemeColors
} from './tokens';
import type { ThemePreference } from '@/domain/foundation';

type SystemColorScheme = ReturnType<typeof Appearance.getColorScheme>;

export interface ResolvedTheme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  minTouchTarget: number;
  mode: 'light' | 'dark';
}

const baseMetrics = { spacing, radius, typography, minTouchTarget };

export function resolveTheme(
  preference: ThemePreference,
  systemScheme: SystemColorScheme = Appearance.getColorScheme()
): ResolvedTheme {
  const mode = resolveThemeMode(preference, systemScheme);
  return {
    ...baseMetrics,
    colors: mode === 'dark' ? darkThemeColors : lightThemeColors,
    mode
  };
}

function resolveThemeMode(
  preference: ThemePreference,
  systemScheme: SystemColorScheme
): 'light' | 'dark' {
  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return preference;
}
