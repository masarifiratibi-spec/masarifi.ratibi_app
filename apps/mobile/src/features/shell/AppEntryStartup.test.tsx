import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import AppEntry from '@app/index';
import {
  LiveIdentityStatusContext,
  type IdentityStatus
} from '@/services/live/clerk-context';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { StartupLoadingBoundary } from '@/design-system/components/feedback/StartupLoadingBoundary';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props)
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.getState().reset();
  useAppShellStore.setState({
    hydrated: true,
    session: authenticatedSession,
    profileSetupStatus: 'complete'
  });
  usePreferenceStore.setState({
    hydrated: true,
    firstLaunchOnboardingCompleted: true,
    locale: 'ar'
  });
});

it.each(['loading', 'sso'] as const)(
  'replaces identity %s with the simple wait and releases the ready destination immediately',
  (status) => {
    const retry = jest.fn();
    const entry = (identityStatus: IdentityStatus) => (
      <LiveIdentityStatusContext.Provider
        value={{ status: identityStatus, retry }}
      >
        <AppEntry />
      </LiveIdentityStatusContext.Provider>
    );
    const screen = render(entry(status));
    expect(
      screen.getByRole('progressbar', { name: 'جارٍ تجهيز بياناتك…' })
    ).toBeOnTheScreen();
    expect(mockRedirect).not.toHaveBeenCalled();
    screen.rerender(entry('ready'));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/home' });
  }
);

it.each(['preferences', 'shell', 'profile'] as const)(
  'waits only for the existing %s gate',
  (gate) => {
    if (gate === 'preferences')
      usePreferenceStore.setState({ hydrated: false });
    if (gate === 'shell') useAppShellStore.setState({ hydrated: false });
    if (gate === 'profile')
      useAppShellStore.setState({ profileSetupStatus: 'loading' });
    const screen = render(<AppEntry />);
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
    act(() => {
      usePreferenceStore.setState({ hydrated: true });
      useAppShellStore.setState({
        hydrated: true,
        profileSetupStatus: 'complete'
      });
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/home' });
  }
);

it('keeps the existing profile failure and retry, then releases the recovered destination', () => {
  useAppShellStore.setState({ profileSetupStatus: 'error' });
  const screen = render(<AppEntry />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  act(() => useAppShellStore.setState({ profileSetupStatus: 'complete' }));
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/home' });
});

it('admits an already allowed saved destination without inserting a loading frame', () => {
  useAppShellStore.setState({ pendingDestination: '/(tabs)/reports' });
  const screen = render(<AppEntry />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/reports' });
});

it.each([
  'identity-unavailable',
  'identity-error',
  'profile-unavailable',
  'profile-error'
] as const)(
  'reveals recovery outside the global startup cover for %s',
  (failure) => {
    const profileFailure = failure.startsWith('profile-');
    if (profileFailure)
      useAppShellStore.setState({
        profileSetupStatus:
          failure === 'profile-error' ? 'error' : 'unavailable'
      });
    const screen = render(
      <StartupLoadingBoundary>
        <LiveIdentityStatusContext.Provider
          value={{
            status: profileFailure
              ? 'ready'
              : failure === 'identity-error'
                ? 'error'
                : 'unavailable',
            retry: jest.fn()
          }}
        >
          <AppEntry />
        </LiveIdentityStatusContext.Provider>
      </StartupLoadingBoundary>
    );
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'إعادة المحاولة' })
    ).toBeOnTheScreen();
  }
);
