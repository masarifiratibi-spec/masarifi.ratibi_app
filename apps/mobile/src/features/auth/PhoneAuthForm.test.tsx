import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { PhoneAuthForm } from './PhoneAuthForm';
import { renderWithProviders } from '@/test-utils/render';

describe('PhoneAuthForm', () => {
  it('preserves fields after correction and submits valid input', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PhoneAuthForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('رمز الدولة'), '+999');
    fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), 'abc');
    fireEvent.press(screen.getByLabelText('إرسال الرمز'));

    expect(screen.getByText('أدخل رقم هاتف مدعوم وصحيح.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('abc')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('رمز الدولة'), '+966');
    fireEvent.changeText(screen.getByLabelText('رقم الهاتف'), '\u200f555 0100');
    fireEvent.press(screen.getByLabelText('إرسال الرمز'));

    expect(onSubmit).toHaveBeenCalledWith({
      countryCode: '+966',
      phoneValue: '5550100'
    });
  });

  it('disables submit while loading', () => {
    renderWithProviders(<PhoneAuthForm loading onSubmit={jest.fn()} />);

    expect(screen.getByLabelText('إرسال الرمز')).toHaveAccessibilityState({
      disabled: true,
      busy: true
    });
  });
});
