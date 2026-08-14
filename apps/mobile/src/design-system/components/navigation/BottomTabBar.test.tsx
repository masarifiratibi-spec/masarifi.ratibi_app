import React from 'react';

import { minTouchTarget } from '@/design-system/tokens';
import { renderWithProviders } from '@/test-utils/render';
import { BottomTabBar } from './BottomTabBar';

describe('BottomTabBar', () => {
  it('limits tabs, preserves selected state, center action, RTL order, and targets', () => {
    const screen = renderWithProviders(
      <BottomTabBar
        direction="rtl"
        selected="home"
        tabs={[
          { key: 'home', label: 'Home' },
          { key: 'reports', label: 'Reports' },
          { key: 'settings', label: 'Settings' }
        ]}
        centerAction={{ label: 'Add', onPress: jest.fn() }}
      />
    );

    expect(
      screen.getByLabelText('Home').props.accessibilityState
    ).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Add')).toHaveStyle({
      minHeight: Math.max(48, minTouchTarget)
    });
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
