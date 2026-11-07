import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LegalRoute from '@app/(public)/legal';
import { GoogleAuthScreen } from './GoogleAuthScreen';
import { authService } from './auth-flow';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

let mockDocument = 'terms';
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false
  },
  useLocalSearchParams: () => ({ document: mockDocument })
}));
jest.mock('@/services/live/clerk-context', () => ({
  useLiveIdentityStatus: () => ({ status: 'ready' })
}));
afterEach(() => jest.restoreAllMocks());

it.each([
  ['en', 'Terms & Conditions', 'Privacy Policy'],
  ['ar', 'الشروط والأحكام', 'سياسة الخصوصية']
] as const)(
  'bundles both separate draft documents and their version offline in %s',
  (locale, terms, privacy) => {
    changeLocale(locale);
    mockDocument = 'terms';
    const view = renderWithProviders(<LegalRoute />);
    expect(view.getAllByText(terms).length).toBeGreaterThan(0);
    expect(view.getAllByText(/1\.0-draft/).length).toBeGreaterThan(0);
    expect(
      view.getAllByText(/masarifi\.ratibi@gmail\.com/).length
    ).toBeGreaterThan(0);
    expect(view.getByTestId('legal-document-body')).toHaveStyle({
      direction: locale === 'ar' ? 'rtl' : 'ltr'
    });
    fireEvent.press(view.getByRole('button', { name: privacy }));
    expect(router.push).toHaveBeenCalledWith('/legal?document=privacy');
    view.unmount();
  }
);

it('opens the privacy document directly and labels it as a draft without an effective date', () => {
  changeLocale('en');
  mockDocument = 'privacy';
  const view = renderWithProviders(<LegalRoute />);
  expect(
    view.getByText('8. Storage, security and offline copies')
  ).toBeTruthy();
  expect(view.getByText(/not legally approved/i)).toBeTruthy();
  view.unmount();
});

it('prepares unchecked inactive consent and separate links without blocking or recording registration consent', async () => {
  changeLocale('en');
  const signIn = jest
    .spyOn(authService, 'signInWithGoogle')
    .mockResolvedValue({ status: 'cancelled' });
  const view = renderWithProviders(<GoogleAuthScreen />);
  const checkbox = view.getByRole('checkbox');
  expect(checkbox).toHaveAccessibilityState({ checked: false, disabled: true });
  expect(view.getByText(/No consent is recorded/i)).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Terms & Conditions' }));
  expect(router.push).toHaveBeenCalledWith('/legal?document=terms');
  fireEvent.press(view.getByRole('button', { name: 'Privacy Policy' }));
  expect(router.push).toHaveBeenCalledWith('/legal?document=privacy');
  fireEvent.press(view.getByRole('button', { name: 'Continue with Google' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  expect(checkbox).toHaveAccessibilityState({ checked: false });
  view.unmount();
});
