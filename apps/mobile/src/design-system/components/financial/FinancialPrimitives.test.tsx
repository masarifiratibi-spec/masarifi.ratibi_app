import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import {
  AmountText,
  CategoryIcon,
  FinancialBadge
} from './FinancialPrimitives';

describe('financial primitives', () => {
  it('renders signed stable-width amounts with currency', () => {
    const screen = renderWithProviders(
      <AmountText value={1250} currency="EGP" meaning="income" />
    );

    expect(screen.getByText('+1,250 EGP')).toHaveStyle({
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums']
    });
  });

  it('uses a layout-stable masking slot', () => {
    const screen = renderWithProviders(
      <AmountText value={1250} currency="EGP" meaning="expense" masked />
    );

    expect(screen.getByText('•••• EGP')).toBeTruthy();
    expect(
      screen.getByLabelText(translate('designSystem.privacy.hidden'))
    ).toBeTruthy();
  });

  it('renders financial badge text separate from operational state', () => {
    const screen = renderWithProviders(
      <FinancialBadge meaning="debt" label="Debt" />
    );

    expect(screen.getByText('Debt')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
  });

  it('renders category icons with accessible labels', () => {
    const screen = renderWithProviders(
      <CategoryIcon label="Groceries" initials="GR" />
    );

    expect(screen.getByLabelText('Groceries')).toHaveTextContent('GR');
  });
});
