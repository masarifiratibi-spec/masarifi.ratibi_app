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
import UnlockRoute from '@app/security/unlock';
import { translate } from '@/localization/i18n';
import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import {
  authenticatedSession,
  lockedPrivacy,
} from '@/test-utils/app-shell-fixtures';
import { AppPrivacyGate } from './AppPrivacyGate';
import { UnlockScreen } from './UnlockScreen';
import * as demoMode from '@/config/demo-mode';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() }
}));
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
  hasHardwareAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  SecurityLevel: { SECRET: 1 },
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
const mockRequestAccountDeletion = jest.fn();
jest.mock('@/services/mocks/subscription-settings-service', () => ({
  ...jest.requireActual('@/services/mocks/subscription-settings-service'),
  settingsService: jest
    .requireActual('@/services/live/auth-service')
    .createLiveIdentityService({
      request: (...args: unknown[]) => mockRequestAccountDeletion(...args)
    })
}));

const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = jest.mocked(LocalAuthentication.isEnrolledAsync);
const supportedTypes = jest.mocked(
  LocalAuthentication.supportedAuthenticationTypesAsync
);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValue(3);
  mockRequestAccountDeletion.mockReset();
  useAppShellStore.getState().reset();
});

describe('security journey', () => {
  it('opens Security Events from settings outside fixture mode', () => {
    const fixtureMode = jest.spyOn(demoMode, 'isFixtureModeEnabled').mockReturnValue(false);
    try {
      renderWithProviders(<SecuritySettingsRoute />);
      fireEvent.press(screen.getByText(translate('appShell.security.events')));
      expect(router.push).toHaveBeenCalledWith('/security/events');
    } finally {
      fixtureMode.mockRestore();
    }
  });
  it.each([false, true])('visible Security Back uses existing history or More fallback (history=%s)', async hasHistory => {
    jest.mocked(router.canGoBack).mockReturnValue(hasHistory);
    renderWithProviders(<SecuritySettingsRoute />);
    fireEvent.press(screen.getByRole('button', { name: translate('common.back') }));
    if (hasHistory) { expect(router.back).toHaveBeenCalledTimes(1); expect(router.replace).not.toHaveBeenCalled(); }
    else { expect(router.replace).toHaveBeenCalledWith('/(tabs)/more'); expect(router.back).not.toHaveBeenCalled(); }
  });
  it('coalesces Face authentication across an unlock-route remount and preserves the Clerk session', async () => {
    let finish!: (
      result: Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>
    ) => void;
    jest.mocked(LocalAuthentication.authenticateAsync).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      privacyLock: { ...lockedPrivacy, enabled: true }
    });

    const first = renderWithProviders(<UnlockRoute />);
    await waitFor(() =>
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1)
    );
    first.unmount();
    renderWithProviders(<UnlockRoute />);

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
    await waitFor(() =>
      expect(useAppShellStore.getState().privacyLock?.appLockStatus).toBe(
        'unlocked'
      )
    );
    expect(useAppShellStore.getState().session).toEqual(authenticatedSession);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

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

    await useAppShellStore.getState().setPrivacyLock({ ...lockedPrivacy, appLockStatus: 'unlocked', enabled: false });
    expect(useAppShellStore.getState().privacyLock?.enabled).toBe(false);
  });

  it('confirms account deletion without navigating to privacy settings', async () => {
    hasHardware.mockResolvedValue(false);
    useAppShellStore.setState({ session: authenticatedSession });
    mockRequestAccountDeletion.mockResolvedValue({
      id: 'deletion-security',
      status: 'verified',
      requestedAt: '2026-10-16T00:00:00.000Z',
      coolingOffEndsAt: '2099-10-16T00:00:00.000Z',
      completedAt: null,
      retainedCategories: [],
      version: 1
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    renderWithProviders(<SecuritySettingsRoute />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'حذف الحساب' })).toBeEnabled()
    );

    expect(
      screen.getByText(translate('appShell.security.nativeLock'))
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
    await act(async () => {
      actions[1]?.onPress?.();
    });
    await screen.findByText(translate('settings.deletion.status.verified'));
    expect(mockRequestAccountDeletion).toHaveBeenCalledWith(
      '/api/v1/me/deletion-requests',
      expect.objectContaining({ method: 'POST' })
    );
    expect(router.push).not.toHaveBeenCalledWith('/profile/privacy');
    alert.mockRestore();
  });

  it('enables native App Lock only after a successful OS check', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    supportedTypes.mockResolvedValue([2]);
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
      success: true
    });
    useAppShellStore.setState({
      hydrated: true, session: authenticatedSession,
      privacyLock: {
    ...lockedPrivacy,
    appLockStatus: 'unlocked',
    enabled: false
}
    });

    renderWithProviders(<SecuritySettingsRoute />);

    await screen.findByLabelText(
      `${translate('appShell.security.nativeLock')}, ${translate('appShell.security.nativeLockSubtitle')}`
    );
    await waitFor(() => expect(screen.getByLabelText(`${translate('appShell.security.nativeLock')}, ${translate('appShell.security.nativeLockSubtitle')}`)).toHaveAccessibilityState({ disabled: false, checked: false }));
    fireEvent.press(screen.getByLabelText(`${translate('appShell.security.nativeLock')}, ${translate('appShell.security.nativeLockSubtitle')}`));
    await waitFor(() => expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useAppShellStore.getState().privacyLock?.enabled).toBe(
        true
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
});


it('an old auto-lock dialog cannot change the next owner preference', async () => {
  const firstLock = { ...lockedPrivacy, appLockStatus: 'unlocked' as const };
  const nextLock = { enabled: false, autoLockDuration: 'five_minutes' as const, appLockStatus: 'unlocked' as const };
  useAppShellStore.setState({ hydrated: true, session: authenticatedSession, privacyLock: firstLock });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  try {
    renderWithProviders(<SecuritySettingsRoute />);
    fireEvent.press(screen.getByLabelText(`${translate('appShell.security.autoLock.title')}, ${translate('appShell.security.autoLock.immediate')}`));
    const oldChoices = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => { useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'next-owner' }, privacyLock: nextLock }); });
    await act(async () => { oldChoices.find(x => x.text === translate('appShell.security.autoLock.one_minute'))?.onPress?.(); });
    expect(useAppShellStore.getState().privacyLock).toEqual(nextLock);
  } finally { alert.mockRestore(); }
});
