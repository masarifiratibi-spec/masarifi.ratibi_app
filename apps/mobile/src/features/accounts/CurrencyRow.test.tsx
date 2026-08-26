import React from 'react';
import { PixelRatio } from 'react-native';
import { screen } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { CurrencyRow } from './CurrencyRow';

afterEach(() => {
  jest.restoreAllMocks();
  changeLocale('ar');
});

it.each([
  ['ar', 'الين الياباني'],
  ['en', 'Japanese Yen']
] as const)(
  'allows the currency name to wrap at 200%% text in %s',
  (locale, name) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    changeLocale(locale);

    renderWithProviders(<CurrencyRow currencyCode="JPY" />);

    expect(screen.getByText(name).props.numberOfLines).toBeUndefined();
  }
);

it('uses the vector flag without announcing an emoji', () => {
  changeLocale('en');
  renderWithProviders(<CurrencyRow currencyCode="JPY" />);

  expect(screen.queryByText('🇯🇵')).toBeNull();
  expect(screen.getByLabelText('Currency: JPY - Japanese Yen')).toBeTruthy();
});
