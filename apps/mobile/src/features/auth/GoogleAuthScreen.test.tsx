import React from 'react';
import { screen } from '@testing-library/react-native';
import AuthPendingRoute from '@app/(public)/auth-pending';
import WelcomeRoute from '@app/(public)/welcome';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

test.each([
  ['ar', 'المتابعة باستخدام Google'],
  ['en', 'Continue with Google']
] as const)(
  'public authentication exposes only Google in %s',
  (locale, label) => {
    changeLocale(locale);
    renderWithProviders(<AuthPendingRoute />);
    expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    expect(
      screen.queryByLabelText(locale === 'ar' ? 'رقم الهاتف' : 'Phone number')
    ).toBeNull();
    expect(
      screen.queryByLabelText(
        locale === 'ar' ? 'رمز من ستة أرقام' : 'Six-digit code'
      )
    ).toBeNull();
    expect(
      screen.getByRole('image', {
        name: locale === 'ar' ? 'مصاريفي' : 'Masarifi'
      })
    ).toBeOnTheScreen();
  }
);

test('fresh Welcome offers the same Google action directly', () => {
  changeLocale('en');
  renderWithProviders(<WelcomeRoute />);
  expect(
    screen.getByRole('button', { name: 'Continue with Google' })
  ).toBeOnTheScreen();
});
