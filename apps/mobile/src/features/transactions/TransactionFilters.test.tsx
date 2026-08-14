import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionFilters } from './TransactionFilters';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

it('edits, applies, and clears filter fields from the modal surface', () => {
  renderWithProviders(<TransactionFilters />);
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.ledger.search')),
    'coffee'
  );
  fireEvent.press(screen.getByText(translate('coreFinance.filters.apply')));
  expect(useCoreFinanceViewState.getState().filters.search).toBe('coffee');
  fireEvent.press(screen.getByText(translate('coreFinance.filters.clear')));
  expect(useCoreFinanceViewState.getState().draftFilters.search).toBe('');
});
