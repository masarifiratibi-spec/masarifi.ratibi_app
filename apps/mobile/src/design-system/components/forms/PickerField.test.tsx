import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { lightThemeColors, radius } from '@/design-system/tokens';
import { PickerField } from './PickerField';

describe('PickerField', () => {
  it('renders trigger label, selected value, empty value, disabled state, and accessibility', () => {
    const selected = renderWithProviders(
      <PickerField label="Account" value="Main account" onPress={jest.fn()} />
    );
    expect(selected.getByLabelText('Account Main account')).toBeTruthy();
    expect(selected.getByText('Main account')).toBeTruthy();
    expect(selected.getByLabelText('Account Main account')).toHaveStyle({
      backgroundColor: lightThemeColors.surfaces.card,
      borderColor: lightThemeColors.borders.subtle,
      borderRadius: radius.control
    });

    const empty = renderWithProviders(
      <PickerField label="Category" placeholder="Select category" disabled onPress={jest.fn()} />
    );
    const trigger = empty.getByLabelText('Category Select category');
    expect(trigger.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
