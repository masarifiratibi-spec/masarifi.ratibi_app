import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

import { FoundationProviders } from '@/state/FoundationProviders';
import { currentLocale } from '@/localization/i18n';
import { directionForLocale } from '@/domain/foundation';
import { usePreferenceStore } from '@/state/preferences';

type QuerySeed = readonly [readonly unknown[], unknown];

/**
 * Render a component tree wrapped in the foundation providers required for
 * locale, theme, and query state. Component tests should use this instead of
 * the bare `render` so every panel sees a realistic provider context.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return renderWithQueryData(ui, [], options);
}

export function renderWithQueryData(
  ui: ReactElement,
  querySeeds: readonly QuerySeed[],
  options?: RenderOptions
) {
  const locale = currentLocale();
  usePreferenceStore.setState({
    locale,
    direction: directionForLocale(locale),
    hydrated: true
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
      mutations: { gcTime: Infinity, retry: false }
    }
  });
  querySeeds.forEach(([queryKey, queryValue]) =>
    queryClient.setQueryData(queryKey, queryValue)
  );
  return render(
    <FoundationProviders client={queryClient}>{ui}</FoundationProviders>,
    options
  );
}
