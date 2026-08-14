import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { FinancialGallery } from './FinancialGallery';

describe('financial gallery section', () => {
  it('renders localized financial meaning and status fixtures', () => {
    changeLocale('en');

    const screen = renderWithProviders(<FinancialGallery />);

    expect(screen.getByText('Financial')).toBeTruthy();
    for (const label of ['Income', 'Expense', 'Transfer', 'Refund', 'Savings', 'Debt']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('+4,200 EGP')).toBeTruthy();
    expect(screen.getAllByText('•••• EGP').length).toBeGreaterThan(0);
  });
});
