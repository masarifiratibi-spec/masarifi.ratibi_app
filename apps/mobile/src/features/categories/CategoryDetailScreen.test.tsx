import React from 'react';
import { screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryDetailScreen } from './CategoryDetailScreen';

it('shows category detail actions including archive and merge', () => {
  renderWithQueryData(<CategoryDetailScreen id="food" />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(screen.getByText(fixtureCategories[1].labelAr)).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.categories.archive'))).toBeTruthy();
  expect(screen.getByText(new RegExp(translate('coreFinance.categories.merge'))))
    .toBeTruthy();
});
