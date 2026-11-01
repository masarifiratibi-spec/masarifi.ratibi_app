import React from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react-native';

import AppEntry from '@app/index';
import { LiveIdentityStatusContext } from '@/services/live/clerk-context';
import { changeLocale, translate } from '@/localization/i18n';
import { buildPreferences } from '@/domain/foundation';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props)
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.getState().reset();
  useAppShellStore.setState({ hydrated: true });
  usePreferenceStore.setState({
    ...buildPreferences({ firstLaunchOnboardingCompleted: false }),
    hydrated: true
  });
});

it('routes fresh local state to first-launch onboarding', () => {
  render(<AppEntry />);

  expect(mockRedirect).toHaveBeenCalledWith({ href: '/welcome' });
});

it('routes completed local welcome state to the Clerk integration placeholder', () => {
  usePreferenceStore.setState({ firstLaunchOnboardingCompleted: true });

  render(<AppEntry />);

  expect(mockRedirect).toHaveBeenCalledWith({
    href: '/(public)/auth-pending'
  });
});

it('shows terminal profile failure with Retry and does not render protected content', async () => {
  useAppShellStore.setState({
    profileSetupStatus: 'error',
    session: authenticatedSession
  });
  render(<AppEntry />);
  const revision = useAppShellStore.getState().bootstrapRevision;
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  expect(useAppShellStore.getState().bootstrapRevision).toBe(revision + 1);
  expect(useAppShellStore.getState().profileSetupStatus).toBe('loading');
  expect(mockRedirect).not.toHaveBeenCalled();
  await act(async () => {});
});
it.each(['ar', 'en'] as const)('explains an unavailable startup connection in %s and retries identity loading', (locale) => {
  usePreferenceStore.setState({ locale });
  changeLocale(locale);
  const retry = jest.fn();
  render(<LiveIdentityStatusContext.Provider value={{ status: 'unavailable', retry }}><AppEntry /></LiveIdentityStatusContext.Provider>);
  expect(screen.getByText(translate('appShell.connectionUnavailable.title'))).toBeOnTheScreen();
  expect(screen.getByText(translate('appShell.connectionUnavailable.message'))).toBeOnTheScreen();
  fireEvent.press(screen.getByText(translate('profileSetup.retry')));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('retries profile bootstrap after an unavailable connection and resumes the protected route after recovery', () => {
  usePreferenceStore.setState({ firstLaunchOnboardingCompleted: true });
  useAppShellStore.setState({ profileSetupStatus: 'unavailable', session: authenticatedSession });
  const retryIdentity = jest.fn();
  render(<LiveIdentityStatusContext.Provider value={{ status: 'ready', retry: retryIdentity }}><AppEntry /></LiveIdentityStatusContext.Provider>);
  const revision = useAppShellStore.getState().bootstrapRevision;
  fireEvent.press(screen.getByRole('button', { name: translate('profileSetup.retry') }));
  expect(useAppShellStore.getState().bootstrapRevision).toBe(revision + 1);
  expect(useAppShellStore.getState().profileSetupStatus).toBe('loading');
  expect(retryIdentity).not.toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
  act(() => useAppShellStore.setState({ profileSetupStatus: 'complete' }));
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/home' });
});
