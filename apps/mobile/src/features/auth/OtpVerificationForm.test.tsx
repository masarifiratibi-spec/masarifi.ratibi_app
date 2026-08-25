import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { OtpVerificationForm } from './OtpVerificationForm';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';

describe('OtpVerificationForm', () => {
  afterEach(() => changeLocale('ar'));

  it('renders six slots, accepts paste, submits once, and exposes resend state', () => {
    const onSubmit = jest.fn();
    const onResend = jest.fn();

    renderWithProviders(
      <OtpVerificationForm
        resendAvailable={false}
        errorCode="appShell.auth.otp.invalid"
        onResend={onResend}
        onSubmit={onSubmit}
      />
    );

    const slots = screen.getAllByLabelText(/رمز من ستة أرقام/);
    expect(slots).toHaveLength(6);
    fireEvent.changeText(slots[0], '000000');
    fireEvent.press(screen.getByLabelText('تحقق'));
    fireEvent.press(screen.getByLabelText('تحقق'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('000000');
    expect(screen.getByText('الرمز غير صحيح.')).toBeOnTheScreen();
    expect(screen.getByLabelText('إعادة الإرسال متاحة بعد قليل')).toHaveAccessibilityState({
      disabled: true
    });
  });

  it('runs resend when available', () => {
    const onResend = jest.fn();
    renderWithProviders(
      <OtpVerificationForm resendAvailable onResend={onResend} onSubmit={jest.fn()} />
    );

    fireEvent.press(screen.getByLabelText('إعادة إرسال الرمز'));
    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it.each(['ar', 'en'] as const)(
    'keeps OTP slots in an LTR numeric run that fits narrow screens in %s',
    (locale) => {
      changeLocale(locale);
      renderWithProviders(
        <OtpVerificationForm
          resendAvailable
          onResend={jest.fn()}
          onSubmit={jest.fn()}
        />
      );

      expect(screen.getByTestId('otp-slots')).toHaveStyle({
        direction: 'ltr',
        gap: 4,
        justifyContent: 'space-between',
        width: '100%'
      });
      expect(
        screen.getAllByLabelText(
          new RegExp(translate('appShell.auth.otp.code'))
        )
      ).toHaveLength(6);
    }
  );
});
