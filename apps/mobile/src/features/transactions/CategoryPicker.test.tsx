import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { CategoryPicker } from './CategoryPicker';

it('searches categories, ranks favorites, and excludes merged sources', () => {
  const onSelect = jest.fn();
  renderWithQueryData(
    <CategoryPicker onSelect={onSelect} />,
    [
      [
        coreFinanceKeys.categories(true),
        [
          ...fixtureCategories,
          { ...fixtureCategories[0], id: 'merged', status: 'merged' as const }
        ]
      ]
    ]
  );
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.categories.search')),
    'Food'
  );
  fireEvent.press(screen.getByText(fixtureCategories[1].labelAr));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'food' })
  );
  expect(screen.queryByText('merged')).toBeNull();
});
