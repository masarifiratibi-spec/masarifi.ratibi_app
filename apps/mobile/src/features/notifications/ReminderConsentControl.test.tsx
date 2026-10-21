import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ReminderConsentControl } from './ReminderConsentControl';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { buildPreferences } from '@/domain/foundation';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => true)
}));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {
    requestPermission: jest.fn(async () => 'granted'),
    getPermission: jest.fn(async () => 'not_requested'),
    openSystemSettings: jest.fn(async () => undefined)
  }
}));
jest.mock('@/services/engagement-service', () => ({
  notificationService: {
    requestPermissionAfterEducation: jest.fn(async () => 'granted')
  }
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({
  registerGuestRemindersChannel: jest.fn(async () => undefined),
  synchronizeGuestOnboardingReminder: jest.fn(async () => undefined)
}));
jest.mock('@/services/automatic-tracking-service', () => ({
  automaticTrackingService: { getRuleConfiguration: jest.fn(async () => ({})) }
}));
jest.mock('@/storage/secure-preferences', () => ({
  loadPreferences: jest.fn(),
  savePreferences: jest.fn(async () => undefined)
}));
const permission = jest.requireMock(
  '@/services/platform/phone-notification-service'
).phoneNotificationService.requestPermission as jest.Mock;
const gate = jest.requireMock('@/config/mobile-automation')
  .isMobileAutomationEnabled as jest.Mock;
const phone = jest.requireMock(
  '@/services/platform/phone-notification-service'
).phoneNotificationService;
const refresh = jest.requireMock('@/services/automatic-tracking-service')
  .automaticTrackingService.getRuleConfiguration as jest.Mock;
const authenticatedPermission = jest.requireMock('@/services/engagement-service')
  .notificationService.requestPermissionAfterEducation as jest.Mock;
const synchronizeGuest = jest.requireMock('@/services/platform/guest-onboarding-reminder')
  .synchronizeGuestOnboardingReminder as jest.Mock;

beforeEach(() => {
  changeLocale('en');
  jest.clearAllMocks();
  gate.mockReturnValue(true);
  permission.mockResolvedValue('granted');
  phone.getPermission.mockResolvedValue('not_requested');
  authenticatedPermission.mockResolvedValue('granted');
  refresh.mockResolvedValue({});
  usePreferenceStore.setState({
    ...buildPreferences({ locale: 'en' }),
    hydrated: true
  });
  useAppShellStore.setState({ session: null, hydrated: true });
});

it('offers OS permission for default-on reminders without prompting or creating an extra opt-in step', async () => {
  renderWithProviders(<ReminderConsentControl guest />);
  const allow = await screen.findByRole('button', { name: 'Allow notifications' });
  expect(permission).not.toHaveBeenCalled();
  expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(true);
  fireEvent.press(allow);
  await waitFor(() => expect(permission).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull());
  expect(synchronizeGuest).toHaveBeenCalledWith({ enabled: true, hasAccount: false, locale: 'en' });
});

it('opens system settings for permanently denied permission and refreshes on foreground', async () => {
  phone.getPermission.mockResolvedValue('permanently_denied');
  const foreground = new Set<(state: AppStateStatus) => void>();
  const remove = jest.fn();
  const originalImplementation = jest.isMockFunction(AppState.addEventListener)
    ? jest.mocked(AppState.addEventListener).getMockImplementation()
    : undefined;
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground.add(listener);
    return { remove: () => { foreground.delete(listener); remove(); } };
  });
  const view = renderWithProviders(<ReminderConsentControl guest />);
  try {
    fireEvent.press(await screen.findByRole('button', { name: 'Open settings' }));
    await waitFor(() => expect(phone.openSystemSettings).toHaveBeenCalledTimes(1));
    expect(permission).not.toHaveBeenCalled();
    phone.getPermission.mockResolvedValue('granted');
    await act(async () => { foreground.forEach((listener) => listener('active')); });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open settings' })).toBeNull());
  } finally {
    view.unmount();
    spy.mockRestore();
    if (originalImplementation)
      jest.mocked(AppState.addEventListener).mockImplementation(originalImplementation);
  }
  expect(remove).toHaveBeenCalled();
});

it('shows no permission action or prompt when the OS already permits notifications', async () => {
  phone.getPermission.mockResolvedValue('granted');
  renderWithProviders(<ReminderConsentControl guest />);
  await waitFor(() => expect(phone.getPermission).toHaveBeenCalled());
  expect(screen.queryByRole('button')).toBeNull();
  expect(permission).not.toHaveBeenCalled();
});

it('does not offer a permission button after an explicit reminder opt-out', async () => {
  usePreferenceStore.setState({ returnReminderChoices: { guest: false } });
  renderWithProviders(<ReminderConsentControl guest />);
  await act(async () => undefined);
  expect(screen.queryByRole('button')).toBeNull();
  expect(permission).not.toHaveBeenCalled();
});

