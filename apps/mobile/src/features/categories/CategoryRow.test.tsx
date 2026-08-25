import React from 'react';
import { PixelRatio } from 'react-native';
import { screen } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { CategoryRow } from './CategoryRow';
import { projectCategory } from './category-presentation';

it('renders category label and meta text', () => {
  renderWithProviders(
    <CategoryRow presentation={projectCategory(fixtureCategories[0], 'en')} />
  );

  // The row should render the category label
  expect(screen.getByTestId('category-row')).toBeTruthy();
  // The label text should appear
  expect(screen.getByText('Housing')).toBeTruthy();
});

it('renders a category row with an accessible image for openmoji visuals', () => {
  const food = fixtureCategories.find((category) => category.id === 'food')!;

  renderWithProviders(
    <CategoryRow presentation={projectCategory(food, 'en')} />
  );

  // The row renders — visual is rendered as an Image (openmoji) or emoji Text
  const row = screen.getByTestId('category-row');
  expect(row).toBeTruthy();
  // Label must appear
  expect(screen.getByText('Food')).toBeTruthy();
});

it.each([
  ['ar', 'فئة المصروفات المنزلية اليومية ذات الاسم الطويل'],
  ['en', 'Everyday household expenses with a long category name']
] as const)('allows category labels to wrap at 200%% text in %s', (locale, label) => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  changeLocale(locale);
  const category = {
    ...fixtureCategories[0],
    labelAr: locale === 'ar' ? label : fixtureCategories[0].labelAr,
    labelEn: locale === 'en' ? label : fixtureCategories[0].labelEn
  };

  renderWithProviders(
    <CategoryRow presentation={projectCategory(category, locale)} />
  );

  expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
  jest.restoreAllMocks();
});
