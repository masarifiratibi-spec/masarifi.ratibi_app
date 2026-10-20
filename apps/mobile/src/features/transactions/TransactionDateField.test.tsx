import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { changeLocale, currentLocale, translate } from '@/localization/i18n';
import { FoundationProviders } from '@/state/FoundationProviders';
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
    8, 21, 16
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

it('reuses the date label across form readiness renders and refreshes date and locale', () => {
  const locale = currentLocale();
  const constructors = jest.spyOn(Intl, 'DateTimeFormat');
  const value = new Date(2026, 7, 8, 16, 37).getTime();
  const onChange = jest.fn();
  try {
    const view = render(
      <TransactionDateField value={value} onChange={onChange} />,
      {
        wrapper: FoundationProviders
      }
    );
    const initialCount = constructors.mock.calls.length;
    const initialLabel = screen.getByText(/2026/).props.children;
    expect(initialCount).toBeGreaterThan(0);
    view.rerender(
      <TransactionDateField value={value} disabled onChange={onChange} />
    );
    view.rerender(<TransactionDateField value={value} onChange={onChange} />);
    expect(screen.getByText(initialLabel)).toBeTruthy();
    expect(constructors).toHaveBeenCalledTimes(initialCount);

    view.rerender(
      <TransactionDateField value={value + 86_400_000} onChange={onChange} />
    );
    expect(screen.getByText(/2026/).props.children).not.toBe(initialLabel);
    const nextCount = constructors.mock.calls.length;
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    changeLocale(nextLocale);
    view.rerender(
      <TransactionDateField value={value + 86_400_000} onChange={onChange} />
    );
    expect(constructors).toHaveBeenCalledTimes(nextCount + 1);
    expect(
      screen.getByText(nextLocale === 'en' ? /Aug/ : /أغسطس/)
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    constructors.mockRestore();
    changeLocale(locale);
  }
});

it('reformats after the device timezone offset changes while the value stays mounted', () => {
  const constructors = jest.spyOn(Intl, 'DateTimeFormat');
  const offset = jest
    .spyOn(Date.prototype, 'getTimezoneOffset')
    .mockReturnValue(-180);
  const value = Date.UTC(2026, 7, 8, 22, 30);
  const onChange = jest.fn();
  try {
    const view = render(
      <TransactionDateField value={value} onChange={onChange} />,
      {
        wrapper: FoundationProviders
      }
    );
    const initialCount = constructors.mock.calls.length;
    offset.mockReturnValue(240);
    view.rerender(<TransactionDateField value={value} onChange={onChange} />);
    expect(constructors).toHaveBeenCalledTimes(initialCount + 1);
  } finally {
    offset.mockRestore();
    constructors.mockRestore();
  }
});
