/**
 * Foundation providers.
 *
 * Composes theme and TanStack Query providers so every screen and component
 * sees a realistic context. Localization is resolved imperatively through the
 * typed i18n module (no provider needed). Components consume these via hooks,
 * never by reading raw tokens directly. Constitution Principle V.
 */

import React, { useEffect, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveTheme } from '@/design-system/theme';
import type { ResolvedTheme } from '@/design-system/theme';
import { initI18n, changeLocale } from '@/localization/i18n';
import { ThemeContext, type ThemeContextValue } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';
import { SensitiveVisibilityProvider } from './SensitiveVisibilityProvider';

initI18n();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: process.env.NODE_ENV === 'test' ? Infinity : 5 * 60_000,
      retry: false,
      staleTime: Infinity
    }
  }
});

export function FoundationProviders({
  children,
  client = queryClient
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
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

  useEffect(() => {
    changeLocale(locale);
  }, [locale]);

  const resolved: ResolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );
  const themeValue: ThemeContextValue = useMemo(
    () => ({ theme: resolved }),
    [resolved]
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={themeValue}>
        <StatusBar
          backgroundColor={resolved.colors.background}
          style={resolved.mode === 'dark' ? 'light' : 'dark'}
        />
        <SensitiveVisibilityProvider>
          <SafeAreaView
            testID="foundation-direction-root"
            style={{
              backgroundColor: resolved.colors.background,
              flex: 1,
              direction
            }}
          >
            {children}
          </SafeAreaView>
        </SensitiveVisibilityProvider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
