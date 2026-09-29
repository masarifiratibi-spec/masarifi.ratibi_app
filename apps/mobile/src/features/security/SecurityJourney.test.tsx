import React from 'react';
import { Alert, AppState, Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';

import SecuritySettingsRoute from '@app/security/settings';
import ForgotPinRoute from '@app/security/pin/forgot';
import { translate } from '@/localization/i18n';
import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import {
  lockedPrivacy,
  pinCredential
} from '@/test-utils/app-shell-fixtures';
import { AppPrivacyGate } from './AppPrivacyGate';
import { UnlockScreen } from './UnlockScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() }
}));
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn()
}));
jest.mock('@/features/auth/auth-flow', () => ({
  authService: {
    metadata: { availability: 'available' },
    signInWithGoogle: jest.fn()
  }
}));
jest.mock('@/storage/local-data-reset', () => ({
  resetLocalUserData: jest.fn(async (operationId: string) => ({
    deletedRows: 0,
    operationId
  }))
}));
jest.mock('@/features/settings/settings-queries', () => ({
  usePrivacyRequest: jest.fn()
}));

const requestAccountDeletion = jest.fn();
const { usePrivacyRequest } = jest.requireMock(
  '@/features/settings/settings-queries'
) as { usePrivacyRequest: jest.Mock };
const { authService } = jest.requireMock('@/features/auth/auth-flow') as {
  authService: { signInWithGoogle: jest.Mock };
};

const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = jest.mocked(LocalAuthentication.isEnrolledAsync);
const supportedTypes = jest.mocked(
  LocalAuthentication.supportedAuthenticationTypesAsync
);

beforeEach(() => {
  jest.clearAllMocks();
  usePrivacyRequest.mockReturnValue({
    isPending: false,
    mutate: requestAccountDeletion
  });
  useAppShellStore.getState().reset();
});

