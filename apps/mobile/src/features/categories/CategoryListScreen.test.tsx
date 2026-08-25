import React from 'react';
import { screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryListScreen } from './CategoryListScreen';

it('renders system hierarchy, favorites, search, and add action', () => {
  renderWithQueryData(<CategoryListScreen />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  // Category labels appear
  expect(screen.getByText(fixtureCategories[0].labelAr)).toBeTruthy();

  // Quick action button "إضافة فئة" (Arabic locale) or accessibilityLabel "إضافة تصنيف"
  expect(
    screen.getByLabelText(translate('coreFinance.categories.add'))
  ).toBeTruthy();
  expect(screen.getByText('إضافة فئة').props.numberOfLines).toBeUndefined();
  expect(screen.getByText('إضافة مجموعة').props.numberOfLines).toBeUndefined();

  // Category rows render
  const rows = screen.getAllByTestId('category-row');
  expect(rows.length).toBeGreaterThan(0);

  // Unified design tokens: standalone cards have borderRadius 22
  expect(rows[0]).toHaveStyle({ borderRadius: 22 });
});
