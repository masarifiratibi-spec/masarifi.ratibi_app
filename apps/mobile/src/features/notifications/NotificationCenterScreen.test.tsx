import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';
import { router } from 'expo-router';

import type { NotificationEvent } from '@/domain/notifications';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

import { buildNotificationCenterRows, NotificationCenterScreen } from './NotificationCenterScreen';

const mockUseNotifications = jest.fn();
const mockUseUnreadNotificationCount = jest.fn();
const mockMarkRead = { mutate: jest.fn() };
const mockMarkAllRead = { mutate: jest.fn() };
const mockRemove = { mutate: jest.fn() };
const mockResolveOpen = { mutate: jest.fn() };

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./notification-queries', () => ({
  useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
  useUnreadNotificationCount: () => mockUseUnreadNotificationCount(),
  useMarkNotificationRead: () => mockMarkRead,
  useMarkAllNotificationsRead: () => mockMarkAllRead,
  useDeleteNotification: () => mockRemove,
  useResolveNotificationOpen: () => mockResolveOpen
}));

const now = Date.UTC(2026, 0, 15, 12);
const notification = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  id: 'notification-1',
  eventKey: 'event-1',
  category: 'transaction',
  eventType: 'created',
  titleKey: 'Transaction created',
  bodyKey: 'A transaction was added',
  messageValues: { amount: '200 SAR' },
  sensitivity: 'protected',
  target: { kind: 'transaction', transactionId: 'tx-1' },
  availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: null }],
  occurredAt: now,
  readAt: null,
  deletedAt: null,
  phoneStatus: 'presented_local',
  syncStatus: 'synced',
  safeFailure: null,
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  jest.spyOn(Date, 'now').mockReturnValue(now);
  mockUseNotifications.mockReturnValue({ data: { items: [notification(), notification({ id: 'notification-2', titleKey: 'Older alert', occurredAt: now - 86_400_000 })], total: 2 }, isLoading: false, isError: false, refetch: jest.fn() });
  mockUseUnreadNotificationCount.mockReturnValue({ data: 3 });
  mockResolveOpen.mutate.mockImplementation((id: string, options: { onSuccess: (target: NotificationEvent['target']) => void }) => options.onSuccess(id === 'settings' ? { kind: 'settings', key: 'security' } : notification().target));
});

afterEach(() => jest.restoreAllMocks());

it('shows all eight views, unread count, date groups, and dense notification content', () => {
  renderWithProviders(<NotificationCenterScreen />);

  expect(screen.getByText('Notifications')).toBeTruthy();
  fireEvent.press(screen.getByText('Notification preferences'));
  expect(router.push).toHaveBeenCalledWith('/notifications/preferences');
  expect(screen.getByLabelText(/All selected/)).toBeTruthy();
  ['All', 'Unread', 'Transactions', 'Obligations', 'Budgets', 'Reports', 'Assistant', 'Security'].forEach((view) =>
    expect(screen.getByText(view)).toBeTruthy()
  );
  expect(screen.getByLabelText('Unread notifications')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.getByText('2 notifications')).toBeTruthy();
  expect(
    screen
      .getAllByText(/^(Today|Transaction created|Earlier|Older alert)$/)
      .map((node) => node.props.children)
  ).toEqual(['Today', 'Transaction created', 'Earlier', 'Older alert']);

  [
    ['Unread', { unreadOnly: true }],
    ['Transactions', { category: 'transaction' }],
    ['Obligations', { category: 'obligation' }],
    ['Budgets', { category: 'budget' }],
    ['Reports', { category: 'report' }],
    ['Assistant', { category: 'assistant' }],
    ['Security', { category: 'security' }],
    ['All', {}]
  ].forEach(([label, query]) => {
    fireEvent.press(screen.getByText(label as string));
    expect(mockUseNotifications).toHaveBeenLastCalledWith(query);
  });
});

it('keeps dense notification rows grouped with stable unique keys', () => {
  const dense = Array.from({ length: 30 }, (_, index) =>
    notification({
      id: `notification-${index}`,
      titleKey: `Dense alert ${index}`,
      occurredAt: now - (index < 15 ? 0 : 86_400_000)
    })
  );

  mockUseNotifications.mockReturnValue({
    data: { items: dense, total: dense.length },
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  });

  const rows = buildNotificationCenterRows(dense);
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  expect(rows.filter((row) => row.kind === 'notification')).toHaveLength(30);
  expect(rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'notification-29' })
  ]));

  renderWithProviders(<NotificationCenterScreen />);
  expect(screen.getByText('30 notifications')).toBeTruthy();
  expect(screen.getByText('Dense alert 0')).toBeTruthy();
});

