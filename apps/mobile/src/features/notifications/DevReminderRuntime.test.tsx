import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { DevReminderRuntime } from './DevReminderRuntime';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { buildPreferences } from '@/domain/foundation';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { synchronizeGuestOnboardingReminder } from '@/services/platform/guest-onboarding-reminder';

jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => true)
}));
jest.mock('@/services/automatic-tracking-service', () => ({
  automaticTrackingService: { getRuleConfiguration: jest.fn(async () => ({})) }
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({
  synchronizeGuestOnboardingReminder: jest.fn(async () => undefined)
}));
jest.mock('@/storage/secure-preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn(async () => undefined)
}));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: { getPermission: jest.fn(async () => 'granted') }
}));

beforeEach(() => {
  jest.clearAllMocks();
  usePreferenceStore.setState({ ...buildPreferences({}), hydrated: true });
  useAppShellStore.setState({ hydrated: true, session: null });
  jest
    .requireMock('@/services/platform/phone-notification-service')
    .phoneNotificationService.getPermission.mockResolvedValue('granted');
});

it('never schedules a default guest reminder when OS display permission is denied', async () => {
  jest
    .requireMock('@/services/platform/phone-notification-service')
    .phoneNotificationService.getPermission.mockResolvedValue('denied');
  render(<DevReminderRuntime />);
  await waitFor(() =>
    expect(synchronizeGuestOnboardingReminder).toHaveBeenCalledWith({
      enabled: false,
      hasAccount: false,
      locale: 'ar'
    })
  );
});

it('synchronizes default-on guest consent only with OS permission and cancels after a new account appears', async () => {
  render(<DevReminderRuntime />);
  act(() => usePreferenceStore.setState({ returnRemindersEnabled: true }));
  await waitFor(() =>
    expect(synchronizeGuestOnboardingReminder).toHaveBeenLastCalledWith({
      enabled: true,
      hasAccount: false,
      locale: 'ar'
    })
  );
  act(() =>
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'owner-a',
        expiresAt: Date.now() + 60000,
        issuedAt: Date.now(),
        method: 'google',
        restoration: 'idle'
      }
    })
  );
  await waitFor(() =>
    expect(synchronizeGuestOnboardingReminder).toHaveBeenLastCalledWith({
      enabled: true,
      hasAccount: true,
      locale: 'ar'
    })
  );
});

it('refreshes device consent and real foreground activity independently of capture preferences', () => {
  let foreground: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  const spy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove };
    });
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'owner-a',
      expiresAt: Date.now() + 60000,
      issuedAt: Date.now(),
      method: 'google',
      restoration: 'idle'
    }
  });
  usePreferenceStore.setState({ trackingPersonalization: false });
  const view = render(<DevReminderRuntime />);
  expect(automaticTrackingService.getRuleConfiguration).toHaveBeenCalledTimes(
    1
  );
  act(() =>
    usePreferenceStore.setState({
      returnRemindersEnabled: true,
      returnRemindersOwnerId: 'owner-a',
      returnReminderChoices: { 'account:owner-a': false }
    })
  );
  expect(automaticTrackingService.getRuleConfiguration).toHaveBeenCalledTimes(
    2
  );
  act(() => foreground?.('background'));
  expect(automaticTrackingService.getRuleConfiguration).toHaveBeenCalledTimes(
    2
  );
  act(() => foreground?.('active'));
  expect(automaticTrackingService.getRuleConfiguration).toHaveBeenCalledTimes(
    3
  );
  view.unmount();
  expect(remove).toHaveBeenCalled();
  spy.mockRestore();
});
