import React, { useState } from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
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
    expect(input.props.placeholderTextColor).toBeTruthy();
    expect(input).toHaveStyle({ textAlign: 'right' });
    fireEvent.changeText(input, '250');
    expect(input.props.value).toBe('250');
  });

  it.each([
    ['ar', 'rtl'],
    ['en', 'ltr']
  ] as const)(
    'keeps numeric values LTR and localized text %s in %s',
    (locale, direction) => {
      changeLocale(locale);
      const screen = renderWithProviders(
        <>
          <FormField
            label="Amount"
            value="1,250.00"
            onChangeText={jest.fn()}
            variant="amount"
          />
          <FormField
            label="Name"
            value="Sample"
            onChangeText={jest.fn()}
          />
        </>
      );

      expect(screen.getByLabelText('Amount')).toHaveStyle({
        writingDirection: 'ltr'
      });
      expect(screen.getByLabelText('Name')).toHaveStyle({
        writingDirection: direction
      });
    }
  );
});