it('does not apply a default-on permission result to an account that replaced the guest', async () => {
  let resolve!: (value: string) => void;
  permission.mockReturnValue(new Promise((done) => { resolve = done; }));
  renderWithProviders(<ReminderConsentControl guest />);
  fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' }));
  await waitFor(() => expect(permission).toHaveBeenCalled());
  await act(async () => {
    useAppShellStore.setState({ session: {
      status: 'authenticated', userId: 'owner-b', expiresAt: Date.now() + 60000,
      issuedAt: Date.now(), method: 'google', restoration: 'idle'
    } });
    resolve('granted');
  });
  expect(usePreferenceStore.getState().returnReminderChoices).toEqual({});
  expect(screen.queryByRole('button')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

it.each([false, true])('refreshes authenticated enrollment after default-on permission, including offline=%s', async (offline) => {
  useAppShellStore.setState({ session: {
    status: 'authenticated', userId: 'owner-a', expiresAt: Date.now() + 60000,
    issuedAt: Date.now(), method: 'google', restoration: 'idle'
  } });
  if (offline) refresh.mockRejectedValue(new Error('offline'));
  renderWithProviders(<ReminderConsentControl />);
  expect(authenticatedPermission).not.toHaveBeenCalled();
  fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(authenticatedPermission).toHaveBeenCalledTimes(1);
  expect(usePreferenceStore.getState().returnReminderChoices['account:owner-a']).toBe(true);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('does not enroll a replacement owner after an authenticated permission prompt', async () => {
  useAppShellStore.setState({ session: {
    status: 'authenticated', userId: 'owner-a', expiresAt: Date.now() + 60000,
    issuedAt: Date.now(), method: 'google', restoration: 'idle'
  } });
  let resolve!: (value: string) => void;
  authenticatedPermission.mockReturnValue(new Promise((done) => { resolve = done; }));
  renderWithProviders(<ReminderConsentControl />);
  fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' }));
  await waitFor(() => expect(authenticatedPermission).toHaveBeenCalled());
  await act(async () => {
    useAppShellStore.setState({ session: {
      ...useAppShellStore.getState().session!, userId: 'owner-b'
    } });
    resolve('granted');
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(usePreferenceStore.getState().returnReminderChoices).toEqual({});
});

it('retains an OS grant when push registration fails after the prompt', async () => {
  useAppShellStore.setState({ session: {
    status: 'authenticated', userId: 'owner-a', expiresAt: Date.now() + 60000,
    issuedAt: Date.now(), method: 'google', restoration: 'idle'
  } });
  authenticatedPermission.mockRejectedValue(new Error('registration offline'));
  renderWithProviders(<ReminderConsentControl />);
  const allow = await screen.findByRole('button', { name: 'Allow notifications' });
  phone.getPermission.mockResolvedValue('granted');
  fireEvent.press(allow);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(usePreferenceStore.getState().returnReminderChoices['account:owner-a']).toBe(true);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('requests OS consent only on explicit guest opt-in and keeps capture preferences unchanged', async () => {
  renderWithProviders(<ReminderConsentControl guest />);
  expect(permission).not.toHaveBeenCalled();
  expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(false));
  await waitFor(() => expect(screen.getByRole('switch').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByRole('switch'));
  await waitFor(() =>
    expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(true)
  );
  expect(usePreferenceStore.getState()).toMatchObject({
    returnRemindersOwnerId: null,
    trackingPersonalization: true
  });
  fireEvent.press(screen.getByRole('switch'));
  await waitFor(() =>
    expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false)
  );
  expect(permission).toHaveBeenCalledTimes(1);
});

it('keeps reminder consent off when display permission is denied', async () => {
  permission.mockResolvedValue('denied');
  usePreferenceStore.setState({ returnReminderChoices: { guest: false } });
  renderWithProviders(<ReminderConsentControl guest />);
  fireEvent.press(screen.getByRole('switch'));
  await screen.findByRole('alert');
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
});

it('registers display permission and ties authenticated consent to the current owner', async () => {
  usePreferenceStore.setState({ returnReminderChoices: { 'account:owner-a': false } });
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
  renderWithProviders(<ReminderConsentControl />);
  fireEvent.press(screen.getByRole('switch'));
  await waitFor(() =>
    expect(usePreferenceStore.getState()).toMatchObject({
      returnRemindersEnabled: true,
      returnRemindersOwnerId: 'owner-a'
    })
  );
  expect(permission).not.toHaveBeenCalled();
});

it('does not grant a new owner consent while the OS prompt is pending', async () => {
  usePreferenceStore.setState({ returnReminderChoices: { guest: false } });
  let resolve!: (value: string) => void;
  permission.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  renderWithProviders(<ReminderConsentControl guest />);
  fireEvent.press(screen.getByRole('switch'));
  await act(async () => {
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'owner-b',
        expiresAt: Date.now() + 10000,
        issuedAt: Date.now(),
        method: 'google',
        restoration: 'idle'
      }
    });
    resolve('granted');
  });
  expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
});

it('renders Arabic guest consent and hides the control in the ordinary app', () => {
  changeLocale('ar');
  usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  const view = renderWithProviders(<ReminderConsentControl guest />);
  expect(screen.getByRole('switch').props.accessibilityLabel).toContain(
    'ذكّرني باستكمال الإعداد'
  );
  gate.mockReturnValue(false);
  view.unmount();
  renderWithProviders(<ReminderConsentControl guest />);
  expect(screen.queryByRole('switch')).toBeNull();
});
