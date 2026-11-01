import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import AuthPendingRoute from '@app/(public)/auth-pending';
import WelcomeRoute from '@app/(public)/welcome';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import {
  getLegalDocument,
  legalReviewCopy
} from '@/features/legal/legal-documents';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() }
}));

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
        name: locale === 'ar' ? 'مصاريفي وراتبي' : 'Masarifi & Ratibi'
      })
    ).toBeOnTheScreen();
  }
);

test('fresh Welcome shows the selected onboarding before authentication', () => {
  changeLocale('en');
  renderWithProviders(<WelcomeRoute />);
  expect(
    screen.queryByRole('button', { name: 'Continue with Google' })
  ).toBeNull();
  expect(screen.getAllByTestId(/^transaction-example-/)).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Start now' })).toBeEnabled();
});

test.each(['ar', 'en'] as const)(
  'sign-in uses the approved copy without a language selector in %s',
  (locale) => {
    changeLocale(locale);
    renderWithProviders(<AuthPendingRoute />);
    expect(screen.queryByRole('button', { name: 'English' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'العربية' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.queryByText(
        locale === 'ar' ? 'مصاريفي وراتبي' : 'Masarifi & Ratibi'
      )
    ).toBeNull();
    expect(
      screen.getByText(
        locale === 'ar' ? 'حيّاك في مصاريفي وراتبي' : 'Welcome to Masarifi & Ratibi'
      )
    ).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-documents')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', {
        name: getLegalDocument(locale, 'terms').title
      })
    );
    expect(router.push).toHaveBeenCalledWith('/legal?document=terms');
  }
);

test.each(['ar', 'en'] as const)(
  'returning sign-in keeps document links without registration preview messages in %s',
  (locale) => {
    changeLocale(locale);
    renderWithProviders(<AuthPendingRoute />);
    expect(screen.queryByText(legalReviewCopy[locale].preview)).toBeNull();
    expect(screen.queryByText(legalReviewCopy[locale].checkbox)).toBeNull();
    expect(
      screen.getByRole('button', {
        name: getLegalDocument(locale, 'terms').title
      })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: getLegalDocument(locale, 'privacy').title
      })
    ).toBeOnTheScreen();
  }
);
