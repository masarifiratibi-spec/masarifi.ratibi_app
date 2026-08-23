import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { changeLocale, translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryFilterPicker } from './CategoryFilterPicker';

beforeEach(() => changeLocale('en'));

it('searches categories, ranks favorites, and excludes merged sources', () => {
  const onSelect = jest.fn();
  renderWithQueryData(<CategoryFilterPicker onSelect={onSelect} />, [
    [
      coreFinanceKeys.categories(true),
      [
        ...fixtureCategories,
        { ...fixtureCategories[0], id: 'merged', status: 'merged' as const }
      ]
    ]
  ]);
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.categories.search')),
    'Food'
  );
  fireEvent.press(screen.getByText(fixtureCategories[1].labelEn));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'food' })
  );
  expect(screen.queryByText('merged')).toBeNull();
});

it('groups favorite categories above the remaining active categories', () => {
  renderWithQueryData(<CategoryFilterPicker groupFavorites />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  expect(
    screen.getByText(translate('coreFinance.categories.mostUsed'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.categories.other'))
  ).toBeTruthy();
  expect(screen.getByText(fixtureCategories[0].labelEn)).toBeTruthy();
  expect(screen.getByText(fixtureCategories[13].labelEn)).toBeTruthy();
});

it('omits the favorite section when there are no active favorites', () => {
  renderWithQueryData(<CategoryFilterPicker groupFavorites />, [
    [
      coreFinanceKeys.categories(true),
      fixtureCategories.map((category) => ({
        ...category,
        isFavorite: false
      }))
    ]
  ]);

  expect(
    screen.queryByText(translate('coreFinance.categories.mostUsed'))
  ).toBeNull();
  expect(
    screen.getByText(translate('coreFinance.categories.other'))
  ).toBeTruthy();
});
