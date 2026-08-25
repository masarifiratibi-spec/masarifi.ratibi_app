import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import GoogleRoute from '@app/(public)/google';
import PhoneRoute from '@app/(public)/phone';
import OtpRoute from '@app/(public)/otp';
import { GoogleAccountSelector } from './GoogleAccountSelector';
import {
  restoreAppShellSession,
  signOutAppShellSession
} from './session-controller';
import { createMockAuthService } from '@/services/mocks/auth-service';
import type { AuthResult } from '@/services/contracts/app-shell-service';
import { useAppShellStore } from '@/state/app-shell';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn()
  }
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn()
}));
jest.mock('@/config/demo-mode', () => ({
  isDemoModeEnabled: () => true,
  isFixtureModeEnabled: () => true
}));
jest.mock('@/storage/local-data-reset', () => ({
  resetLocalUserData: jest.fn(async (operationId: string) => ({
    deletedRows: 0,
    operationId
  }))
}));

beforeEach(() => {
  changeLocale('ar');
  useAppShellStore.getState().reset();
});

describe('AuthenticationJourney', () => {
  it('authenticates by phone and Google from a reset fixture', async () => {
    renderWithProviders(<PhoneRoute />);
    fireEvent.changeText(screen.getByLabelText('رمز الدولة'), '+20');
    fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), '5550100');
    fireEvent.press(screen.getByLabelText('إرسال الرمز'));

    await waitFor(() =>
      expect(jest.mocked(router).push).toHaveBeenCalledWith('/(public)/otp')
    );

    renderWithProviders(<OtpRoute />);
    fireEvent.changeText(screen.getAllByLabelText(/رمز من ستة أرقام/)[0], '000000');
    fireEvent.press(screen.getByLabelText('تحقق'));

    await waitFor(() =>
      expect(useAppShellStore.getState().session?.method).toBe('phone')
    );

    useAppShellStore.getState().reset();
    renderWithProviders(<GoogleRoute />);
    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));

    await waitFor(() =>
      expect(useAppShellStore.getState().session?.method).toBe('google')
    );
  });

  it('restores, expires, signs out, and leaves conflicts without a session', async () => {
    const auth = createMockAuthService();
    await auth.signInWithGoogle();
    await restoreAppShellSession(auth);
    await useAppShellStore.getState().expireSession();

    expect(useAppShellStore.getState().session?.status).toBe('expired');

    await signOutAppShellSession(auth, 'local');
    expect(useAppShellStore.getState().session?.status).toBe('signed_out');

    renderWithProviders(
      <GoogleAccountSelector
        onResult={jest.fn()}
        signIn={async (): Promise<AuthResult> => ({
          status: 'conflict',
          conflictId: 'mock-conflict',
          existingMethod: 'phone'
        })}
      />
    );
    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));

    await waitFor(() =>
      expect(screen.getByText('أكد أنك صاحب الحساب')).toBeOnTheScreen()
    );
    expect(useAppShellStore.getState().session?.status).toBe('signed_out');
  });
});
