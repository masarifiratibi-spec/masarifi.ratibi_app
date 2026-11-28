import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Dimensions, Platform } from 'react-native';

import WelcomeRoute from '@app/(public)/welcome';
import { colorTokens } from '@/design-system/tokens';
import { buildPreferences } from '@/domain/foundation';
import { changeLocale } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { savePreferences } from '@/storage/secure-preferences';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() }
}));
jest.mock('@/storage/secure-preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn().mockResolvedValue(undefined)
}));
const mockSavePreferences = jest.mocked(savePreferences);

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  changeLocale('ar');
  usePreferenceStore.setState({
    ...buildPreferences({ firstLaunchOnboardingCompleted: false }),
    hydrated: true
  });
  useAppShellStore.getState().reset();
});

afterEach(() => jest.restoreAllMocks());

it.each([
  [
    'ar',
    'سجّل مصاريفك يدويًا أو بصوتك.',
    'إدخال يدوي',
    'إدخال صوتي',
    'بيانات توضيحية'
  ],
  [
    'en',
    'Track spending manually or by voice.',
    'Manual entry',
    'Voice entry',
    'Example data'
  ]
] as const)(
  'shows only supported entry methods on iOS in %s',
  async (locale, headline, manual, voice, example) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 1 });
    renderWithProviders(<WelcomeRoute />);
    if (locale === 'en') {
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'English' }));
      });
    }
    const title = screen.getByText(headline);
    expect(title.props.children).toBe(headline);
    const description = screen.getByText(
      locale === 'ar'
        ? 'تابع حساباتك وميزانيتك وأهدافك.\nالصوت والمساعد الذكي اختياريان.'
        : 'Manage accounts, budgets, and goals.\nVoice and AI features are optional.'
    );
    const textAlign = locale === 'ar' ? 'right' : 'left';
    expect(screen.getByTestId('first-launch-copy')).toHaveStyle({
      width: '90%',
      alignSelf: 'center',
      marginTop: 24,
      marginBottom: 8
    });
    expect(screen.getByTestId('transaction-example-1')).toHaveStyle({
      width: '90%'
    });
    expect(title).toHaveStyle({
      textAlign,
      fontSize: 30,
      alignSelf: 'stretch'
    });
    expect(title.props).toMatchObject({
      adjustsFontSizeToFit: true,
      numberOfLines: 1
    });
    expect(description).toHaveStyle({
      textAlign,
      fontSize: locale === 'ar' ? 22 : 19
    });
    expect(description.props.numberOfLines).toBeUndefined();
    expect(screen.getByText(manual)).toBeOnTheScreen();
    expect(screen.getByText(voice)).toBeOnTheScreen();
    expect(screen.getAllByLabelText(example)).toHaveLength(3);
    for (const unsupported of [
      'BANK SMS',
      'APPLE PAY',
      'STC PAY',
      'تسجيل تلقائيًا',
      'Auto-saved'
    ]) {
      expect(screen.queryByText(unsupported)).toBeNull();
    }
  }
);

it.each([
  ['ar', 320, 1],
  ['en', 320, 1],
  ['ar', 402, 1.6],
  ['en', 402, 1.6]
] as const)(
  'allows free wrapping in %s at %d pt and font scale %s',
  async (locale, width, fontScale) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width, height: 874, scale: 3, fontScale });
    renderWithProviders(<WelcomeRoute />);
    if (locale === 'en') {
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'English' }));
      });
    }
    const title = screen.getByText(
      locale === 'ar'
        ? 'سجّل مصاريفك يدويًا أو بصوتك.'
        : 'Track spending manually or by voice.'
    );
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.adjustsFontSizeToFit).not.toBe(true);
    expect(title.props.allowFontScaling).not.toBe(false);
    expect(
      screen.getByRole('button', {
        name: locale === 'ar' ? 'ابدأ الحين' : 'Start now'
      })
    ).toBeEnabled();
  }
);

