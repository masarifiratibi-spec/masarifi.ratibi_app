import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { PinForm } from './PinForm';

describe('PinForm', () => {
  it.each([
    ['ar', 'رمز من ستة أرقام', 'تحقق'],
    ['en', 'Six digit code', 'Verify']
  ] as const)('submits one secure six-digit value in %s', async (locale, label, submit) => {
    changeLocale(locale);
    const onSubmit = jest.fn(async () => undefined);
    renderWithProviders(<PinForm onSubmit={onSubmit} />);

    const input = screen.getByLabelText(label);
    expect(input.props).toMatchObject({
      keyboardType: 'number-pad',
      secureTextEntry: true
    });

    fireEvent.changeText(input, '12a34567');
    expect(input.props.value).toBe('123456');
    expect(screen.queryByText('123456')).toBeNull();
    fireEvent.press(screen.getByLabelText(submit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('does not submit an incomplete PIN', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PinForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('رمز من ستة أرقام'), '12345');
    fireEvent.press(screen.getByLabelText('تحقق'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables entry and submission during lockout or loading', () => {
    const onSubmit = jest.fn();
    const { unmount } = renderWithProviders(
      <PinForm disabled errorMessage="محاولات كثيرة." onSubmit={onSubmit} />
    );

    expect(screen.getByLabelText('رمز من ستة أرقام').props.editable).toBe(false);
    expect(screen.getByRole('alert')).toHaveTextContent('محاولات كثيرة.');
    expect(screen.getByLabelText('تحقق')).toBeDisabled();

    unmount();
    renderWithProviders(<PinForm loading onSubmit={onSubmit} />);
    expect(screen.getByLabelText('تحقق')).toBeDisabled();
  });
});
