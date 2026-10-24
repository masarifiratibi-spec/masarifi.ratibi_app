import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { NotificationResponseRuntime } from './ProtectedRouteGate';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { buildPreferences } from '@/domain/foundation';
import { notificationService } from '@/services/engagement-service';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { router } from 'expo-router';
let mockClerkKey: string | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => '/'
}));
jest.mock('@/services/live/clerk-provider', () => ({
  useLiveClerkSessionKey: () => mockClerkKey
}));
jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: () => true
}));
jest.mock('@/features/notifications/DevReminderRuntime', () => ({
  DevReminderRuntime: () => null
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({
  consumeGuestOnboardingReminder: jest.fn(async () => true)
}));
jest.mock('@/services/engagement-service', () => ({
  notificationService: {
    resolveTarget: jest.fn(async () => ({
      status: 'exact',
      target: { kind: 'home' }
    })),
    revalidateAction: jest.fn(async () => ({
      status: 'available',
      target: { kind: 'home' }
    })),
    executeAction: jest.fn()
  }
}));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {
    registerCategories: jest.fn(async () => undefined),
    getLastResponse: jest.fn(async () => ({
      notificationId: 'cold-notification',
      action: 'view'
    })),
    subscribeToResponses: jest.fn(() => () => undefined)
  }
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockClerkKey = undefined;
  useAppShellStore.setState({
    hydrated: false,
    session: null,
    privacyLock: null
  });
  usePreferenceStore.setState({ ...buildPreferences({}), hydrated: true });
});
it('replays a cold remote tap after both shell restoration and delayed Clerk startup', async () => {
  const view = render(<NotificationResponseRuntime />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(notificationService.resolveTarget).not.toHaveBeenCalled();
  act(() =>
    useAppShellStore.setState({
      hydrated: true,
      session: {
        status: 'authenticated',
        userId: 'any-owner',
        issuedAt: 1,
        expiresAt: Date.now() + 60000,
        method: 'google',
        restoration: 'restored'
      }
    })
  );
  expect(notificationService.resolveTarget).not.toHaveBeenCalled();
  mockClerkKey = 'cold-session';
  view.rerender(<NotificationResponseRuntime />);
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(tabs)/home'));
  expect(notificationService.resolveTarget).toHaveBeenCalledTimes(1);
});
it('handles a public guest tap while authentication is still starting', async () => {
  jest
    .mocked(phoneNotificationService.getLastResponse)
    .mockResolvedValueOnce({
      kind: 'onboarding_resume',
      cycleId: '78c71e06-457f-4f20-95f6-9db73c114a73',
      action: 'view'
    });
  render(<NotificationResponseRuntime />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(notificationService.resolveTarget).not.toHaveBeenCalled();
});
