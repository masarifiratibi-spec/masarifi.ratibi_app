import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AuthPendingScreen } from '@app/(public)/auth-pending';
import { changeLocale } from '@/localization/i18n';
import type {
  AuthResult,
  AuthService,
  PhoneVerificationAttempt
} from '@/services/contracts/app-shell-service';
import { renderWithProviders } from '@/test-utils/render';

const authenticated: Extract<AuthResult, { status: 'authenticated' }> = {
  status: 'authenticated',
  session: {
    status: 'authenticated',
    userId: 'user_staging',
    method: 'phone',
    issuedAt: 1,
    expiresAt: 2,
    restoration: 'restored'
  }
};

const phoneAttempt: PhoneVerificationAttempt = {
  sessionId: 'attempt-1',
  countryCode: '+966',
  phoneValue: '500000000',
  codeLength: 6,
  status: 'sent',
  issuedAt: 1,
  resendAvailableAt: 1,
  invalidAttempts: 0,
  replacedBy: null
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('ar');
});

test('validates the phone locally before starting Clerk verification', async () => {
  const auth = createAuth();
  renderScreen(auth);

  fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), '12');
  fireEvent.press(screen.getByRole('button', { name: 'إرسال الرمز' }));

  expect(
    await screen.findByText('أدخل رقم هاتف مدعوم وصحيح.')
  ).toBeOnTheScreen();
  expect(auth.startPhone).not.toHaveBeenCalled();
});

test('completes phone verification with the existing Clerk auth service', async () => {
  const auth = createAuth();
  auth.startPhone.mockResolvedValue(phoneAttempt);
  auth.verifyPhone.mockResolvedValue(authenticated);
  const onAuthenticated = jest.fn();
  renderScreen(auth, onAuthenticated);

  fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), '500 000 000');
  fireEvent.press(screen.getByRole('button', { name: 'إرسال الرمز' }));

  expect(await screen.findByText('أدخل رمز التحقق')).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText('رمز من ستة أرقام'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'تحقق' }));

  await waitFor(() =>
    expect(auth.verifyPhone).toHaveBeenCalledWith({
      sessionId: 'attempt-1',
      code: '123456'
    })
  );
  expect(onAuthenticated).toHaveBeenCalledWith(authenticated.session);
});

test('shows Clerk verification failures without authenticating', async () => {
  const auth = createAuth();
  auth.startPhone.mockResolvedValue(phoneAttempt);
  auth.verifyPhone.mockResolvedValue({
    status: 'failed',
    errorCode: 'invalid'
  });
  const onAuthenticated = jest.fn();
  renderScreen(auth, onAuthenticated);

  fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), '500000000');
  fireEvent.press(screen.getByRole('button', { name: 'إرسال الرمز' }));
  fireEvent.changeText(
    await screen.findByLabelText('رمز من ستة أرقام'),
    '123456'
  );
  fireEvent.press(screen.getByRole('button', { name: 'تحقق' }));

  expect(await screen.findByText('الرمز غير صحيح.')).toBeOnTheScreen();
  expect(onAuthenticated).not.toHaveBeenCalled();
});

test('completes Google authentication with the existing Clerk auth service', async () => {
  const auth = createAuth();
  auth.signInWithGoogle.mockResolvedValue(authenticated);
  const onAuthenticated = jest.fn();
  renderScreen(auth, onAuthenticated);

  fireEvent.press(screen.getByRole('button', { name: 'اختر حساب جوجل' }));

  await waitFor(() =>
    expect(onAuthenticated).toHaveBeenCalledWith(authenticated.session)
  );
});

test('renders the same auth methods in English', () => {
  changeLocale('en');
  renderScreen(createAuth());

  expect(screen.getByText('Sign in securely')).toBeOnTheScreen();
  expect(screen.getByLabelText('Phone number')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Choose Google account' })
  ).toBeOnTheScreen();
});

function renderScreen(auth: AuthService, onAuthenticated = jest.fn()) {
  renderWithProviders(
    <AuthPendingScreen auth={auth} onAuthenticated={onAuthenticated} />
  );
}

function createAuth(): jest.Mocked<AuthService> {
  return {
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    restoreSession: jest.fn(),
    touchActivity: jest.fn(),
    signOut: jest.fn()
  };
}