it('renders the Arabic first-launch experience in RTL', () => {
  renderWithProviders(<WelcomeRoute />);

  expect(screen.getByTestId('first-launch-content')).toHaveStyle({
    direction: 'rtl'
  });
  expect(screen.getByTestId('first-launch-language')).toHaveStyle({
    alignSelf: 'flex-start',
    direction: 'rtl'
  });
  expect(
    screen.getByText('سجّل وتابع صرفك بالـ\u2068AI\u2069..\nوبشكل تلقائي.')
  ).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
  expect(screen.getByTestId('first-launch-copy')).toHaveStyle({
    alignItems: 'flex-end',
    direction: 'ltr'
  });
  expect(
    screen.getByText(
      'رسائل البنوك، \u2068Apple Pay\u2069، \u2068mada\u2069، \u2068STC Pay\u2069\nكلها محفوظة تلقائيًا.'
    )
  ).toBeOnTheScreen();
  expect(screen.getByText('ابدأ الحين')).toBeOnTheScreen();
  const transactionExamples = screen.getAllByTestId(/^transaction-example-/);
  expect(transactionExamples).toHaveLength(3);
  screen.getAllByTestId(/^transaction-saved-status-/).forEach((status) => {
    expect(status).toHaveStyle({
      direction: 'ltr',
      flexDirection: 'row-reverse'
    });
  });
  expect(
    screen.getByTestId('transaction-saved-check-1-symbol', {
      includeHiddenElements: true
    }).props
  ).toMatchObject({
    name: 'checkmark',
    tintColor: colorTokens.raw['007A3D']
  });
  expect(screen.getAllByLabelText('تسجيل تلقائيًا')[0]).toHaveStyle({
    color: colorTokens.raw['007A3D']
  });
  expect(
    screen.getByTestId('transaction-saved-check-1', {
      includeHiddenElements: true
    })
  ).toHaveStyle({ height: 16, width: 16 });
  expect(screen.getByTestId('transaction-merchant-1')).toHaveStyle({
    alignItems: 'flex-end'
  });
  expect(screen.getByTestId('transaction-amount-1')).toHaveStyle({
    alignItems: 'flex-start'
  });
  transactionExamples.forEach((example) => {
    expect(example).toHaveStyle({
      direction: 'ltr',
      flexDirection: 'row-reverse',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12
    });
  });
});

it('switches to natural English copy and LTR layout', async () => {
  renderWithProviders(<WelcomeRoute />);

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'English' }));
  });

  expect(screen.getByTestId('first-launch-content')).toHaveStyle({
    direction: 'ltr'
  });
  expect(screen.getByTestId('first-launch-language')).toHaveStyle({
    alignSelf: 'flex-end',
    direction: 'rtl'
  });
  expect(screen.getByText('Track spending automatically with AI.')).toHaveStyle(
    { textAlign: 'left', writingDirection: 'ltr' }
  );
  expect(
    screen.getByText(
      'Bank SMS, Apple Pay, mada, and STC Pay are saved for you.'
    )
  ).toBeOnTheScreen();
  expect(screen.getAllByLabelText('Auto-saved')).toHaveLength(3);
  expect(screen.getByText('Start now')).toBeOnTheScreen();
  expect(usePreferenceStore.getState().firstLaunchOnboardingCompleted).toBe(
    false
  );
});

it('persists completion and opens the temporary Clerk destination', async () => {
  renderWithProviders(<WelcomeRoute />);

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'ابدأ الحين' }));
  });

  expect(usePreferenceStore.getState().firstLaunchOnboardingCompleted).toBe(
    true
  );
  expect(router.replace).toHaveBeenCalledWith('/(public)/auth-pending');
});

it('shows a recoverable error when first-launch persistence fails', async () => {
  mockSavePreferences
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce(undefined);
  renderWithProviders(<WelcomeRoute />);

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'ابدأ الحين' }));
  });

  expect(screen.getByRole('alert')).toHaveTextContent('تعذر الحفظ محليًا.');
  expect(router.replace).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'ابدأ الحين' }));
  });

  expect(router.replace).toHaveBeenCalledWith('/(public)/auth-pending');
});

it('keeps transaction examples presentation-only', () => {
  const shellBefore = useAppShellStore.getState();

  renderWithProviders(<WelcomeRoute />);

  expect(useAppShellStore.getState()).toMatchObject({
    session: shellBefore.session,
    onboarding: shellBefore.onboarding,
    pendingDestination: shellBefore.pendingDestination
  });
  expect(screen.getAllByLabelText('تسجيل تلقائيًا')).toHaveLength(3);
});

it('keeps onboarding free of legal controls and opens the existing sign-in screen from Start', async () => {
  renderWithProviders(<WelcomeRoute />);
  const start = screen.getByRole('button', { name: 'ابدأ الحين' });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'الشروط والأحكام' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'سياسة الخصوصية' })).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  expect(start).toBeEnabled();
  expect(start).toHaveStyle({ backgroundColor: colorTokens.onboarding.start });
  await act(async () => {
    fireEvent.press(start);
  });
  expect(router.replace).toHaveBeenCalledWith('/(public)/auth-pending');
});

it('does not navigate or persist twice while Start is pending', async () => {
  let finish!: () => void;
  mockSavePreferences.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  renderWithProviders(<WelcomeRoute />);
  const start = screen.getByRole('button', { name: 'ابدأ الحين' });
  fireEvent.press(start);
  fireEvent.press(start);
  expect(mockSavePreferences).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  expect(router.replace).toHaveBeenCalledTimes(1);
});
