import React from 'react';
import { Pressable } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor
} from '@testing-library/react-native';

import type {
  BiometricResult,
  BiometricService
} from '@/services/contracts/app-shell-service';
import type { PinCredential } from '@/domain/app-shell';
import { createPinCredential } from '@/features/security/privacy-lock';
import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { renderWithProviders } from '@/test-utils/render';
import { UnlockScreen } from './UnlockScreen';

let credential: PinCredential;

beforeAll(async () => {
  const result = await createPinCredential('123456', '123456', async () =>
    Uint8Array.from({ length: 16 }, (_, index) => index)
  );
  if (!('credential' in result)) throw new Error('expected test credential');
  credential = result.credential;
});

function deferredBiometric() {
  let resolve!: (result: BiometricResult) => void;
  const authenticate = jest.fn(
    () =>
      new Promise<BiometricResult>((complete) => {
        resolve = complete;
      })
  );
  const cancel = jest.fn(async () => undefined);
  return {
    resolve,
    service: {
      getAvailability: async () => ({
        status: 'supported' as const,
        kinds: ['face' as const]
      }),
      authenticate,
      cancel
    },
    authenticate,
    cancel,
    getResolve: () => resolve
  };
}

function RerenderHarness({
  biometricService
}: {
  biometricService: BiometricService;
}) {
  const [, rerender] = React.useState(0);
  return (
    <>
      <Pressable
        accessibilityLabel="rerender unlock"
        onPress={() => rerender((value) => value + 1)}
      />
      <UnlockScreen biometricService={biometricService} />
    </>
  );
}

