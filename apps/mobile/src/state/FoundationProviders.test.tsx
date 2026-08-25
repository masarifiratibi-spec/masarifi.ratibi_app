import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { resolveTheme } from '@/design-system/theme';
import { usePreferenceStore } from '@/state/preferences';
import { FoundationProviders } from './FoundationProviders';

const mockNavigationTheme = jest.fn();

jest.mock('@react-navigation/native', () => ({
  DefaultTheme: {
    fonts: {
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '900' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      regular: { fontFamily: 'System', fontWeight: '400' }
    }
  },
  ThemeProvider: ({
    children,
    value
  }: {
    children: React.ReactNode;
    value: unknown;
  }) => {
    mockNavigationTheme(value);
    return <>{children}</>;
  }
}));

it('keeps nested navigators light while dark mode is disabled', () => {
  usePreferenceStore.setState({ hydrated: true, theme: 'dark' });

  render(
    <FoundationProviders>
      <></>
    </FoundationProviders>
  );

  const colors = resolveTheme('light', 'light').colors;
  expect(mockNavigationTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({
      dark: false,
      colors: expect.objectContaining({
        background: colors.surfaces.page,
        card: colors.surfaces.card,
        text: colors.content.primary
      })
    })
  );
});

it('uses the web-safe writing direction without passing direction as a style', () => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  usePreferenceStore.setState({
    direction: 'rtl',
    hydrated: true,
    locale: 'ar'
  });

  try {
    render(
      <FoundationProviders>
        <></>
      </FoundationProviders>
    );

    expect(screen.getByTestId('foundation-direction-root')).toHaveStyle({
      writingDirection: 'rtl'
    });
    expect(screen.getByTestId('foundation-direction-root')).not.toHaveStyle({
      direction: 'rtl'
    });
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform
    });
  }
});
