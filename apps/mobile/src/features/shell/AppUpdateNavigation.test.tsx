import React from 'react';
import { AppState, Text, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import {
  act,
  renderRouter,
  screen,
  waitFor
} from 'expo-router/testing-library';
import AppUpdateRoute from '@app/app-update';
import {
  ProtectedRouteGate,
  NotificationResponseRuntime
} from './ProtectedRouteGate';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { notificationService } from '@/services/engagement-service';
import {
  authenticatedSession,
  signedOutSession,
  lockedPrivacy
} from '@/test-utils/app-shell-fixtures';
import { sanitizeReturnRoute } from './navigation-context';

jest.unmock('expo-router');
jest.unmock('@react-navigation/native');
jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isFixtureModeEnabled: () => false
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { version: '1.0.0' }
  }
}));
jest.mock('@/features/app-update/app-update', () => ({
  ...jest.requireActual('@/features/app-update/app-update'),
  requestUpdatePolicy: jest.fn(async () => ({
    schemaVersion: 1,
    enabled: false,
    release: null,
    storeUrl:
      'https://play.google.com/store/apps/details?id=com.masarifi.mobile'
  }))
}));
jest.mock('@/services/live/clerk-provider', () => ({
  useLiveClerkSessionKey: () => undefined
}));
jest.mock('@/services/engagement-service', () => ({
  notificationService: {
    resolveTarget: jest.fn(),
    revalidateAction: jest.fn(),
    executeAction: jest.fn()
  }
}));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {
    registerCategories: jest.fn(async () => undefined),
    getLastResponse: jest.fn(async () => ({
      kind: 'app_update',
      notificationId: '78c71e06-457f-4f20-95f6-9db73c114a73',
      action: 'view'
    })),
    subscribeToResponses: jest.fn(() => () => {})
  }
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({}));
jest.mock('@/features/notifications/DevReminderRuntime', () => ({
  DevReminderRuntime: () => null
}));

afterEach(() => jest.restoreAllMocks());

test.each(['signed-out', 'locked'] as const)(
  'opens a cold update push through the real shell when %s',
  async (mode) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    AppState.currentState = 'active';
    usePreferenceStore.setState({
      locale: 'en',
      direction: 'ltr',
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    useAppShellStore.setState({
      hydrated: true,
      session: mode === 'locked' ? authenticatedSession : signedOutSession,
      privacyLock: mode === 'locked' ? lockedPrivacy : null,
      profileSetupStatus: 'complete',
      pendingDestination: null
    });
    const view = renderRouter(
      {
        _layout: () => (
          <>
            <NotificationResponseRuntime />
            <Stack
              screenLayout={({ children }) => (
                <ProtectedRouteGate>{children}</ProtectedRouteGate>
              )}
            />
          </>
        ),
        index: () => <Text>Entry</Text>,
        'app-update': AppUpdateRoute,
        accounts: () => <Text>Private accounts</Text>,
        'security/unlock': () => <Text>Unlock required</Text>,
        '(public)/auth-pending': () => <Text>Sign in required</Text>
      },
      { initialUrl: '/' }
    );
    await waitFor(() => expect(view.getPathname()).toBe('/app-update'));
    await waitFor(() =>
      expect(
        screen.getByText(
          'No newer published update is available for your version.'
        )
      ).toBeOnTheScreen()
    );
    expect(sanitizeReturnRoute('/app-update')).toBe('/app-update');
    expect(
      sanitizeReturnRoute('/app-update?url=https://evil.example')
    ).toBeNull();
    expect(notificationService.resolveTarget).not.toHaveBeenCalled();
    expect(notificationService.executeAction).not.toHaveBeenCalled();
    expect(useAppShellStore.getState().pendingDestination).toBeNull();
    if (mode === 'locked')
      expect(useAppShellStore.getState().privacyLock?.appLockStatus).toBe(
        'locked'
      );
    await act(async () => router.push('/accounts'));
    await waitFor(() =>
      expect(
        screen.getByText(
          mode === 'locked' ? 'Unlock required' : 'Sign in required'
        )
      ).toBeOnTheScreen()
    );
    expect(screen.queryByText('Private accounts')).toBeNull();
    view.unmount();
  }
);
