import React from 'react';
import { Button, Modal, Platform } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { lightThemeColors, radius } from '@/design-system/tokens';
import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { DateRangeSheet } from './DateRangeSheet';
import { customPeriod, thisWeekPeriod, todayPeriod } from './date-period';
import * as periodFormatting from './date-period';

const riyadh = { timeZone: 'Asia/Riyadh', monthStartDay: 1 } as const;

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(DateTimePickerAndroid.open).mockReset();
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr', ...riyadh });
  // Saturday, 22 August 2026
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 22, 12));
});

afterEach(() => jest.restoreAllMocks());

it.each([
  [1, '2026-07-31T21:00:00.000Z', '2026-08-31T20:59:59.999Z'],
  [25, '2026-07-24T21:00:00.000Z', '2026-08-24T20:59:59.999Z']
] as const)('offers only complete monthly periods for reports with cycle day %s', (monthStartDay, start, end) => {
  usePreferenceStore.setState({ monthStartDay });
  const onApply = jest.fn();
  renderWithProviders(<DateRangeSheet visible monthlyOnly
    period={todayPeriod(Date.now(), riyadh)}
    onApply={onApply} onDismiss={jest.fn()} />);

  for (const unsupported of ['today', 'yesterday', 'thisWeek', 'lastWeek']) {
    expect(screen.queryByTestId(`date-period-option-${unsupported}`)).toBeNull();
  }
  fireEvent.press(screen.getByTestId('date-period-option-thisMonth'));
  expect(onApply).toHaveBeenCalledWith({
    kind: 'month', periodStart: Date.parse(start), periodEnd: Date.parse(end)
  });
});

it('selects a historical complete monthly cycle without offering an arbitrary end date', () => {
  usePreferenceStore.setState({ monthStartDay: 25 });
  const onApply = jest.fn();
  renderWithProviders(<DateRangeSheet visible monthlyOnly
    period={todayPeriod(Date.now(), riyadh)}
    onApply={onApply} onDismiss={jest.fn()} />);
  fireEvent.press(screen.getByTestId('date-period-option-custom'));
  expect(screen.queryByLabelText('End date')).toBeNull();
  fireEvent.press(screen.getByLabelText('Date within monthly period'));
  act(() => {
    jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0].onChange?.(
      { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2026, 5, 10)
    );
  });
  fireEvent.press(screen.getByText('Apply range'));
  expect(onApply).toHaveBeenCalledWith({
    kind: 'month',
    periodStart: Date.parse('2026-05-24T21:00:00.000Z'),
    periodEnd: Date.parse('2026-06-24T20:59:59.999Z')
  });
});

it('keeps the iOS native modal mounted while dismissal finishes', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const period = todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh);
  const view = renderWithProviders(<DateRangeSheet
    visible={false} period={period} onApply={jest.fn()} onDismiss={jest.fn()}
  />);
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
});

it('defers hidden preset labels and refreshes them when the sheet reopens', () => {
  const period = todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh);
  const formatSpan = jest.spyOn(periodFormatting, 'formatDaySpan');
  const props = { period, onApply: jest.fn(), onDismiss: jest.fn() };
  function Journey() {
    const [visible, setVisible] = React.useState(false);
    return <>
      <Button title="Open period" onPress={() => setVisible(true)} />
      <DateRangeSheet {...props} visible={visible} />
    </>;
  }
  renderWithProviders(<Journey />);
  expect(screen.queryByTestId('date-period-option-today')).toBeNull();
  expect(formatSpan).not.toHaveBeenCalled();
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 23, 12));
  fireEvent.press(screen.getByRole('button', { name: /open period/i }));
  expect(screen.getByText('23 August 2026')).toBeTruthy();
  fireEvent.press(screen.getByTestId('date-period-option-today'));
  expect(props.onApply).toHaveBeenCalledWith({
    kind: 'custom', periodStart: Date.UTC(2026, 7, 22, 21),
    periodEnd: Date.UTC(2026, 7, 23, 21) - 1
  });
});

