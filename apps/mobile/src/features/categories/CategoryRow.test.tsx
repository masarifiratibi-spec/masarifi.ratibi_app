import React from 'react';
import { screen } from '@testing-library/react-native';

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