it('shows offline, sync, deleted-target, and expired-action recovery states without unsafe navigation', () => {
  mockUseNotifications.mockReturnValueOnce({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
  const offline = renderWithProviders(<NotificationCenterScreen />);
  expect(screen.getByText('Notifications are unavailable offline')).toBeTruthy();
  offline.unmount();

  mockUseNotifications.mockReturnValue({
    data: {
      items: [
        notification({ syncStatus: 'pending' }),
        notification({ id: 'deleted', titleKey: 'Deleted target', target: null, safeFailure: 'unavailable' }),
        notification({ id: 'retained-unavailable', titleKey: 'Unavailable retained', safeFailure: 'unavailable' }),
        notification({ id: 'expired', titleKey: 'Expired action', availableActions: [{ kind: 'view', expiresAt: now, sourceVersion: null }] }),
        notification({ id: 'no-view', titleKey: 'No view action', availableActions: [{ kind: 'undo', expiresAt: now + 1_000, sourceVersion: 1 }] }),
        notification({ id: 'unsafe', titleKey: 'Unsafe id', target: { kind: 'transaction', transactionId: 'tx-1?amount=200' } })
      ],
      total: 6
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  });
  renderWithProviders(<NotificationCenterScreen />);

  expect(screen.getByLabelText('Sync pending')).toBeTruthy();
  expect(screen.getAllByLabelText('Unavailable').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Action expired')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Open Deleted target'));
  fireEvent.press(screen.getByLabelText('Open Unavailable retained'));
  fireEvent.press(screen.getByLabelText('Open Expired action'));
  fireEvent.press(screen.getByLabelText('Open No view action'));
  fireEvent.press(screen.getByLabelText('Open Unsafe id'));
  expect(router.push).not.toHaveBeenCalled();
});

it('navigates only through typed targets, marks unread items read, and deletes only the notification after confirmation', () => {
  renderWithProviders(<NotificationCenterScreen />);

  fireEvent.press(screen.getByLabelText('Open Transaction created'));
  expect(router.push).toHaveBeenCalledWith('/transactions/tx-1');
  expect(mockMarkRead.mutate).toHaveBeenCalledWith({ id: 'notification-1', read: true });
  expect(screen.getAllByText('****').length).toBeGreaterThan(0);
  fireEvent.press(screen.getAllByLabelText('Reveal value')[0]);
  expect(screen.getByText('200 SAR')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Delete Transaction created'));
  fireEvent.press(screen.getByLabelText('Delete notification'));
  expect(mockRemove.mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-1' }));
});

it('routes settings targets to their existing protected destinations', () => {
  mockUseNotifications.mockReturnValue({
    data: {
      items: [
        notification({
          id: 'settings',
          titleKey: 'Security settings',
          target: { kind: 'settings', key: 'security' }
        })
      ],
      total: 1
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  });

  renderWithProviders(<NotificationCenterScreen />);

  fireEvent.press(screen.getByLabelText('Open Security settings'));
  expect(router.push).toHaveBeenCalledWith('/security/settings');
});

it('uses localized safe copy when an emitted notification key is missing', () => {
  mockUseNotifications.mockReturnValue({
    data: {
      items: [notification({
        titleKey: 'notifications.tracking.expense.review-required.title',
        bodyKey: 'notifications.tracking.expense.review-required.body'
      })],
      total: 1
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn()
  });

  renderWithProviders(<NotificationCenterScreen />);

  expect(screen.getByText('Financial update')).toBeTruthy();
  expect(screen.getByText('Open Masarifi to review the latest update.')).toBeTruthy();
  expect(screen.queryByText('notifications.tracking.expense.review-required.title')).toBeNull();
});

it.each(['ar', 'en'] as const)(
  'stacks the notification header at 200%% text in %s',
  (locale) => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    changeLocale(locale);
    renderWithProviders(<NotificationCenterScreen />);

    expect(screen.getByTestId('notification-center-header')).toHaveStyle({
      alignItems: 'stretch',
      flexDirection: 'column'
    });
  }
);
