/**
 * Foundation providers.
 *
 * Composes theme and TanStack Query providers so every screen and component
 * sees a realistic context. Localization is resolved imperatively through the
 * typed i18n module (no provider needed). Components consume these via hooks,
 * never by reading raw tokens directly. Constitution Principle V.
 */

import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { Platform, View, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaInsetsContext,
  SafeAreaView
} from 'react-native-safe-area-context';

import { resolveEffectiveTimeZone } from '@/domain/effective-time-zone';
import { resolveTheme } from '@/design-system/theme';
import type { ResolvedTheme } from '@/design-system/theme';
import { layoutDirectionStyle } from '@/design-system/direction';
import { initI18n, changeLocale } from '@/localization/i18n';
import { ThemeContext, type ThemeContextValue } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';
import { SensitiveVisibilityProvider } from './SensitiveVisibilityProvider';
import { subscribeTrackingSaves } from '@/services/tracking-save-events';
import { useAppShellStore } from './app-shell';
import type { UserProfile } from '@/domain/settings';
import {
  bindLocalReadCache,
  offlineReadPrefixes,
  type ReadCacheScope
} from '@/services/local-read-cache';
import { createQueryReadCache } from '@/storage/query-read-cache';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { isAppLockEnabled } from '@/config/client-runtime';

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
  const preference = usePreferenceStore((state) => state.theme);
  const systemScheme = useColorScheme();
  const direction = usePreferenceStore((state) => state.direction);
  const hydrated = usePreferenceStore((state) => state.hydrated);
  const hydrate = usePreferenceStore((state) => state.hydrate);
  const previousLocale = useRef(locale);
  const pathname = usePathname();
  const insets = React.useContext(SafeAreaInsetsContext);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (isFixtureModeEnabled()) return;
    const current = (): ReadCacheScope | null => {
      const shell = useAppShellStore.getState();
      return shell.hydrated &&
        shell.session?.status === 'authenticated' &&
        shell.session.userId &&
        !shell.logoutQuiescingOwnerId &&
        (!isAppLockEnabled() ||
          (shell.privacyLock?.enabled &&
            shell.privacyLock.appLockStatus === 'unlocked'))
        ? {
            ownerId: shell.session.userId,
            locale: usePreferenceStore.getState().locale
          }
        : null;
    };
    let stop = () => {};
    let identity = '';
    let previousOwner = '';
    let locallyAdmittedOwner = '';
    const bind = () => {
      const scope = current();
      const session = useAppShellStore.getState().session;
      const ownerId =
        session?.status === 'authenticated' ? (session.userId ?? '') : '';
      const next = JSON.stringify({ ownerId, scope, restoration: session?.restoration });
      if (next === identity) return;
      if (previousOwner !== ownerId) locallyAdmittedOwner = '';
      if (session?.restoration === 'local') locallyAdmittedOwner = ownerId;
      const remotelyRestored = scope && locallyAdmittedOwner === ownerId &&
        session?.restoration === 'restored';
      if (remotelyRestored) locallyAdmittedOwner = '';
      stop();
      if (previousOwner && previousOwner !== ownerId) client.clear();
      // Closing a privacy/read gate withdraws only reads, not an in-flight mutation's state.
      if (!scope)
        for (const prefix of offlineReadPrefixes)
          client.removeQueries({ queryKey: prefix });
      previousOwner = ownerId;
      identity = next;
      stop = bindLocalReadCache(client, createQueryReadCache(current));
      if (remotelyRestored) {
        // Retire reads from the old auth context; never resume or clear commands.
        void Promise.all(offlineReadPrefixes.map(queryKey => client.cancelQueries({ queryKey })))
          .then(() => {
            if (identity !== next) return;
            return Promise.all(offlineReadPrefixes.map(queryKey =>
              client.invalidateQueries({ queryKey, refetchType: 'active' })
            ));
          });
      }
    };
    // Cache is only a read projection; retain existing explicit write/sync admission.
    for (const prefix of offlineReadPrefixes)
      client.setQueryDefaults(prefix, { staleTime: 60_000 });
    bind();
    const unsubscribeOwner = useAppShellStore.subscribe(bind);
    const unsubscribeLocale = usePreferenceStore.subscribe(bind);
    return () => {
      stop();
      unsubscribeOwner();
      unsubscribeLocale();
    };
  }, [client]);

  useEffect(() => {
    const clear = () => client.clear();
    const unregisterUserReset = registerRuntimeUserDataReset(clear);
    const unregisterIdentityReset = registerRuntimeIdentityReset(clear);
    // Bootstrap has already fetched and validated this owner's server profile.
    // Publish it before protected screens mount rather than repeat their reads.
    const unsubscribeProfile = useAppShellStore.subscribe((state, previous) => {
      const snapshot = state.profileSetupSnapshot;
      if (
        snapshot &&
        snapshot !== previous.profileSetupSnapshot &&
        state.session?.status === 'authenticated' &&
        ['complete', 'incomplete'].includes(state.profileSetupStatus)
      ) {
        usePreferenceStore
          .getState()
          .setTimeZone(resolveEffectiveTimeZone(snapshot.profile.timeZone));
        client.setQueryData<UserProfile>(['settings', 'profile'], (cached) =>
          cached && cached.version > snapshot.profile.version
            ? cached
            : snapshot.profile
        );
      }
    });
    const unsubscribeSaves = subscribeTrackingSaves((event) => {
      if (useAppShellStore.getState().session?.userId !== event.ownerId) return;
      const predicate = (query: { queryKey: readonly unknown[] }) => {
        const [root, resource] = query.queryKey;
        if (root === 'core-finance')
          return [
            'home',
            'accounts',
            'account',
            'account-balances',
            'transactions',
            'transaction'
          ].includes(String(resource));
        if (root === 'planning')
          return (
            !['draft', 'conflict'].includes(String(resource)) &&
            !(resource === 'salary' && query.queryKey[2] === 'profile')
          );
        if (root === 'reports')
          return ['live', 'net-worth', 'history', 'breakdown'].includes(
            String(resource)
          );
        return root === 'assistant' && resource === 'context';
      };
      void client
        .cancelQueries({ predicate })
        .then(() => {
          if (useAppShellStore.getState().session?.userId === event.ownerId)
            return client.invalidateQueries({ predicate });
        })
        .catch(() => undefined);
    });
    return () => {
      unregisterUserReset();
      unregisterIdentityReset();
      unsubscribeProfile();
      unsubscribeSaves();
    };
  }, [client]);

  useEffect(() => {
    changeLocale(locale);
    if (previousLocale.current !== locale) {
      // Voice receipts are owner-scoped data, not locale-dependent query results.
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'voice-analysis'
      });
      client.getMutationCache().clear();
    }
    previousLocale.current = locale;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = direction;
      document.documentElement.lang = locale;
    }
  }, [client, locale, direction]);

  const resolved: ResolvedTheme = useMemo(
    () => resolveTheme(preference, systemScheme),
    [preference, systemScheme]
  );
  const obligationHeroVisible =
    pathname.startsWith('/obligations') &&
    pathname !== '/obligations/new' &&
    !pathname.endsWith('/edit');
  const safeAreaColor = obligationHeroVisible
    ? resolved.colors.horizon.referenceStart
    : resolved.colors.background;
  const themeValue: ThemeContextValue = useMemo(
    () => ({ theme: resolved }),
    [resolved]
  );
  const navigationTheme: NavigationTheme = useMemo(
    () => ({
      dark: resolved.mode === 'dark',
      colors: {
        primary: resolved.colors.primary,
        background: resolved.colors.surfaces.page,
        card: resolved.colors.surfaces.card,
        text: resolved.colors.content.primary,
        border: resolved.colors.borders.default,
        notification: resolved.colors.status.info
      },
      fonts: DefaultTheme.fonts
    }),
    [resolved]
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeContext.Provider value={themeValue}>
        <NavigationThemeProvider value={navigationTheme}>
          <StatusBar
            backgroundColor={safeAreaColor}
            style={
              obligationHeroVisible || resolved.mode === 'dark'
                ? 'light'
                : 'dark'
            }
          />
          <SensitiveVisibilityProvider>
            <SafeAreaView
              testID="foundation-direction-root"
              style={{
                backgroundColor: resolved.colors.background,
                flex: 1,
                ...layoutDirectionStyle(direction)
              }}
            >
              {children}
              {obligationHeroVisible ? (
                <View
                  pointerEvents="none"
                  style={{
                    backgroundColor: safeAreaColor,
                    height: insets?.top ?? 0,
                    left: 0,
                    position: 'absolute',
                    right: 0,
                    top: 0
                  }}
                />
              ) : null}
            </SafeAreaView>
          </SensitiveVisibilityProvider>
        </NavigationThemeProvider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
