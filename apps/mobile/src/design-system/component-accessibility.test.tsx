import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { minTouchTarget } from './tokens';
import { createTiming } from './motion';
import { renderWithProviders } from '@/test-utils/render';
import {
  AccessibleChartFrame,
  ActionButton,
  BottomTabBar,
  DesignIcon,
  IconButton,
  NotificationBadge
} from './index';

describe('public design-system accessibility contract', () => {
  it('exports public components with names, roles, states, and minimum targets', () => {
    const screen = renderWithProviders(
      <>
        <ActionButton label="Save changes" loading onPress={jest.fn()} />
        <IconButton icon="search" label="Search" onPress={jest.fn()} />
        <BottomTabBar selected="home" tabs={[{ key: 'home', label: 'Home' }]} />
      </>
    );

    expect(screen.getByLabelText('Save changes').props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true
    });
    const buttonStyle = StyleSheet.flatten(screen.getByLabelText('Save changes').props.style);
    expect(buttonStyle.minHeight).toBeGreaterThanOrEqual(minTouchTarget);
    expect(buttonStyle.minWidth).toBeGreaterThanOrEqual(minTouchTarget);
    expect(screen.getByLabelText('Search')).toHaveStyle({
      minHeight: minTouchTarget,
      minWidth: minTouchTarget
    });
    expect(screen.getByLabelText('Home').props.accessibilityRole).toBe('tab');
    expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('keeps reduced motion immediate and decorative subtrees hidden', () => {
    const value = new Animated.Value(0);
    const screen = renderWithProviders(
      <>
        <NotificationBadge count={2} label="Decorative notifications" decorative />
        <DesignIcon name="info" label="Decorative info" decorative testID="decorative-icon" />
      </>
    );

    expect(createTiming(value, 1, 'dialog', true)).toBeNull();
    expect((value as unknown as { __getValue: () => number }).__getValue()).toBe(1);
    const hosts = screen.UNSAFE_getAllByType(View);
    expect(
      hosts.find((node) => node.props.importantForAccessibility === 'no-hide-descendants')?.props
    ).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants'
    });
    expect(screen.UNSAFE_getAllByType(DesignIcon)[0].props).toMatchObject({
      decorative: true
    });
    const decorativeIcon = screen
      .UNSAFE_getAllByType(Text)
      .find((node) => node.props.testID === 'decorative-icon');
    expect(decorativeIcon?.props.importantForAccessibility).toBe(
      'no-hide-descendants'
    );
  });

  it('exposes chart summary and drill-down as navigable accessibility metadata', () => {
    const screen = renderWithProviders(
      <AccessibleChartFrame
        question="Where did money go?"
        summary="Food is highest"
        drillDownLabel="Open supporting records"
        onDrillDown={jest.fn()}
      >
        <Text>Chart body</Text>
      </AccessibleChartFrame>
    );

    const chart = screen.getByLabelText('Where did money go? Food is highest');
    expect(chart.props.accessibilityRole).toBe('image');
    expect(screen.getByLabelText('Open supporting records').props.accessibilityRole).toBe(
      'button'
    );
  });
});
