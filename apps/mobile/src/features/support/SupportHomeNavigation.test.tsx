import React from 'react';
import { screen } from '@testing-library/react-native';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';
import { SupportHomeScreen } from './SupportHomeScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
}));

test.each(['ar', 'en'] as const)(
  'offers contact support without ticket or feedback history in %s',
  async (locale) => {
    changeLocale(locale);
    const theme = resolveTheme('dark');
    renderWithProviders(
      <ThemeContext.Provider value={{ theme }}>
        <SupportHomeScreen />
      </ThemeContext.Provider>
    );
    expect(
      await screen.findByLabelText(translate('support.form.subject'))
    ).toBeTruthy();
    expect(
      screen.getByLabelText(translate('support.form.description'))
    ).toBeTruthy();
    for (const field of ['subject', 'description'] as const) {
      expect(
        screen.getByLabelText(translate(`support.form.${field}`)).props
          .placeholderTextColor
      ).toBe(theme.colors.content.muted);
    }
    expect(
      screen.queryByRole('button', {
        name: translate('support.home.ticketHistory')
      })
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: translate('support.feedback.history')
      })
    ).toBeNull();
  }
);
