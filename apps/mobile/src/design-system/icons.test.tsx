import React from 'react';
import { render } from '@testing-library/react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { DesignIcon, directionalIconNames } from './icons';
import { iconSize } from './tokens';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({
    testID,
    accessibilityLabel,
    size,
    style
  }: {
    testID?: string;
    accessibilityLabel?: string;
    size?: number;
    style?: StyleProp<TextStyle>;
  }) => {
    const ReactActual = jest.requireActual('react') as typeof React;
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return ReactActual.createElement(
      Text,
      { testID, accessibilityLabel, style },
      String(size)
    );
  }
}));

describe('SPEC-002 icons', () => {
  it('uses approved token sizes and accessible labels', () => {
    const screen = render(
      <DesignIcon name="search" label="Search transactions" size="md" />
    );

    expect(screen.getByLabelText('Search transactions')).toHaveTextContent(
      String(iconSize.md)
    );
  });

  it('mirrors directional icons in RTL', () => {
    const screen = render(
      <DesignIcon name="back" label="Back" direction="rtl" testID="back-icon" />
    );

    expect(screen.getByTestId('back-icon')).toHaveStyle({
      transform: [{ scaleX: -1 }]
    });
  });

  it('does not mirror non-directional icons in RTL', () => {
    const screen = render(
      <DesignIcon name="settings" label="Settings" direction="rtl" testID="settings-icon" />
    );

    expect(screen.getByTestId('settings-icon')).not.toHaveStyle({
      transform: [{ scaleX: -1 }]
    });
  });

  it('declares the directional icon set explicitly', () => {
    expect(directionalIconNames).toEqual(['back', 'forward', 'chevronStart', 'chevronEnd']);
  });
});
