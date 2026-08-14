import React from 'react';
import { AppState, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SecuritySettingsRoute from '@app/security/settings';
import { translate } from '@/localization/i18n';
import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import { AppPrivacyGate } from './AppPrivacyGate';
import { UnlockScreen } from './UnlockScreen';
import { createPinCredential, resetLock } from './privacy-lock';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.getState().reset();
});

describe('security journey', () => {
  it('covers PIN, biometrics, background mask, expiry precedence, reset, and sign-out', async () => {
    const credential = createPinCredential('123456', '123456');
    expect(credential).toMatchObject({ hash: 'pin:123456' });
    if (!credential.hash) return;

    await useAppShellStore.getState().configurePrivacyLock(credential.hash, 1);
    expect(useAppShellStore.getState().privacyLock).toMatchObject({
      appLockStatus: 'locked'
    });

    const onUnlock = jest.fn(() => useAppShellStore.getState().unlock());
    render(
      <UnlockScreen
        biometricService={createMockBiometricService('supported', 'authenticated')}
        expectedHash={credential.hash}
        onUnlock={onUnlock}
      />
    );
    fireEvent.press(screen.getByLabelText('فتح بالبصمة'));
    expect(await screen.findByText('تم الفتح بالبصمة')).toBeOnTheScreen();

    let listener: ((state: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
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

    render(<UnlockScreen expectedHash={credential.hash} sessionExpired />);
    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();

    await useAppShellStore.getState().resetPrivacyLock();
    expect(useAppShellStore.getState().privacyLock).toBeNull();
    await useAppShellStore.getState().setPrivacyLock(resetLock(1));
    await useAppShellStore.getState().signOut();
    expect(useAppShellStore.getState().session?.status).toBe('signed_out');
    expect(useAppShellStore.getState().privacyLock).toBeNull();
  });

  it('keeps existing controls and links to sessions, events, and local deletion', () => {
    renderWithProviders(<SecuritySettingsRoute />);

    expect(screen.getByText(translate('appShell.security.pin.create'))).toBeTruthy();
    expect(screen.getByText(translate('appShell.security.biometricUnavailable'))).toBeTruthy();
    expect(screen.getByText(translate('appShell.security.autoLock.immediate'))).toBeTruthy();
    expect(screen.getByText(translate('appShell.security.hideBalances'))).toBeTruthy();

    fireEvent.press(screen.getByText(translate('appShell.security.sessions')));
    fireEvent.press(screen.getByText(translate('appShell.security.events')));
    fireEvent.press(screen.getByText(translate('appShell.security.localData')));

    expect(router.push).toHaveBeenCalledWith('/security/sessions');
    expect(router.push).toHaveBeenCalledWith('/security/events');
    expect(router.push).toHaveBeenCalledWith('/profile/privacy');
  });
});
