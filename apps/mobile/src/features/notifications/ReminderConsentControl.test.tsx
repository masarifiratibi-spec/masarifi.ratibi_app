import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ReminderConsentControl } from './ReminderConsentControl';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { buildPreferences } from '@/domain/foundation';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/config/mobile-automation', () => ({
  isMobileAutomationEnabled: jest.fn(() => true)
}));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: {
    requestPermission: jest.fn(async () => 'granted')
  }
}));
jest.mock('@/services/engagement-service', () => ({
  notificationService: {
    requestPermissionAfterEducation: jest.fn(async () => 'granted')
  }
}));
jest.mock('@/services/platform/guest-onboarding-reminder', () => ({
  registerGuestRemindersChannel: jest.fn(async () => undefined)
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

beforeEach(() => {
  jest.clearAllMocks();
  gate.mockReturnValue(true);
  permission.mockResolvedValue('granted');
  usePreferenceStore.setState({
    ...buildPreferences({ locale: 'en' }),
    hydrated: true
  });
  useAppShellStore.setState({ session: null, hydrated: true });
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
