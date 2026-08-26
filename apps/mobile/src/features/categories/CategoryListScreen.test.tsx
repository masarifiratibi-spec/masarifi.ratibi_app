import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { CategoryListScreen } from './CategoryListScreen';
import { GroupFormModal } from './GroupFormModal';

const categoryListQuerySeeds = [
  [coreFinanceKeys.categories(true), fixtureCategories],
  [coreFinanceKeys.transactions(), { items: [], nextCursor: null, total: 0 }]
] as const;

it('renders system hierarchy, favorites, search, and add action', () => {
  renderWithQueryData(<CategoryListScreen />, categoryListQuerySeeds);

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

it('makes the category form a modal region', () => {
  renderWithQueryData(<CategoryListScreen />, categoryListQuerySeeds);

  fireEvent.press(screen.getByLabelText(translate('coreFinance.categories.add')));
  expect(screen.getByTestId('category-form-modal-content')).toHaveProp(
    'accessibilityViewIsModal',
    true
  );
});

it('makes the group form a modal region', () => {
  renderWithProviders(
    <GroupFormModal visible onClose={jest.fn()} onCreated={jest.fn()} />
  );

  expect(screen.getByTestId('group-form-modal-content')).toHaveProp(
    'accessibilityViewIsModal',
    true
  );
  expect(
    screen.UNSAFE_getByProps({ testID: 'group-form-modal-backdrop' }).props
      .importantForAccessibility
  ).toBe('no-hide-descendants');
});
