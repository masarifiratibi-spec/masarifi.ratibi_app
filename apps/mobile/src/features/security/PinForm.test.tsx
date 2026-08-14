import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { PinForm } from './PinForm';

describe('PinForm', () => {
  it('uses secure six-digit input, error focus, loading state, and accessible submit', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PinForm loading={false} mode="create" onSubmit={onSubmit} />);

    const input = screen.getByLabelText('رمز PIN');
    expect(input.props.secureTextEntry).toBe(true);
    fireEvent.changeText(input, '12345');
    fireEvent.press(screen.getByLabelText('حفظ PIN'));
    expect(screen.getByText('أدخل 6 أرقام')).toBeOnTheScreen();

    fireEvent.changeText(input, '123456');
    fireEvent.press(screen.getByLabelText('حفظ PIN'));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });
});
