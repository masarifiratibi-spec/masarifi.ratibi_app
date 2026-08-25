import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { NavigationGallery } from './NavigationGallery';

describe('NavigationGallery', () => {
  it('renders grouped navigation row fixtures with status and value slots', () => {
    changeLocale('en');
    const screen = renderWithProviders(<NavigationGallery />);

    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByLabelText('Privacy, Hidden balances and app lock, On, Protected')).toBeTruthy();
  });
});
