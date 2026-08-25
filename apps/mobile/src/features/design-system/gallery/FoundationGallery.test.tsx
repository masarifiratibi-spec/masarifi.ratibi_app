import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { FoundationGallery } from './FoundationGallery';

describe('FoundationGallery', () => {
  it('renders semantic roles, type scale, radius, and long text fixtures', () => {
    changeLocale('en');
    const screen = renderWithProviders(<FoundationGallery />);

    expect(screen.getByText('Foundation')).toBeTruthy();
    expect(screen.getByText('Page surface')).toBeTruthy();
    expect(screen.getByText('Summary amount')).toBeTruthy();
    expect(screen.getByText('Long localized content wraps without owning screen data.')).toBeTruthy();
  });
});
