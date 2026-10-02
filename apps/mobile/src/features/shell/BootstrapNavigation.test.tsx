import React from 'react';
import { Platform, Text } from 'react-native';
import {
  act,
  renderRouter,
  screen,
  waitFor
} from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';

import RootLayout from '@app/_layout';
import AppEntry from '@app/index';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { completeAuthenticatedSession } from '@/features/auth/session-controller';

jest.unmock('expo-router');
jest.unmock('@react-navigation/native');
jest.mock('@/design-system/typography', () => ({
  FontGate: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock('@/state/FoundationProviders', () => {
  const { QueryClient, QueryClientProvider } = jest.requireActual(
    '@tanstack/react-query'
  );
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  return {
    FoundationProviders: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  };
});
jest.mock('@/services/live/clerk-provider', () => ({
  MobileIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useLiveClerkSessionKey: () => 'session-bootstrap'
}));
jest.mock('@/services/live/clerk-context', () => ({
  useLiveIdentityStatus: () => ({ status: 'ready' })
}));
jest.mock('@/features/security/AppPrivacyGate', () => ({
  AppPrivacyGate: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock('./ProtectedRouteGate', () => ({
  ...jest.requireActual('./ProtectedRouteGate'),
  NotificationResponseRuntime: () => null
}));
const mockRestoreSession = jest.fn();
const mockGetProfileSetup = jest.fn();
jest.mock('@/features/auth/auth-flow', () => ({
  authService: {
    restoreSession: () => mockRestoreSession(),
    touchActivity: jest.fn(async () => undefined)
  }
}));
jest.mock('@/services/mocks/subscription-settings-service', () => ({
  settingsService: { getProfileSetup: () => mockGetProfileSetup() }
}));
jest.mock('@/services/live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: jest.fn(async () => undefined)
}));
jest.mock('@/services/platform-operations-service', () => ({
  refreshPlatformOperations: jest.fn(async () => undefined)
}));
jest.mock('@/services/automatic-tracking-coordinator', () => ({
  syncAutomaticTracking: jest.fn(async () => undefined)
}));
jest.mock('@/services/live/engagement-service', () => ({
  ensureLivePushDeviceRegistration: jest.fn(async () => undefined)
}));
jest.mock('@/services/engagement-service', () => ({ notificationService: {} }));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {}
}));

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.EXPO_PUBLIC_CLIENT_MODE;
});

test.each([false, true])(
  'the installed navigator settles authenticated bootstrap (complete=%s) without repeating it',
  async (complete) => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    useAppShellStore.getState().reset();
    const session = { ...authenticatedSession, userId: 'user_live_bootstrap' };
    mockRestoreSession.mockResolvedValue(session);
    mockGetProfileSetup.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ complete, profile: { currency: 'SAR' } }),
            100
          );
        })
    );
    useAppShellStore.setState({
      hydrated: true,
      session,
      profileSetupStatus: 'loading',
      setPendingDestination: jest.fn(async () => undefined)
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    const result = renderRouter({
      _layout: RootLayout,
      index: AppEntry,
      '(onboarding)/profile-setup': () => (
        <Text>Profile Setup destination</Text>
      ),
      '(tabs)/home': () => <Text>Home destination</Text>
    });
    const label = complete ? 'Home destination' : 'Profile Setup destination';
    const path = complete ? '/home' : '/profile-setup';
    await waitFor(() => expect(screen.getByText(label)).toBeOnTheScreen());
    expect(result.getPathname()).toBe(path);
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
    expect(mockGetProfileSetup).toHaveBeenCalledTimes(1);
  }
);

test('Google completion returns to the installed root route rather than an unmatched index URL', async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  const session = { ...authenticatedSession, userId: 'user_live_bootstrap' };
  useAppShellStore.setState({ session, profileSetupStatus: 'loading' });
  const result = renderRouter(
    {
      _layout: () => <Stack />,
      index: () => <Text>Bootstrap destination</Text>,
      welcome: () => <Text>Google destination</Text>
    },
    { initialUrl: '/welcome' }
  );
  await act(async () => {
    router.replace(await completeAuthenticatedSession(session));
  });
  await waitFor(() =>
    expect(screen.getByText('Bootstrap destination')).toBeOnTheScreen()
  );
  expect(result.getPathname()).toBe('/');
});