it('renders the 7 date range options in Arabic RTL with instruction text', () => {
  changeLocale('ar');
  usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh)}
      onApply={jest.fn()}
      onDismiss={jest.fn()}
    />
  );

  expect(screen.getByText('اختر نطاق التاريخ')).toBeTruthy();
  expect(
    screen.getByText('اختر واحدًا من النطاقات المحددة أدناه')
  ).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
  expect(screen.getByTestId('date-period-option-custom')).toHaveStyle({
    flexDirection: 'row-reverse'
  });

  // 1. Custom Range
  expect(screen.getByText('نطاق مخصص')).toBeTruthy();
  expect(screen.getByText('اختر تاريخ البداية والنهاية المحددة')).toBeTruthy();
  expect(screen.getByText('نطاق مخصص').props.numberOfLines).toBeUndefined();
  expect(
    screen.getByText('اختر تاريخ البداية والنهاية المحددة').props.numberOfLines
  ).toBeUndefined();

  // 2. Today
  expect(screen.getByText('اليوم')).toBeTruthy();
  expect(screen.getByText('22 أغسطس 2026')).toBeTruthy();

  // 3. Yesterday
  expect(screen.getByText('أمس')).toBeTruthy();
  expect(screen.getByText('21 أغسطس 2026')).toBeTruthy();

  // 4. This Week
  expect(screen.getByText('هذا الأسبوع')).toBeTruthy();
  expect(screen.getByText('17 – 22 أغسطس 2026')).toBeTruthy();

  // 5. Last Week
  expect(screen.getByText('الأسبوع الماضي')).toBeTruthy();
  expect(screen.getByText('10 – 16 أغسطس 2026')).toBeTruthy();

  // 6. This Month
  expect(screen.getByText('هذا الشهر')).toBeTruthy();
  expect(screen.getByText('1 – 22 أغسطس 2026')).toBeTruthy();

  // 7. Last Month
  expect(screen.getByText('الشهر الماضي')).toBeTruthy();
  expect(screen.getByText('1 – 31 يوليو 2026')).toBeTruthy();

  // Today is selected
  expect(
    screen.getByTestId('date-period-option-today')
  ).toHaveAccessibilityState({
    selected: true
  });
  expect(
    screen.getByTestId('date-period-option-custom')
  ).toHaveAccessibilityState({
    selected: false
  });

  fireEvent.press(screen.getByTestId('date-period-option-custom'));
  expect(screen.getByLabelText('رجوع')).toHaveStyle({
    alignSelf: 'flex-end'
  });
});

it('renders the 7 date range options in English LTR with instruction text', () => {
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh)}
      onApply={jest.fn()}
      onDismiss={jest.fn()}
    />
  );

  expect(screen.getByText('Choose Date Range')).toBeTruthy();
  expect(
    screen.getByText('Choose one of the specified ranges below')
  ).toBeTruthy();

  expect(screen.getByText('Custom Range')).toBeTruthy();
  expect(screen.getByText('Choose a specific start and end date')).toBeTruthy();
  expect(screen.getByText('Custom Range').props.numberOfLines).toBeUndefined();
  expect(
    screen.getByText('Choose a specific start and end date').props.numberOfLines
  ).toBeUndefined();
  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByText('Yesterday')).toBeTruthy();
  expect(screen.getByText('This Week')).toBeTruthy();
  expect(screen.getByText('Last Week')).toBeTruthy();
  expect(screen.getByText('This Month')).toBeTruthy();
  expect(screen.getByText('Last Month')).toBeTruthy();
});

