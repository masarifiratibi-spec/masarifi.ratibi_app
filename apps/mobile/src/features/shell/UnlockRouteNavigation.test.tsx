import React from 'react';
import { AppState, Platform, Text } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  act,
  renderRouter,
  screen,
  waitFor
} from 'expo-router/testing-library';
import { Stack, router } from 'expo-router';

import UnlockRoute from '@app/security/unlock';
import AppEntry from '@app/index';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { ProtectedRouteGate } from './ProtectedRouteGate';
import {
  authenticatedSession,
  lockedPrivacy
} from '@/test-utils/app-shell-fixtures';

jest.unmock('expo-router');
jest.unmock('@react-navigation/native');
jest.mock('@/services/live/clerk-provider', () => ({
  useLiveClerkSessionKey: () => 'unlock-navigation-session'
}));
jest.mock('@/services/engagement-service', () => ({ notificationService: {} }));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {}
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({}));
jest.mock('@/features/notifications/DevReminderRuntime', () => ({
  DevReminderRuntime: () => null
}));
jest.mock('@/services/live/clerk-context', () => ({
  useLiveIdentityStatus: () => ({ status: 'ready' })
}));
const originalAppState = AppState.currentState;

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  AppState.currentState = originalAppState;
});

test.each(['unknown', 'loading', 'unavailable', 'error'] as const)(
  'unlock returns to bootstrap for a %s profile and resumes its pending destination',
  async (profileSetupStatus) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    AppState.currentState = 'active';
    jest
      .spyOn(LocalAuthentication, 'authenticateAsync')
      .mockResolvedValue({ success: true });
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      privacyLock: lockedPrivacy,
      profileSetupStatus,
      pendingDestination: '/(tabs)/reports'
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    const result = renderRouter(
      {
        _layout: () => (
          <Stack
            screenLayout={({ children }) => (
              <ProtectedRouteGate>{children}</ProtectedRouteGate>
            )}
          />
        ),
        index: AppEntry,
        'security/unlock': UnlockRoute,
        '(tabs)/reports': () => <Text>Reports destination</Text>
      },
      { initialUrl: '/security/unlock' }
    );

    await waitFor(() => expect(result.getSegments()).toEqual([]));
    expect(result.getPathname()).toBe('/');
    expect(screen.queryByTestId('expo-router-unmatched')).toBeNull();
    expect(useAppShellStore.getState().privacyLock?.appLockStatus).toBe(
      'unlocked'
    );
    expect(useAppShellStore.getState().pendingDestination).toBe(
      '/(tabs)/reports'
    );
    act(() => useAppShellStore.setState({ profileSetupStatus: 'complete' }));
    await waitFor(() =>
      expect(screen.getByText('Reports destination')).toBeOnTheScreen()
    );
    expect(result.getPathname()).toBe('/reports');
  }
);

test.each([null, '/(tabs)/reports'] as const)(
  'iOS Face ID returns once to the intended destination without an intermediate Home (pending=%s)',
  async (pendingDestination) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    AppState.currentState = 'active';
    let finishScan!: (result: { success: true }) => void;
    const scan = jest
      .spyOn(LocalAuthentication, 'authenticateAsync')
      .mockReturnValue(
        new Promise((resolve) => {
          finishScan = resolve;
        })
      );
    const replace = jest.spyOn(router, 'replace');
    const homeMounted = jest.fn();
    function HomeDestination() {
      React.useEffect(() => {
        homeMounted();
      }, []);
      return <Text>Unlocked Home destination</Text>;
    }
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      privacyLock: lockedPrivacy,
      profileSetupStatus: 'complete',
      pendingDestination
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    renderRouter(
      {
        _layout: () => (
          <Stack
            screenLayout={({ children }) => (
              <ProtectedRouteGate>{children}</ProtectedRouteGate>
            )}
          />
        ),
        index: () => <Text>Bootstrap destination</Text>,
        'security/unlock': UnlockRoute,
        '(tabs)/home': HomeDestination,
        '(tabs)/reports': () => <Text>Unlocked Reports destination</Text>
      },
      { initialUrl: '/security/unlock' }
    );
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Unlocked Home destination')).toBeNull();
    expect(screen.queryByText('Unlocked Reports destination')).toBeNull();
    await act(async () => finishScan({ success: true }));
    await screen.findByText(
      pendingDestination
        ? 'Unlocked Reports destination'
        : 'Unlocked Home destination'
    );
    expect(useAppShellStore.getState().privacyLock?.appLockStatus).toBe(
      'unlocked'
    );
    expect(replace.mock.calls.map(([href]) => href)).toEqual([
      pendingDestination ?? '/(tabs)/home'
    ]);
    expect(homeMounted).toHaveBeenCalledTimes(pendingDestination ? 0 : 1);
  }
);
