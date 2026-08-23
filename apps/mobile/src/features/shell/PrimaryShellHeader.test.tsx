import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { lightThemeColors } from '@/design-system/tokens';
import { settingsKeys } from '@/features/settings/settings-queries';
import { changeLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithQueryData } from '@/test-utils/render';
import {
  PrimaryShellHeader,
  profileInitials
} from './PrimaryShellHeader';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const profile = {
  name: 'Abdullah Zordok',
  avatar: 'default',
  phone: null,
  googleAccount: null,
  email: 'abdullah@example.com',
  country: 'SA',
  currency: 'SAR',
  timeZone: 'Asia/Riyadh',
  completion: [],
  version: 1
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
});

it('derives compact initials from the best available identity', () => {
  expect(profileInitials('Abdullah Zordok', null, null)).toBe('AZ');
  expect(profileInitials('Abdullah', null, null)).toBe('AB');
  expect(profileInitials(null, 'dana@example.com', null)).toBe('DA');
  expect(profileInitials(null, null, 'user-demo')).toBe('UD');
});

it('renders real profile initials in the existing accessible More action', () => {
  renderWithQueryData(
    <PrimaryShellHeader origin="/(tabs)/home">
      <Text>Center</Text>
    </PrimaryShellHeader>,
    [[settingsKeys.profile(), profile]]
  );

  const more = screen.getByLabelText(translate('appShell.navigation.more'));
  expect(more).toHaveStyle({ minHeight: 48, minWidth: 48 });
  expect(screen.getByTestId('primary-shell-avatar')).toHaveStyle({
    borderRadius: 999,
    height: 40,
    width: 40
  });
  expect(screen.getByText('AZ')).toHaveStyle({
    fontFamily: 'MasarifiLatin-700'
  });

  fireEvent.press(more);
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(tabs)/more',
    params: { returnTo: '/(tabs)/home' }
  });
});

it('keeps the Reports action on default shared-header callers', () => {
  renderWithQueryData(
    <PrimaryShellHeader origin="/(tabs)/home">
      <Text>Center</Text>
    </PrimaryShellHeader>,
    [[settingsKeys.profile(), profile]]
  );

  fireEvent.press(
    screen.getByLabelText(translate('appShell.navigation.reports'))
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(tabs)/reports',
    params: { returnTo: '/(tabs)/home' }
  });
});

it('can hide Reports without removing the existing More destination', () => {
  renderWithQueryData(
    <PrimaryShellHeader showReports={false} origin="/(tabs)/transactions">
      <Text>Center</Text>
    </PrimaryShellHeader>,
    [[settingsKeys.profile(), profile]]
  );

  expect(
    screen.queryByLabelText(translate('appShell.navigation.reports'))
  ).toBeNull();
  fireEvent.press(screen.getByLabelText(translate('appShell.navigation.more')));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(tabs)/more',
    params: { returnTo: '/(tabs)/transactions' }
  });
});

it('keeps the primary actions visible on the financial hero', () => {
  renderWithQueryData(
    <PrimaryShellHeader appearance="financialHero" origin="/(tabs)/home">
      <Text>Center</Text>
    </PrimaryShellHeader>,
    [[settingsKeys.profile(), profile]]
  );

  expect(
    screen.getByTestId('primary-shell-reports-icon-symbol', {
      includeHiddenElements: true
    })
  ).toHaveProp('tintColor', lightThemeColors.content.onFinancialHero);
  expect(screen.getByText('AZ')).toHaveStyle({
    color: lightThemeColors.content.onFinancialHero
  });
});

it.each([
  ['en', 'ltr', 'row-reverse'],
  ['ar', 'rtl', 'row']
] as const)(
  'keeps Account leading and Reports trailing in the %s top-level header',
  (locale, direction, flexDirection) => {
    changeLocale(locale);
    usePreferenceStore.setState({ locale, direction });
    renderWithQueryData(
      <PrimaryShellHeader origin="/(tabs)/home">
        <Text>Center</Text>
      </PrimaryShellHeader>,
      [[settingsKeys.profile(), profile]]
    );

    expect(screen.getByTestId('primary-shell-header')).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
  }
);

it.each([
  ['en', 'ltr', 'row'],
  ['ar', 'rtl', 'row-reverse']
] as const)(
  'keeps optional back and More in the mirrored %s shared-header slots',
  (locale, direction, flexDirection) => {
    changeLocale(locale);
    usePreferenceStore.setState({ locale, direction });
    const onBack = jest.fn();
    renderWithQueryData(
      <PrimaryShellHeader
        showReports={false}
        onBack={onBack}
        origin="/(tabs)/transactions"
      >
        <Text>Center</Text>
      </PrimaryShellHeader>,
      [[settingsKeys.profile(), profile]]
    );

    const header = screen.getByTestId('primary-shell-header');
    expect(header).toHaveStyle({ writingDirection: 'ltr', flexDirection });
    expect(
      within(header)
        .getAllByRole('button')
        .map((action) => action.props.testID)
    ).toEqual(['primary-shell-back-action', 'primary-shell-more-action']);
    expect(
      screen.queryByLabelText(translate('appShell.navigation.reports'))
    ).toBeNull();

    fireEvent.press(
      screen.getByLabelText(translate('appShell.navigation.back'))
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  }
);
