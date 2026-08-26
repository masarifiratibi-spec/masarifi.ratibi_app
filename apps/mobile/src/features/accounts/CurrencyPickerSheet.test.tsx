import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { CurrencyFlagIcon } from '@/design-system/components/currency/CurrencyFlagIcon';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';

it('uses a complete currency logo for the authoritative zero-decimal JPY currency', () => {
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

  expect(screen.queryByText('🇯🇵')).toBeNull();
  expect(screen.queryByText('JP')).toBeNull();
  expect(
    screen
      .UNSAFE_getAllByType(CurrencyFlagIcon)
      .some((flag) => flag.props.code === 'JPY')
  ).toBe(true);
  fireEvent.press(screen.getByLabelText(/JPY - Japanese Yen/));

  expect(onSelect).toHaveBeenCalledWith('JPY');
});

it('makes the currency picker a modal region', () => {
  renderWithProviders(
    <CurrencyPickerSheet
      visible
      selectedCurrency="SAR"
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByTestId('currency-picker-sheet')).toHaveProp(
    'accessibilityViewIsModal',
    true
  );
  expect(
    screen.UNSAFE_getByProps({ testID: 'currency-picker-backdrop' }).props
      .accessibilityElementsHidden
  ).toBe(true);
});
