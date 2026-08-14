import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { minTouchTarget } from '@/design-system/tokens';
import { renderWithProviders } from '@/test-utils/render';
import { CheckboxRow, RadioCard, SwitchRow } from './SelectionControls';

describe('SelectionControls', () => {
  it('renders switch, checkbox, and radio-card selected/disabled states with minimum targets', () => {
    const onChange = jest.fn();
    const screen = renderWithProviders(
      <>
        <SwitchRow label="Hide balances" value onValueChange={onChange} />
        <CheckboxRow label="Include transfers" checked onPress={onChange} />
        <RadioCard label="Monthly" selected disabled onPress={onChange} />
      </>
    );

    fireEvent.press(screen.getByLabelText('Include transfers'));
    expect(onChange).toHaveBeenCalled();
    expect(
      screen.getByLabelText('Hide balances').props.accessibilityState
    ).toMatchObject({ checked: true });
    expect(
      screen.getByLabelText('Monthly').props.accessibilityState
    ).toMatchObject({ selected: true, disabled: true });
    expect(screen.getByLabelText('Include transfers')).toHaveStyle({
      minHeight: Math.max(48, minTouchTarget)
    });
  });
});
