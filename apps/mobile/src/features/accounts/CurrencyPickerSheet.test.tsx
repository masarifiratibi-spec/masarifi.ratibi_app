import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';

it('offers the authoritative zero-decimal JPY currency', () => {
  changeLocale('en');
  const onSelect = jest.fn();
  renderWithProviders(
    <CurrencyPickerSheet
      visible
      selectedCurrency="SAR"
      onSelect={onSelect}
      onClose={jest.fn()}
    />
  );

  fireEvent.press(screen.getByLabelText(/JPY - Japanese Yen/));

  expect(onSelect).toHaveBeenCalledWith('JPY');
});