describe('UnlockScreen', () => {
  it('unlocks once after the single automatic biometric attempt', async () => {
    const onUnlock = jest.fn();
    const biometricService = createMockBiometricService(
      'supported',
      'authenticated',
      ['face']
    );
    renderWithProviders(
      <UnlockScreen biometricService={biometricService} onUnlock={onUnlock} />
    );

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('does not start a second prompt when a pending screen rerenders', async () => {
    const pending = deferredBiometric();
    renderWithProviders(<RerenderHarness biometricService={pending.service} />);

    fireEvent.press(screen.getByLabelText('rerender unlock'));

    expect(pending.authenticate).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.getResolve()({ status: 'cancelled' });
    });
    expect(
      await screen.findByText(/تم إلغاء التحقق الحيوي/)
    ).toBeOnTheScreen();
  });

  it('cancels biometrics and ignores stale success after choosing PIN', async () => {
    const pending = deferredBiometric();
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricService={pending.service}
        onUnlock={onUnlock}
        pinConfigured
        pinCredential={credential}
      />
    );

    fireEvent.press(screen.getByLabelText('استخدم رمز PIN'));
    await waitFor(() => expect(pending.cancel).toHaveBeenCalledTimes(1));
    await act(async () => {
      pending.getResolve()({ status: 'authenticated' });
    });

    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('رمز من ستة أرقام')).toBeOnTheScreen();
  });

  it('keeps PIN fallback available when native cancellation rejects', async () => {
    const pending = deferredBiometric();
    pending.cancel.mockRejectedValueOnce(new Error('native prompt already closed'));
    renderWithProviders(
      <UnlockScreen
        biometricService={pending.service}
        pinConfigured
        pinCredential={credential}
      />
    );

    fireEvent.press(screen.getByLabelText('استخدم رمز PIN'));

    expect(screen.getByLabelText('رمز من ستة أرقام')).toBeOnTheScreen();
    await waitFor(() => expect(pending.cancel).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['cancelled', /تم إلغاء التحقق الحيوي/],
    ['failed', /تعذر التحقق الحيوي/],
    ['unavailable', /التحقق الحيوي غير متاح/],
    ['locked_out', /التحقق الحيوي مقفل/]
  ] as const)('shows PIN fallback after biometric %s', async (status, message) => {
    renderWithProviders(
      <UnlockScreen
        biometricService={createMockBiometricService('supported', status)}
        pinConfigured
        pinCredential={credential}
      />
    );

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByLabelText('رمز من ستة أرقام')).toBeOnTheScreen();
    expect(screen.getByLabelText('فتح بالتحقق الحيوي')).toBeOnTheScreen();
  });

  it('retries biometrics only after an explicit press', async () => {
    const outcomes: BiometricResult[] = [
      { status: 'cancelled' },
      { status: 'authenticated' }
    ];
    const biometricService: BiometricService = {
      getAvailability: async () => ({
        status: 'supported',
        kinds: ['face']
      }),
      authenticate: jest.fn<Promise<BiometricResult>, []>(
        async () => outcomes.shift() ?? { status: 'failed' }
      ),
      cancel: async () => undefined
    };
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricService={biometricService}
        onUnlock={onUnlock}
        pinConfigured
        pinCredential={credential}
      />
    );

    await screen.findByText(/تم إلغاء التحقق الحيوي/);
    expect(biometricService.authenticate).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText('فتح بالتحقق الحيوي'));

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    expect(biometricService.authenticate).toHaveBeenCalledTimes(2);
  });

  it('unlocks exactly once with the correct PIN', async () => {
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricEnabled={false}
        biometricService={createMockBiometricService()}
        onUnlock={onUnlock}
        pinConfigured
        pinCredential={credential}
      />
    );

    fireEvent.changeText(screen.getByLabelText('رمز من ستة أرقام'), '123456');
    fireEvent.press(screen.getByLabelText('تحقق'));

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByLabelText('تحقق'));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('records a wrong PIN without unlocking', async () => {
    const onInvalidPin = jest.fn(async () => undefined);
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricEnabled={false}
        biometricService={createMockBiometricService()}
        onInvalidPin={onInvalidPin}
        onUnlock={onUnlock}
        pinConfigured
        pinCredential={credential}
      />
    );

    fireEvent.changeText(screen.getByLabelText('رمز من ستة أرقام'), '654321');
    fireEvent.press(screen.getByLabelText('تحقق'));

    await waitFor(() => expect(onInvalidPin).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert')).toHaveTextContent('رمز PIN غير صحيح.');
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('disables PIN entry until the persisted lockout expires', () => {
    let currentTime = 100;
    const props = {
      biometricEnabled: false,
      biometricService: createMockBiometricService(),
      lockedUntil: 200,
      now: () => currentTime,
      pinConfigured: true,
      pinCredential: credential
    };
    function ClockHarness() {
      const [, refresh] = React.useState(0);
      return (
        <>
          <Pressable
            accessibilityLabel="refresh clock"
            onPress={() => refresh((value) => value + 1)}
          />
          <UnlockScreen {...props} />
        </>
      );
    }
    renderWithProviders(<ClockHarness />);

    expect(screen.getByLabelText('رمز من ستة أرقام').props.editable).toBe(false);

    currentTime = 201;
    fireEvent.press(screen.getByLabelText('refresh clock'));
    expect(screen.getByLabelText('رمز من ستة أرقام').props.editable).toBe(true);
  });

  it('offers account recovery when no PIN exists', async () => {
    const onAccountRecovery = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricService={createMockBiometricService(
          'unsupported',
          'unavailable'
        )}
        onAccountRecovery={onAccountRecovery}
      />
    );

    await screen.findByText(/التحقق الحيوي غير متاح/);
    fireEvent.press(screen.getByLabelText('استخدم طريقة أخرى'));
    expect(onAccountRecovery).toHaveBeenCalledTimes(1);
  });

  it('prioritizes expired account sessions over local unlock', () => {
    const authenticate = jest.fn(async () => ({
      status: 'authenticated' as const
    }));
    const biometricService: BiometricService = {
      getAvailability: async () => ({ status: 'supported', kinds: ['face'] }),
      authenticate,
      cancel: async () => undefined
    };
    renderWithProviders(
      <UnlockScreen biometricService={biometricService} sessionExpired />
    );

    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();
    expect(authenticate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('فتح بالتحقق الحيوي')).toBeNull();
  });
});
