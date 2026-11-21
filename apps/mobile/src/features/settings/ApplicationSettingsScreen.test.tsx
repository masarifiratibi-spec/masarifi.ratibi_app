import React from 'react';
import { StyleSheet } from 'react-native';
import { screen, within } from '@testing-library/react-native';
import { ApplicationSettingsScreen } from './ApplicationSettingsScreen';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';
import { useAppShellStore } from '@/state/app-shell';
import { radius, spacing } from '@/design-system/tokens';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useAccounts: () => ({ data: [] })
}));
jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => true)
}));
jest.mock('@/features/notifications/ReminderConsentControl', () => {
  const MockView = jest.requireActual('react-native').View;
  return { ReminderConsentControl: () => <MockView testID="notification-control" /> };
});

beforeEach(() => jest.mocked(isMobileAutomationEnabled).mockReturnValue(true));

it.each(['ar', 'en'] as const)('keeps regional labels readable in the dark theme in %s', (locale) => {
  changeLocale(locale);
  const theme = resolveTheme('dark');
  renderWithProviders(<ThemeContext.Provider value={{theme}}><ApplicationSettingsScreen /></ThemeContext.Provider>);
  const regional = within(screen.getByTestId('application-settings-regional-group'));
  for (const key of ['language', 'weekStart', 'currency', 'monthStart'] as const) {
    expect(regional.getByText(translate(`settings.application.${key}`)))
      .toHaveStyle({color: theme.colors.textPrimary});
  }
});

it.each(['en', 'ar'] as const)('puts the notifications card before regional preferences and language in %s', (locale) => {
  changeLocale(locale);
  useAppShellStore.setState({ session: {
    status: 'authenticated', userId: 'owner-a', expiresAt: Date.now() + 60000,
    issuedAt: Date.now(), method: 'google', restoration: 'idle'
  } });
  renderWithProviders(<ApplicationSettingsScreen />);
  const group = screen.getByTestId('application-settings-regional-group');
  const card = screen.getByTestId('application-settings-notifications-card');
  expect(within(card).getByTestId('notification-control')).toBeTruthy();
  expect(screen.getAllByTestId(/application-settings-(notifications-card|regional-group)/)).toEqual([card, group]);
  expect(within(group).getByText(locale === 'ar' ? 'اللغة' : 'Language')).toBeTruthy();
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({
    borderRadius: radius.card,
    padding: spacing.md
  });
});

it('keeps the whole new notification card hidden for flag-off clients', () => {
  jest.mocked(isMobileAutomationEnabled).mockReturnValue(false);
  renderWithProviders(<ApplicationSettingsScreen />);
  expect(screen.queryByTestId('application-settings-notifications-card')).toBeNull();
  expect(screen.queryByTestId('notification-control')).toBeNull();
  expect(screen.getByTestId('application-settings-regional-group')).toBeTruthy();
});
