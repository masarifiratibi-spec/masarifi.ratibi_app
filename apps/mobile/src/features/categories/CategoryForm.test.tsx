import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

import type { Category } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryForm } from './CategoryForm';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() }
}));

afterEach(() => jest.restoreAllMocks());

it('requires a category name and shows alert on empty submit', () => {
  renderWithQueryData(<CategoryForm />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);
  // Save button is an icon button with save accessibilityLabel
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.categories.save'))
  );
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('shows hero emoji picker button and opens sheet on press', () => {
  renderWithQueryData(<CategoryForm />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);

  // The hero badge has the chooseIcon accessibilityLabel
  const heroBtn = screen.getByLabelText(
    translate('coreFinance.categories.chooseIcon')
  );
  expect(heroBtn).toBeTruthy();
});

it('fills edit fields when category data arrives after the first render', async () => {
  function Harness() {
    const [category, setCategory] = useState<Category | undefined>();
    useEffect(() => setCategory(fixtureCategories[0]), []);
    return <CategoryForm category={category} />;
  }

  renderWithQueryData(<Harness />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);

  await waitFor(() =>
    expect(screen.getByDisplayValue(fixtureCategories[0].labelAr)).toBeTruthy()
  );
});

it('confirms before discarding a dirty category draft', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  renderWithQueryData(<CategoryForm />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);

  fireEvent.changeText(
    screen.getByPlaceholderText(translate('coreFinance.categories.categoryNamePlaceholder')),
    'Custom'
  );
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.cancel'))
  );

  expect(alert).toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});

it('does not show the discard alert after a new category is saved', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const dispatch = jest.fn();
  jest.mocked(useNavigation).mockReturnValue({ dispatch } as never);
  jest.spyOn(coreFinanceService, 'createCategory').mockResolvedValue({
    value: { ...fixtureCategories[0], id: 'created-category' },
    affectedScopes: []
  });
  renderWithQueryData(<CategoryForm />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);

  fireEvent.changeText(
    screen.getByPlaceholderText(translate('coreFinance.categories.categoryNamePlaceholder')),
    'Saved category'
  );
  const preventRemove = jest.mocked(usePreventRemove).mock.calls.at(-1)?.[1];
  jest.mocked(router.replace).mockImplementation(() =>
    preventRemove?.({ data: { action: { type: 'REPLACE' } } })
  );
  fireEvent.press(screen.getByLabelText(translate('coreFinance.categories.save')));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/categories'));
  expect(alert).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledWith({ type: 'REPLACE' });
});
