import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMockBiometricService } from '@/services/mocks/biometric-service';
import type { BiometricService } from '@/services/contracts/app-shell-service';
import { renderWithProviders } from '@/test-utils/render';
import { UnlockScreen } from './UnlockScreen';

describe('UnlockScreen', () => {
  it('opens biometrics immediately without rendering an unlock page', async () => {
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricService={createMockBiometricService(
          'supported',
          'authenticated'
        )}
        onUnlock={onUnlock}
      />
    );

    expect(screen.queryByText('فتح التطبيق')).toBeNull();
    expect(
      screen.queryByText('استخدم بصمة الإصبع أو الوجه للوصول إلى بياناتك.')
    ).toBeNull();
    expect(screen.queryByLabelText('فتح بالبصمة')).toBeNull();
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('offers only biometric retry after a cancelled prompt', async () => {
    const onUnlock = jest.fn();
    const outcomes: ('cancelled' | 'authenticated')[] = [
      'cancelled',
      'authenticated'
    ];
    const biometricService: BiometricService = {
      getAvailability: async () => ({
        status: 'supported',
        kinds: ['fingerprint']
      }),
      authenticate: async () => ({
        status: outcomes.shift() ?? 'authenticated'
      })
    };

    renderWithProviders(
      <UnlockScreen biometricService={biometricService} onUnlock={onUnlock} />
    );

    expect(await screen.findByText(/تم إلغاء الفتح بالبصمة/)).toBeOnTheScreen();
    expect(screen.queryByText('فتح التطبيق')).toBeNull();
    expect(
      screen.queryByText('استخدم بصمة الإصبع أو الوجه للوصول إلى بياناتك.')
    ).toBeNull();
    expect(
      screen.queryByLabelText('تسجيل الدخول بالحساب بدلًا من ذلك')
    ).toBeNull();
    fireEvent.press(screen.getByLabelText('فتح بالبصمة'));
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('prioritizes expired account sessions over local unlock', () => {
    renderWithProviders(
      <UnlockScreen
        biometricService={createMockBiometricService()}
        sessionExpired
      />
    );

    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();
    expect(screen.queryByLabelText('فتح بالبصمة')).toBeNull();
  });
});
