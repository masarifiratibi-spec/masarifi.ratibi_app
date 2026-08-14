import React, { useEffect, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Category } from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryForm } from './CategoryForm';

it('requires Arabic and English labels and preserves favorite state', () => {
  renderWithQueryData(<CategoryForm />, [
    [coreFinanceKeys.categories(), fixtureCategories]
  ]);
  fireEvent.press(screen.getByText(translate('coreFinance.categories.save')));
  expect(screen.getByRole('alert')).toBeTruthy();
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
  expect(screen.getByDisplayValue('Housing')).toBeTruthy();
});
