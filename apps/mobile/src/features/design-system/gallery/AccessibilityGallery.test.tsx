import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { AccessibilityGallery } from './AccessibilityGallery';

describe('AccessibilityGallery', () => {
  it('renders locale, mixed direction, long Arabic, large text, reduced motion, and navigation order fixtures', () => {
    changeLocale('en');
    const screen = renderWithProviders(<AccessibilityGallery />);

    expect(screen.getByText('Language & Accessibility')).toBeTruthy();
    expect(screen.getByText('ABC 123 EGP')).toBeTruthy();
    expect(screen.getByLabelText('Setup, 2/4')).toBeTruthy();
    expect(screen.getByText('This month with long label')).toBeTruthy();
  });
});
