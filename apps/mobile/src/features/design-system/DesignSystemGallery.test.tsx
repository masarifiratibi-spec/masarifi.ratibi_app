import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { DesignSystemGallery } from './DesignSystemGallery';

describe('DesignSystemGallery', () => {
  beforeEach(() => {
    changeLocale('en');
    usePreferenceStore.setState({
      locale: 'en',
      direction: 'ltr',
      theme: 'light',
      reducedMotion: false,
      hideBalances: true,
      hydrated: true
    });
  });

  it('navigates sections, keeps the app light, switches locale, and stays gallery-scoped', () => {
    const screen = renderWithProviders(<DesignSystemGallery />);

    expect(screen.getByTestId('design-system-scroll')).toBeTruthy();
    for (const section of [
      'foundation',
      'navigation',
      'financial',
      'interaction',
      'states',
      'charts',
      'accessibility',
      'privacy'
    ]) {
      expect(screen.getByTestId(`design-system-section-${section}`)).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId('design-system-section-charts'));
    expect(screen.getAllByText('Charts').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId('design-system-theme-dark'));
    expect(usePreferenceStore.getState().theme).toBe('light');

    fireEvent.press(screen.getByTestId('design-system-locale-ar'));
    expect(usePreferenceStore.getState().locale).toBe('ar');
    fireEvent.press(screen.getByTestId('design-system-locale-en'));
    expect(usePreferenceStore.getState().locale).toBe('en');

    expect(screen.queryByText('Production dashboard')).toBeNull();
  });
});
