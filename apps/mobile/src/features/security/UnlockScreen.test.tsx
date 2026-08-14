import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { renderWithProviders } from '@/test-utils/render';
import { UnlockScreen } from './UnlockScreen';

describe('UnlockScreen', () => {
  it('blocks protected content, supports PIN fallback, and reports biometric results', async () => {
    const onUnlock = jest.fn();
    renderWithProviders(
      <UnlockScreen
        biometricService={createMockBiometricService(
          'supported',
          'authenticated'
        )}
        expectedHash="pin:123456"
        onUnlock={onUnlock}
      />
    );

    expect(screen.queryByText('Protected')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('رمز PIN'), '123456');
    fireEvent.press(screen.getByLabelText('فتح'));
    expect(onUnlock).toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('فتح بالبصمة'));
    expect(await screen.findByText('تم الفتح بالبصمة')).toBeOnTheScreen();
  });

  it('prioritizes expired account sessions over local unlock', () => {
    renderWithProviders(
      <UnlockScreen expectedHash="pin:123456" sessionExpired />
    );
    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();
  });

  it('blocks PIN attempts during the temporary lock', () => {
    const onInvalidPin = jest.fn();
    renderWithProviders(
      <UnlockScreen
        expectedHash="pin:123456"
        lockedUntil={200}
        now={() => 100}
        onInvalidPin={onInvalidPin}
      />
    );

    expect(screen.getByLabelText('فتح')).toBeDisabled();
    expect(onInvalidPin).not.toHaveBeenCalled();
  });

  it('reenables PIN entry when the temporary lock expires', () => {
    jest.useFakeTimers();
    const clock = jest.fn(() => 1_000);
    renderWithProviders(
      <UnlockScreen
        expectedHash="pin:123456"
        lockedUntil={31_000}
        now={clock}
      />
    );

    expect(screen.getByLabelText('رمز PIN')).toBeDisabled();
    clock.mockReturnValue(31_000);
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(screen.getByLabelText('رمز PIN')).toBeEnabled();
    jest.useRealTimers();
  });
});
