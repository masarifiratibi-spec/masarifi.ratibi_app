import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionFilters } from './TransactionFilters';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

beforeEach(() => {
  useCoreFinanceViewState.getState().clearFilters();
});

it('edits, applies, and clears filter fields from the modal surface', () => {
  renderWithProviders(<TransactionFilters />);
  fireEvent.press(screen.getByText(translate('coreFinance.type.expense')));
  fireEvent.press(screen.getByText(translate('coreFinance.filters.apply')));
  expect(useCoreFinanceViewState.getState().filters.types).toEqual(['expense']);
  fireEvent.press(screen.getByText(translate('coreFinance.filters.clear')));
  expect(useCoreFinanceViewState.getState().draftFilters.types).toEqual([]);
});

it('keeps applied filters unchanged when a draft is cleared or cancelled', () => {
  useCoreFinanceViewState.getState().editFilters({ types: ['income'] });
  useCoreFinanceViewState.getState().applyFilters();
  renderWithProviders(<TransactionFilters />);

  fireEvent.press(screen.getByText(translate('coreFinance.type.expense')));
  fireEvent.press(screen.getByText(translate('coreFinance.filters.clear')));
  expect(useCoreFinanceViewState.getState().filters.types).toEqual(['income']);
  fireEvent.press(screen.getByText(translate('coreFinance.cancel')));
  expect(useCoreFinanceViewState.getState().draftFilters.types).toEqual([
    'income'
  ]);
});

it('rejects an inverted amount range without applying it', () => {
  renderWithProviders(<TransactionFilters />);
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.filters.minimum')),
    '20'
  );
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.filters.maximum')),
    '10'
  );
  fireEvent.press(screen.getByText(translate('coreFinance.filters.apply')));

  expect(
    screen.getByText(translate('coreFinance.filters.rangeInvalid'))
  ).toBeTruthy();
  expect(useCoreFinanceViewState.getState().filters.minMinor).toBeNull();
});

it('edits the existing type, source, sync, review, and sort filters', () => {
  renderWithProviders(<TransactionFilters />);
  fireEvent.press(screen.getByText(translate('coreFinance.type.expense')));
  fireEvent.press(screen.getByText(translate('coreFinance.source.automatic')));
  fireEvent.press(screen.getByText(translate('coreFinance.sync.failed')));
  fireEvent.press(
    screen.getByText(translate('coreFinance.filters.reviewRequired'))
  );
  fireEvent.press(
    screen.getByText(translate('coreFinance.filters.sort.amount_high'))
  );

  expect(useCoreFinanceViewState.getState().draftFilters).toMatchObject({
    types: ['expense'],
    sources: ['automatic'],
    syncStatuses: ['failed'],
    reviewRequired: true,
    sort: 'amount_high'
  });
});

it('exposes period, account, and category filters', () => {
  renderWithProviders(<TransactionFilters />);
  expect(screen.queryByText(translate('coreFinance.ledger.search'))).toBeNull();
  fireEvent.press(
    screen.getByRole('button', {
      name: new RegExp(translate('coreFinance.filters.period'))
    })
  );
  expect(
    screen.getByText(translate('coreFinance.home.period.choose'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.filters.accounts'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.filters.categories'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.filters.minimum'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.filters.maximum'))
  ).toBeTruthy();
  expect(screen.getAllByTestId('advanced-filter-section')).toHaveLength(5);
});

it.each([
  ['JPY', '12345'],
  ['SAR', '123.45'],
  ['OMR', '12.345']
])(
  'round-trips the %s base-currency amount range without changing minor units',
  (currencyCode, majorAmount) => {
    usePreferenceStore.setState({ baseCurrencyCode: currencyCode });
    useCoreFinanceViewState.getState().editFilters({
      minMinor: 12_345,
      maxMinor: 12_345
    });
    useCoreFinanceViewState.getState().applyFilters();

    renderWithProviders(<TransactionFilters />);

    expect(screen.getAllByDisplayValue(majorAmount)).toHaveLength(2);
    fireEvent.changeText(
      screen.getByLabelText(translate('coreFinance.filters.minimum')),
      majorAmount
    );
    fireEvent.changeText(
      screen.getByLabelText(translate('coreFinance.filters.maximum')),
      majorAmount
    );
    fireEvent.press(screen.getByText(translate('coreFinance.filters.apply')));

    expect(useCoreFinanceViewState.getState().filters).toMatchObject({
      amountCurrencyCode: currencyCode,
      minMinor: 12_345,
      maxMinor: 12_345
    });
  }
);