it('features custom range and groups presets without repeated calendar icons', () => {
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh)}
      onApply={jest.fn()}
      onDismiss={jest.fn()}
    />
  );

  expect(screen.getByTestId('date-period-presets')).toHaveStyle({
    backgroundColor: lightThemeColors.surfaces.card,
    borderRadius: radius.card
  });
  expect(screen.getByTestId('date-period-option-custom')).toHaveStyle({
    minHeight: 64
  });
  expect(screen.getByTestId('date-period-option-today')).toHaveStyle({
    minHeight: 56
  });
  expect(screen.getByTestId('date-period-icon-custom')).toBeTruthy();
  expect(screen.queryByTestId('date-period-icon-today')).toBeNull();
});

it('applies preset date periods immediately upon clicking', () => {
  const onApply = jest.fn();
  const onDismiss = jest.fn();
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh)}
      onApply={onApply}
      onDismiss={onDismiss}
    />
  );

  fireEvent.press(screen.getByTestId('date-period-option-thisWeek'));
  expect(onApply).toHaveBeenCalledWith(
    thisWeekPeriod(Date.UTC(2026, 7, 22, 12), riyadh)
  );
  expect(onDismiss).toHaveBeenCalled();
});

it('opens custom range picker and applies custom date range', () => {
  const onApply = jest.fn();
  const onDismiss = jest.fn();
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.UTC(2026, 7, 22, 12), riyadh)}
      onApply={onApply}
      onDismiss={onDismiss}
    />
  );

  fireEvent.press(screen.getByTestId('date-period-option-custom'));
  expect(screen.getByLabelText('Start date')).toBeTruthy();
  expect(screen.getByLabelText('End date')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Start date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[0][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
        new Date(2026, 7, 2)
      );
  });
  fireEvent.press(screen.getByLabelText('End date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[1][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
        new Date(2026, 7, 17)
      );
  });
  expect(screen.getByText('16 days selected')).toBeTruthy();
  fireEvent.press(screen.getByText('Apply range'));

  expect(onApply).toHaveBeenCalledWith(
    customPeriod(Date.UTC(2026, 7, 2), Date.UTC(2026, 7, 17), riyadh)
  );
  expect(onDismiss).toHaveBeenCalled();
});

it('round-trips New York picker dates without shifting them backward', () => {
  const newYork = {
    timeZone: 'America/New_York',
    monthStartDay: 1
  } as const;
  usePreferenceStore.setState(newYork);
  const onApply = jest.fn();
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.parse('2026-08-02T16:00:00.000Z'), newYork)}
      onApply={onApply}
      onDismiss={jest.fn()}
    />
  );

  fireEvent.press(screen.getByTestId('date-period-option-custom'));
  fireEvent.press(screen.getByLabelText('Start date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[0][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: -240 } },
        new Date(2026, 7, 2)
      );
  });
  fireEvent.press(screen.getByLabelText('End date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[1][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: -240 } },
        new Date(2026, 7, 17)
      );
  });
  fireEvent.press(screen.getByText('Apply range'));

  expect(onApply).toHaveBeenCalledWith({
    kind: 'custom',
    periodStart: Date.parse('2026-08-02T04:00:00.000Z'),
    periodEnd: Date.parse('2026-08-18T03:59:59.999Z')
  });
});

it('counts selected New York dates inclusively across daylight saving time', () => {
  const newYork = {
    timeZone: 'America/New_York',
    monthStartDay: 1
  } as const;
  usePreferenceStore.setState(newYork);
  renderWithProviders(
    <DateRangeSheet
      visible
      period={todayPeriod(Date.parse('2026-03-07T17:00:00.000Z'), newYork)}
      onApply={jest.fn()}
      onDismiss={jest.fn()}
    />
  );

  fireEvent.press(screen.getByTestId('date-period-option-custom'));
  fireEvent.press(screen.getByLabelText('Start date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[0][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: -300 } },
        new Date(2026, 2, 7)
      );
  });
  fireEvent.press(screen.getByLabelText('End date'));
  act(() => {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mock.calls[1][0].onChange?.(
        { type: 'set', nativeEvent: { timestamp: 0, utcOffset: -240 } },
        new Date(2026, 2, 9)
      );
  });

  expect(screen.getByText('3 days selected')).toBeTruthy();
});
