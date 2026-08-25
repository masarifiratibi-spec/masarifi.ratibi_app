import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { currentLocale, translate } from '@/localization/i18n';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import {
  completeCategorySelection,
  getCategorySelectionSession
} from './category-selection-session';
import { CategoryDetailScreen } from './CategoryDetailScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() }
}));

it('shows category detail actions including archive and merge', () => {
  renderWithQueryData(<CategoryDetailScreen id="food" />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);
  expect(screen.getByText(fixtureCategories[1].labelAr)).toBeTruthy();
  expect(
    screen.getByText(
      new RegExp(translate('coreFinance.categories.origin.system'))
    )
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.categories.archive'))
  ).toBeTruthy();
  expect(
    screen.getByText(new RegExp(translate('coreFinance.categories.merge')))
  ).toBeTruthy();
});

it('requires confirmation before changing category lifecycle', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const setStatus = jest.spyOn(coreFinanceService, 'setCategoryStatus');
  renderWithQueryData(<CategoryDetailScreen id="food" />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  fireEvent.press(
    screen.getByText(translate('coreFinance.categories.archive'))
  );

  expect(alert).toHaveBeenCalled();
  expect(setStatus).not.toHaveBeenCalled();
});

it('does not preselect the first merge target', () => {
  renderWithQueryData(<CategoryDetailScreen id="food" />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  expect(
    screen.getByText(translate('coreFinance.categories.merge'))
  ).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: translate('coreFinance.categories.merge')
    })
  ).toBeDisabled();
});

it('uses the canonical picker for a merge target and excludes the source', () => {
  renderWithQueryData(<CategoryDetailScreen id="food" />, [
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  fireEvent.press(
    screen.getByLabelText(
      `${translate('coreFinance.categories.selectMergeTarget')} ${translate('coreFinance.categories.selectMergeTarget')}`
    )
  );
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  const session = getCategorySelectionSession(route.params.requestId);
  expect(session).toMatchObject({ excludedIds: ['food'] });
  act(() => completeCategorySelection(route.params.requestId, 'shopping'));
  const shopping = fixtureCategories.find((item) => item.id === 'shopping');

  expect(
    screen.getByText(
      currentLocale() === 'ar'
        ? (shopping?.labelAr ?? '')
        : (shopping?.labelEn ?? '')
    )
  ).toBeTruthy();
});
