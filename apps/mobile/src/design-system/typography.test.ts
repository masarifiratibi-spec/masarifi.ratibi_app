import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import {
  FONT_ASSETS,
  FontGate,
  fontFamilyForLocale,
  typographyStyles
} from './typography';

jest.mock('expo-font', () => ({
  useFonts: jest.fn()
}));

const { useFonts } = jest.requireMock('expo-font') as {
  useFonts: jest.Mock;
};

describe('SPEC-002 typography', () => {
  it('registers local IBM Plex font assets', () => {
    expect(Object.keys(FONT_ASSETS)).toEqual([
      'IBMPlexSans-Regular',
      'IBMPlexSans-SemiBold',
      'IBMPlexSans-Bold',
      'IBMPlexSansArabic-Regular',
      'IBMPlexSansArabic-SemiBold',
      'IBMPlexSansArabic-Bold'
    ]);
  });

  it('selects approved Arabic and English font families', () => {
    expect(fontFamilyForLocale('ar', 'regular')).toBe('IBMPlexSansArabic-Regular');
    expect(fontFamilyForLocale('en', 'bold')).toBe('IBMPlexSans-Bold');
  });

  it('exports hierarchy and tabular amount styles', () => {
    expect(typographyStyles.heading.fontWeight).toBe('700');
    expect(typographyStyles.body.fontWeight).toBe('400');
    expect(typographyStyles.helper.fontSize).toBeLessThan(typographyStyles.body.fontSize);
    expect(typographyStyles.label.fontWeight).toBe('600');
    expect(typographyStyles.amount.fontVariant).toEqual(['tabular-nums']);
  });

  it('holds product text until local fonts are loaded', () => {
    useFonts.mockReturnValue([false, null]);

    const screen = render(
      React.createElement(
        FontGate,
        null,
        React.createElement(Text, null, 'Visible product text')
      )
    );

    expect(screen.queryByText('Visible product text')).toBeNull();
    expect(screen.getByTestId('font-loading')).toBeTruthy();
  });

  it('renders children after local fonts load', () => {
    useFonts.mockReturnValue([true, null]);

    const screen = render(
      React.createElement(
        FontGate,
        null,
        React.createElement(Text, null, 'Visible product text')
      )
    );

    expect(screen.getByText('Visible product text')).toBeTruthy();
  });

  it('keeps the app usable when native font loading fails', () => {
    useFonts.mockReturnValue([false, new Error('font load failed')]);

    const screen = render(
      React.createElement(
        FontGate,
        null,
        React.createElement(Text, null, 'Visible product text')
      )
    );

    expect(screen.getByText('Visible product text')).toBeTruthy();
  });
});
