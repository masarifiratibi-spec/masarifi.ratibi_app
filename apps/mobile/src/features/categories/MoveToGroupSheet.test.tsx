import React from 'react';
import { screen } from '@testing-library/react-native';

import { changeLocale, translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { MoveToGroupSheet } from './MoveToGroupSheet';

it.each([
  ['ar', { left: 0 }],
  ['en', { right: 0 }]
] as const)('places the close action at logical end in %s', (locale, edge) => {
  changeLocale(locale);
  renderWithProviders(
    <MoveToGroupSheet
      visible
      category={fixtureCategories[0]}
      groups={fixtureCategories}
      onSelectGroup={jest.fn()}
      onNewGroup={jest.fn()}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByLabelText(translate('coreFinance.cancel'))).toHaveStyle(
    edge
  );
});

it('makes the move-to-group sheet a modal region', () => {
  renderWithProviders(
    <MoveToGroupSheet
      visible
      category={fixtureCategories[0]}
      groups={fixtureCategories}
      onSelectGroup={jest.fn()}
      onNewGroup={jest.fn()}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByTestId('move-to-group-sheet')).toHaveProp(
    'accessibilityViewIsModal',
    true
  );
  expect(
    screen.UNSAFE_getByProps({ testID: 'move-to-group-backdrop' }).props
      .accessibilityElementsHidden
  ).toBe(true);
});
