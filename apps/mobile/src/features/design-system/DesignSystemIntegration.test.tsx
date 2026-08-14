import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import type { Locale, ThemePreference } from '@/domain/foundation';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { DesignSystemGallery } from './DesignSystemGallery';

const MATRIX: readonly { locale: Locale; theme: ThemePreference }[] = [
  { locale: 'en', theme: 'light' },
  { locale: 'en', theme: 'dark' },
  { locale: 'ar', theme: 'light' },
  { locale: 'ar', theme: 'dark' }
];

describe.each(MATRIX)('DesignSystemGallery integration %s', ({ locale, theme }) => {
  beforeEach(() => {
    changeLocale(locale);
    usePreferenceStore.setState({
      locale,
      direction: locale === 'ar' ? 'rtl' : 'ltr',
      theme,
      reducedMotion: true,
      hideBalances: true,
      hydrated: true
    });
  });

  it('renders all required families with hidden balances and large-text fixtures', () => {
    const screen = renderWithProviders(<DesignSystemGallery />);

    for (const section of ['financial', 'interaction', 'accessibility', 'charts', 'privacy']) {
      fireEvent.press(screen.getByTestId(`design-system-section-${section}`));
      expect(screen.toJSON()).not.toBeNull();
    }

    expect(screen.getByText('****')).toBeTruthy();
    expect(usePreferenceStore.getState()).toMatchObject({
      locale,
      theme,
      reducedMotion: true,
      hideBalances: true
    });
  });
});
