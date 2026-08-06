/**
 * Theme context.
 *
 * Exposes the resolved theme (concrete colors + metrics) to components.
 * Components consume semantic names only; they never read raw token values.
 */

import { createContext, useContext } from 'react';

import type { ResolvedTheme } from '@/design-system/theme';
import { resolveTheme } from '@/design-system/theme';

export interface ThemeContextValue {
  theme: ResolvedTheme;
}

const fallbackTheme = resolveTheme('system');

export const ThemeContext = createContext<ThemeContextValue>({
  theme: fallbackTheme
});

export function useTheme(): ResolvedTheme {
  return useContext(ThemeContext).theme;
}
