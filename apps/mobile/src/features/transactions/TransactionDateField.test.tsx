import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionDateField } from './TransactionDateField';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));

it('opens the native date picker and preserves the transaction time', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const onChange = jest.fn();
  const original = new Date(2026, 7, 8, 16, 37).getTime();
  renderWithProviders(
    <TransactionDateField value={original} onChange={onChange} />
  );

  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.transaction.date'))
  );
  const picker = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
  picker.onChange?.(
    { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
    new Date(2026, 8, 21)
  );

  const changed = new Date(onChange.mock.calls[0][0]);
  expect([changed.getMonth(), changed.getDate(), changed.getHours()]).toEqual([
    8,
    21,
    16
  ]);
});

it('accepts a caller-provided accessible label', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  renderWithProviders(
    <TransactionDateField
      label="Start date"
      value={Date.UTC(2026, 7, 8)}
      onChange={jest.fn()}
    />
  );

  expect(screen.getByLabelText('Start date')).toBeTruthy();
});
