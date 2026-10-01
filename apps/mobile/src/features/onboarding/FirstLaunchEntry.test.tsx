import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import AppEntry from '@app/index';
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

it('shows terminal profile failure with Retry and does not render protected content', () => {
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
});
