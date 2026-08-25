import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { StateGallery } from './StateGallery';

describe('StateGallery', () => {
  it('renders the shared state and recovery vocabulary without unknown-as-zero output', () => {
    changeLocale('en');
    const screen = renderWithProviders(<StateGallery />);

    for (const label of ['Loading', 'Offline', 'Pending sync', 'Hidden value']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('0 EGP')).toBeNull();
  });
});
