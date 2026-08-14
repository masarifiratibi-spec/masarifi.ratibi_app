import React, { useState } from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders visible label, helper, validation, keyboard type, and preserves value', () => {
    function Harness() {
      const [value, setValue] = useState('120');
      return (
        <FormField
          label="Amount"
          value={value}
          onChangeText={setValue}
          variant="amount"
          helperText="Enter the transaction amount"
          errorText="Amount is required"
        />
      );
    }

    const screen = renderWithProviders(<Harness />);
    const input = screen.getByLabelText('Amount');

    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByText('Enter the transaction amount')).toBeTruthy();
    expect(screen.getByText('Amount is required')).toBeTruthy();
    expect(input.props.keyboardType).toBe('decimal-pad');
    fireEvent.changeText(input, '250');
    expect(input.props.value).toBe('250');
  });
});
