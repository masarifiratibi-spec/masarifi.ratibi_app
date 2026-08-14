import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createNotificationPreferences } from '@/domain/notifications';
import { renderWithProviders } from '@/test-utils/render';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { changeLocale } from '@/localization/i18n';

import { NotificationPreferencesScreen } from './NotificationPreferencesScreen';

const mockPreferences = jest.fn();
const mockSave = { mutate: jest.fn(), isPending: false };
const mockRefresh = { mutate: jest.fn(), isPending: false };
const mockRequest = { mutate: jest.fn(), isPending: false };

jest.mock('./notification-preferences-queries', () => ({
  useNotificationPreferences: () => mockPreferences(),
  useSaveNotificationPreferences: () => mockSave,
  useRefreshNotificationPermission: () => mockRefresh,
  useRequestNotificationPermission: () => mockRequest
}));

jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: { openSystemSettings: jest.fn() }
}));

const preferences = {
  ...createNotificationPreferences(1),
  version: 7,
  phoneEnabled: true,
  permissionState: 'denied' as const,
  dailySummary: { enabled: true, time: '09:30' },
  weeklySummary: { enabled: false, weekday: 1, time: '10:00' }
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockPreferences.mockReturnValue({ data: preferences, isLoading: false, isError: false, refetch: jest.fn() });
});

it('renders every preference section and preserves edited input after save errors', async () => {
  mockSave.mutate.mockImplementation((_input, options) => options?.onError?.(new Error('offline')));
  renderWithProviders(<NotificationPreferencesScreen />);

  [
    'Category transaction',
    'Category income',
    'Category obligation',
    'Category budget',
    'Category salary',
    'Category savings',
    'Category report',
    'Category assistant',
    'Category security',
    'Category system',
    'Quiet Sunday',
    'Quiet Monday',
    'Quiet Tuesday',
    'Quiet Wednesday',
    'Quiet Thursday',
    'Quiet Friday',
    'Quiet Saturday',
    'Weekly Sunday',
    'Weekly Monday',
    'Weekly Tuesday',
    'Weekly Wednesday',
    'Weekly Thursday',
    'Weekly Friday',
    'Weekly Saturday',
    'Phone notifications',
    'Hide amounts on lock screen',
    'Quiet hours',
    'Daily summary',
    'Weekly summary'
  ].forEach((label) => expect(screen.getByLabelText(label)).toBeTruthy());

  expect(screen.getByDisplayValue('22:00')).toBeTruthy();
  expect(screen.getByDisplayValue('07:00')).toBeTruthy();
  expect(screen.getByDisplayValue('Asia/Riyadh')).toBeTruthy();
  expect(screen.getByDisplayValue('09:30')).toBeTruthy();
  expect(screen.getByDisplayValue('10:00')).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Quiet timezone'), 'Asia/Dubai');
  fireEvent.press(screen.getByLabelText('Category budget'));
  fireEvent.press(screen.getByLabelText('Quiet Friday'));
  fireEvent.press(screen.getByLabelText('Weekly Friday'));
  fireEvent.press(screen.getByLabelText('Save notification preferences'));

  expect(mockSave.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedVersion: 7,
      input: expect.objectContaining({
        phoneEnabled: true,
        hideAmountsOnLockScreen: true,
        categoryEnabled: expect.objectContaining({ budget: false }),
        quietHours: expect.objectContaining({
          timeZone: 'Asia/Dubai',
          weekdays: expect.not.arrayContaining([5])
        }),
        dailySummary: expect.objectContaining({ enabled: true, time: '09:30' }),
        weeklySummary: expect.objectContaining({ weekday: 5, time: '10:00' })
      })
    }),
    expect.any(Object)
  );
  expect(await screen.findByText('Could not save preferences')).toBeTruthy();
  expect(screen.getByDisplayValue('Asia/Dubai')).toBeTruthy();
  expect(screen.getByLabelText('Weekly Friday').props.accessibilityState.selected).toBe(true);
});

it('keeps permission recovery explicit and never auto-requests permission', async () => {
  renderWithProviders(<NotificationPreferencesScreen />);

  expect(screen.getByText('Permission denied')).toBeTruthy();
  expect(mockRequest.mutate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Review permission request'));
  expect(screen.getByText('Masarifi will ask the device for notification permission next.')).toBeTruthy();
  fireEvent.press(screen.getByText(/Cancel|إلغاء/));
  expect(mockRequest.mutate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Review permission request'));
  fireEvent.press(screen.getByLabelText('Request permission'));
  fireEvent.press(screen.getByLabelText('Refresh permission'));
  fireEvent.press(screen.getByLabelText('Open notification settings'));

  expect(mockRequest.mutate).toHaveBeenCalledTimes(1);
  expect(mockRefresh.mutate).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(phoneNotificationService.openSystemSettings).toHaveBeenCalledTimes(1));
});

it('shows loading and offline recovery states', () => {
  mockPreferences.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
  const loading = renderWithProviders(<NotificationPreferencesScreen />);
  expect(screen.getByText('Loading notification preferences')).toBeTruthy();
  loading.unmount();

  const refetch = jest.fn();
  mockPreferences.mockReturnValueOnce({ data: undefined, isLoading: false, isError: true, refetch });
  renderWithProviders(<NotificationPreferencesScreen />);
  fireEvent.press(screen.getByLabelText('Retry'));
  expect(refetch).toHaveBeenCalledTimes(1);
});
