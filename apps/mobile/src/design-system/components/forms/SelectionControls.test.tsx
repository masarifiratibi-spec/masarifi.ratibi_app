import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';
import { fireEvent } from '@testing-library/react-native';

import { minTouchTarget } from '@/design-system/tokens';
import { renderWithProviders } from '@/test-utils/render';
import { CheckboxRow, RadioCard, SwitchRow, Toggle } from './SelectionControls';

describe('SelectionControls', () => {
  it.each(['light', 'dark'] as const)('pairs readable thumb and track colors in %s', mode => {
    const theme = resolveTheme(mode);
    for (const checked of [false, true]) {
      const view = renderWithProviders(
        <ThemeContext.Provider value={{ theme }}>
          <Toggle accessibilityLabel="Tracking" value={checked} onValueChange={jest.fn()} />
        </ThemeContext.Provider>
      );
      const track = view.getByRole('switch').children[0];
      if (typeof track === 'string') throw new Error('Missing switch track');
      const thumb = view.UNSAFE_getByType(Animated.View);
      expect(StyleSheet.flatten(track.props.style).backgroundColor).toBe(
        checked ? theme.colors.interactions.primary : theme.colors.borders.default
      );
      expect(StyleSheet.flatten(thumb.props.style).backgroundColor).toBe(
        checked ? theme.colors.content.inverse : theme.colors.content.secondary
      );
      view.unmount();
    }
  });

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
