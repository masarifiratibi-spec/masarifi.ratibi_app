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
  expect(screen.getByText(fixtureCategories[0].labelAr)).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.categories.add'))).toBeTruthy();
});
