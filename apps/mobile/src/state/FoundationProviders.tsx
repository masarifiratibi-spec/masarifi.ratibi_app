/**
 * Foundation providers.
 *
 * Composes theme and TanStack Query providers so every screen and component
 * sees a realistic context. Localization is resolved imperatively through the
 * typed i18n module (no provider needed). Components consume these via hooks,
 * never by reading raw tokens directly. Constitution Principle V.
 */

import React, { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';

import { resolveTheme } from '@/design-system/theme';
import type { ResolvedTheme } from '@/design-system/theme';
import { initI18n, changeLocale } from '@/localization/i18n';
import { ThemeContext, type ThemeContextValue } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';

initI18n();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity
    }
  }
});

export function FoundationProviders({ children }: { children: ReactNode }) {
  const locale = usePreferenceStore((state) => state.locale);
  const themePreference = usePreferenceStore((state) => state.theme);
  const direction = usePreferenceStore((state) => state.direction);
  const hydrated = usePreferenceStore((state) => state.hydrated);
  const hydrate = usePreferenceStore((state) => state.hydrate);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  changeLocale(locale);

  const resolved: ResolvedTheme = resolveTheme(themePreference);
  const themeValue: ThemeContextValue = { theme: resolved };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={themeValue}>
        <View testID="foundation-direction-root" style={{ flex: 1, direction }}>
          {children}
        </View>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
