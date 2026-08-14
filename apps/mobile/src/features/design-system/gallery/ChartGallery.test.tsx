import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ChartGallery } from './ChartGallery';

describe('ChartGallery', () => {
  it('renders empty, insufficient, dense, summary, grayscale-label, and drill-down fixtures', () => {
    changeLocale('en');
    const screen = renderWithProviders(<ChartGallery />);

    expect(screen.getByText('Spending by category, grouped for readability.')).toBeTruthy();
    expect(screen.getByText('Food 50')).toBeTruthy();
    expect(screen.getByText('Other 10')).toBeTruthy();
    expect(screen.getByText('Income solid')).toBeTruthy();
    expect(screen.getByLabelText('Open chart details')).toBeTruthy();
  });
});
