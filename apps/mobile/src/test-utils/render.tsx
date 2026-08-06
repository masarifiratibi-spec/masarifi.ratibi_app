import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

import { FoundationProviders } from '@/state/FoundationProviders';
import { currentLocale } from '@/localization/i18n';
import { directionForLocale } from '@/domain/foundation';
import { usePreferenceStore } from '@/state/preferences';

/**
 * Render a component tree wrapped in the foundation providers required for
 * locale, theme, and query state. Component tests should use this instead of
 * the bare `render` so every panel sees a realistic provider context.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const locale = currentLocale();
  usePreferenceStore.setState({
    locale,
    direction: directionForLocale(locale),
    hydrated: true
  });
  return render(<FoundationProviders>{ui}</FoundationProviders>, options);
}