describe('security journey', () => {
  it('covers biometric unlock, background masking, expiry precedence, and reset', async () => {
    const onUnlock = jest.fn(() => useAppShellStore.getState().unlock());
    render(
      <UnlockScreen
        biometricService={createMockBiometricService(
          'supported',
          'authenticated'
        )}
        onUnlock={onUnlock}
      />
    );
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('فتح التطبيق')).toBeNull();

    let listener: ((state: string) => void) | null = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, callback) => {
        listener = callback as (state: string) => void;
        return { remove: jest.fn() };
      });
    render(
      <AppPrivacyGate immediate>
        <Text>Protected</Text>
      </AppPrivacyGate>
    );
    act(() => {
      listener?.('background');
    });
    expect(screen.getByText('المحتوى محمي')).toBeOnTheScreen();

    render(
      <UnlockScreen
        biometricService={createMockBiometricService()}
        sessionExpired
      />
    );
    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();

    await useAppShellStore.getState().resetPrivacyLock();
    expect(useAppShellStore.getState().privacyLock).toBeNull();
  });

  it('confirms account deletion without navigating to privacy settings', async () => {
    hasHardware.mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    renderWithProviders(<SecuritySettingsRoute />);
    await act(async () => {});

    expect(
      screen.getByText(translate('appShell.security.biometric.fingerprint'))
    ).toBeTruthy();
    expect(
      screen.getByText(translate('appShell.security.hideBalances'))
    ).toBeTruthy();

    fireEvent.press(screen.getByText(translate('appShell.security.sessions')));
    fireEvent.press(screen.getByText('حذف الحساب'));

    expect(router.push).toHaveBeenCalledWith('/security/sessions');
    expect(alert).toHaveBeenCalledWith(
      'حذف الحساب',
      'هل أنت متأكد من حذف الحساب؟',
      expect.any(Array)
    );

    const actions = alert.mock.calls[0]?.[2] ?? [];
    actions[1]?.onPress?.();
    expect(requestAccountDeletion).toHaveBeenCalledWith({
      kind: 'account_deletion',
      operationId: expect.stringMatching(/^security-account-deletion-/)
    });
    expect(router.push).not.toHaveBeenCalledWith('/profile/privacy');
    alert.mockRestore();
  });

  it('requires an App PIN before biometrics can be enabled', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([2]);

    renderWithProviders(<SecuritySettingsRoute />);

    const biometricRow = await screen.findByLabelText(
      `${translate('appShell.security.biometric.face')}, ${translate('appShell.security.biometric.requiresPin')}`
    );
    expect(biometricRow).toBeDisabled();
  });

  it('enables biometrics only after a successful native check', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([2]);
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
      success: true
    });
    useAppShellStore.setState({
      pinCredential,
      privacyLock: {
        ...lockedPrivacy,
        pinConfigured: true,
        biometricStatus: 'disabled'
      }
    });

    renderWithProviders(<SecuritySettingsRoute />);

    const biometricRow = await screen.findByLabelText(
      `${translate('appShell.security.biometric.face')}, ${translate('appShell.security.biometric.subtitle')}`
    );
    expect(biometricRow).toBeEnabled();

    fireEvent.press(biometricRow);
    await waitFor(() =>
      expect(useAppShellStore.getState().privacyLock?.biometricStatus).toBe(
        'enabled'
      )
    );
  });

  it('shows navigation and updates the auto-lock duration', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([1]);
    useAppShellStore.setState({ privacyLock: lockedPrivacy });

    renderWithProviders(<SecuritySettingsRoute />);

    expect(
      screen.getByLabelText(translate('appShell.navigation.back'))
    ).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    fireEvent.press(
      screen.getByLabelText(
        `${translate('appShell.security.autoLock.title')}, ${translate('appShell.security.autoLock.immediate')}`
      )
    );
    const choices = alert.mock.calls[0]?.[2] ?? [];
    choices
      .find(
        (choice) =>
          choice.text === translate('appShell.security.autoLock.five_minutes')
      )
      ?.onPress?.();

    await waitFor(() =>
      expect(useAppShellStore.getState().privacyLock?.autoLockDuration).toBe(
        'five_minutes'
      )
    );
    alert.mockRestore();
  });

  it('disabling biometrics retains the PIN App Lock', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([1]);

    useAppShellStore.setState({
      pinCredential,
      privacyLock: { ...lockedPrivacy, pinConfigured: true }
    });

    renderWithProviders(<SecuritySettingsRoute />);

    const rowLabel = `${translate('appShell.security.biometric.fingerprint')}, ${translate('appShell.security.biometric.subtitle')}`;
    await waitFor(() => {
      expect(screen.getByLabelText(rowLabel)).toBeEnabled();
    });

    fireEvent.press(screen.getByLabelText(rowLabel));
    await waitFor(() => {
      expect(useAppShellStore.getState()).toMatchObject({
        pinCredential,
        privacyLock: {
          pinConfigured: true,
          biometricStatus: 'disabled'
        }
      });
    });
  });

  it('shows create or change/reset PIN actions from current state', async () => {
    hasHardware.mockResolvedValue(false);
    const first = renderWithProviders(<SecuritySettingsRoute />);
    fireEvent.press(await screen.findByText('إنشاء رمز PIN'));
    expect(router.push).toHaveBeenCalledWith('/security/pin/create');
    first.unmount();

    useAppShellStore.setState({
      pinCredential,
      privacyLock: { ...lockedPrivacy, pinConfigured: true }
    });
    renderWithProviders(<SecuritySettingsRoute />);
    fireEvent.press(await screen.findByText('تغيير رمز PIN'));
    fireEvent.press(screen.getByText('نسيت رمز PIN'));
    expect(router.push).toHaveBeenCalledWith('/security/pin/change');
    expect(router.push).toHaveBeenCalledWith('/security/pin/forgot');
  });

  it('resets App Lock only after authenticated Google reauthentication', async () => {
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'user_live_123456',
        method: 'google',
        issuedAt: 1,
        expiresAt: 2,
        restoration: 'restored'
      },
      pinCredential,
      privacyLock: { ...lockedPrivacy, pinConfigured: true }
    });
    authService.signInWithGoogle.mockResolvedValueOnce({ status: 'cancelled' });
    const cancelled = renderWithProviders(<ForgotPinRoute />);
    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));
    await screen.findByText('تم إلغاء تسجيل الدخول بجوجل.');
    expect(useAppShellStore.getState().privacyLock).not.toBeNull();
    cancelled.unmount();

    authService.signInWithGoogle.mockResolvedValueOnce({
      status: 'failed',
      errorCode: 'appShell.error.offline'
    });
    const failed = renderWithProviders(<ForgotPinRoute />);
    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));
    await screen.findByText('الاتصال غير متاح.');
    expect(useAppShellStore.getState().privacyLock).not.toBeNull();
    failed.unmount();

    authService.signInWithGoogle.mockResolvedValueOnce({
      status: 'authenticated',
      session: {
        status: 'authenticated',
        userId: 'user_live_123456',
        method: 'google',
        issuedAt: 1,
        expiresAt: 2,
        restoration: 'restored'
      }
    });
    renderWithProviders(<ForgotPinRoute />);
    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));
    await waitFor(() => expect(useAppShellStore.getState().privacyLock).toBeNull());
    expect(router.replace).toHaveBeenCalledWith('/security/pin/create');
  });

  it('does not reset App Lock for a different Google owner', async () => {
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'owner-a',
        method: 'google',
        issuedAt: 1,
        expiresAt: 2,
        restoration: 'restored'
      },
      pinCredential,
      privacyLock: { ...lockedPrivacy, pinConfigured: true }
    });
    authService.signInWithGoogle.mockResolvedValueOnce({
      status: 'authenticated',
      session: {
        status: 'authenticated',
        userId: 'owner-b',
        method: 'google',
        issuedAt: 1,
        expiresAt: 2,
        restoration: 'restored'
      }
    });
    renderWithProviders(<ForgotPinRoute />);

    fireEvent.press(screen.getByLabelText('اختر حساب جوجل'));

    await waitFor(() => expect(authService.signInWithGoogle).toHaveBeenCalled());
    expect(useAppShellStore.getState().privacyLock).not.toBeNull();
    expect(router.replace).not.toHaveBeenCalledWith('/security/pin/create');
  });
});
