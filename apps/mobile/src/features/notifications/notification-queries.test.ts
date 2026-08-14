import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { NotificationEvent } from '@/domain/notifications';
import { assistantNotificationsService } from '@/services/mocks/assistant-notifications-service';

import {
  invalidateNotificationScopes,
  notificationKeys,
  notificationScopeToKey,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotification,
  useNotifications,
  useUnreadNotificationCount
} from './notification-queries';

const notification: NotificationEvent = {
  id: 'notification.source.1',
  eventKey: 'event-1',
  category: 'transaction',
  eventType: 'created',
  titleKey: 'notification.title',
  bodyKey: 'notification.body',
  messageValues: {},
  sensitivity: 'protected',
  target: { kind: 'transaction', transactionId: 'tx-1' },
  availableActions: [],
  occurredAt: 1,
  readAt: null,
  deletedAt: null,
  phoneStatus: 'not_requested',
  syncStatus: 'synced',
  safeFailure: null
};

afterEach(() => {
  jest.restoreAllMocks();
});

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => { act(callback); });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => { callback(); });
});

test('keys list filters and pages separately from detail and unread count', () => {
  expect(notificationKeys.list()).toEqual(['notifications', 'list', {}]);
  expect(notificationKeys.list({ category: 'transaction', unreadOnly: true })).toEqual([
    'notifications',
    'list',
    { category: 'transaction', unreadOnly: true }
  ]);
  expect(notificationKeys.list({ category: 'transaction', unreadOnly: true, cursor: 'page-2', pageSize: 20 })).toEqual([
    'notifications',
    'list',
    { category: 'transaction', unreadOnly: true, cursor: 'page-2', pageSize: 20 }
  ]);
  expect(notificationKeys.detail('notification-1')).toEqual(['notifications', 'detail', 'notification-1']);
  expect(notificationKeys.unread()).toEqual(['notifications', 'unread']);
});

test('invalidates only the requested notification list detail and unread caches', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const list = notificationKeys.list({ category: 'transaction', unreadOnly: true, cursor: 'page-2', pageSize: 20 });
  const detail = notificationKeys.detail('notification-1');
  const otherDetail = notificationKeys.detail('notification-2');
  const unread = notificationKeys.unread();
  client.setQueryData(list, { items: [] });
  client.setQueryData(detail, { id: 'notification-1' });
  client.setQueryData(otherDetail, { id: 'notification-2' });
  client.setQueryData(unread, 1);
  client.setQueryData(['core-finance', 'transactions'], { untouched: true });
  client.setQueryData(['reports', 'live'], { untouched: true });
  client.setQueryData(['support', 'tickets'], { untouched: true });

  await invalidateNotificationScopes(client, ['notifications.detail.notification-1', 'notifications.list', 'notifications.unread', 'notifications.mark-read.notification-1', 'notifications.mark-all.transaction', 'notifications.delete.notification-1']);

  expect(client.getQueryState(list)?.isInvalidated).toBe(true);
  expect(client.getQueryState(detail)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unread)?.isInvalidated).toBe(true);
  expect(client.getQueryState(otherDetail)?.isInvalidated).toBe(false);
  expect(client.getQueryData(['core-finance', 'transactions'])).toEqual({ untouched: true });
  expect(client.getQueryData(['reports', 'live'])).toEqual({ untouched: true });
  expect(client.getQueryData(['support', 'tickets'])).toEqual({ untouched: true });
});

test('maps mark-read, filtered mark-all, and delete mutations to notification-only invalidations', () => {
  expect(notificationScopeToKey('notifications.mark-read.notification.source.1')).toEqual(['notifications', 'detail', 'notification.source.1']);
  expect(notificationScopeToKey('notifications.detail.notification.source.1')).toEqual(['notifications', 'detail', 'notification.source.1']);
  expect(notificationScopeToKey('notifications.mark-all.transaction')).toEqual(['notifications', 'list']);
  expect(notificationScopeToKey('notifications.delete.notification.source.1')).toEqual(['notifications', 'detail', 'notification.source.1']);
  expect(notificationScopeToKey('notifications.unknown')).toBeNull();
  expect(notificationScopeToKey('reports.live')).toBeNull();
});

test('wires list filter page detail and derived unread queries to the notification service', async () => {
  const { wrapper } = queryHarness();
  const input = { category: 'transaction' as const, unreadOnly: true, cursor: 'page-2', pageSize: 20 };
  const list = jest.spyOn(assistantNotificationsService, 'list').mockImplementation(async (query) =>
    query.pageSize === 1
      ? { items: [], nextCursor: null, total: 7 }
      : { items: [notification], nextCursor: 'page-3', total: 21 }
  );
  const get = jest.spyOn(assistantNotificationsService, 'get').mockResolvedValue(notification);

  const listHook = renderHook(() => useNotifications(input), { wrapper });
  const detailHook = renderHook(() => useNotification(notification.id), { wrapper });
  const unreadHook = renderHook(() => useUnreadNotificationCount(), { wrapper });

  await waitFor(() => {
    expect(listHook.result.current.data?.pages[0]?.nextCursor).toBe('page-3');
    expect(detailHook.result.current.data).toEqual(notification);
    expect(unreadHook.result.current.data).toBe(7);
  });
  expect(list).toHaveBeenCalledWith(input);
  expect(list).toHaveBeenCalledWith({ unreadOnly: true, pageSize: 1 });
  expect(get).toHaveBeenCalledWith(notification.id);
});

test('wires mark-read filtered mark-all and delete mutations and invalidates their exact scopes', async () => {
  const { client, wrapper } = queryHarness();
  const listKey = notificationKeys.list({ category: 'transaction' });
  const detailKey = notificationKeys.detail(notification.id);
  const unreadKey = notificationKeys.unread();
  client.setQueryData(listKey, { items: [notification] });
  client.setQueryData(detailKey, notification);
  client.setQueryData(unreadKey, 1);

  const markRead = jest.spyOn(assistantNotificationsService, 'markRead').mockResolvedValue({
    value: { ...notification, readAt: 10 },
    affectedScopes: [`notifications.detail.${notification.id}`, 'notifications.list', 'notifications.unread']
  });
  const markAll = jest.spyOn(assistantNotificationsService, 'markAllRead').mockResolvedValue({
    value: 1,
    affectedScopes: ['notifications.list', 'notifications.unread', 'notifications.mark-all.transaction']
  });
  const remove = jest.spyOn(assistantNotificationsService, 'delete').mockResolvedValue({
    value: { id: notification.id },
    affectedScopes: [`notifications.detail.${notification.id}`, 'notifications.list', 'notifications.unread']
  });

  const markReadHook = renderHook(() => useMarkNotificationRead(), { wrapper });
  const markAllHook = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
  const deleteHook = renderHook(() => useDeleteNotification(), { wrapper });
  await act(async () => {
    await markReadHook.result.current.mutateAsync({ id: notification.id, read: true });
    await markAllHook.result.current.mutateAsync({ filter: { category: 'transaction' }, operationId: 'mark-all-1' });
    await deleteHook.result.current.mutateAsync({ id: notification.id, operationId: 'delete-1' });
  });

  expect(markRead).toHaveBeenCalledWith(notification.id, true);
  expect(markAll).toHaveBeenCalledWith({ category: 'transaction' }, 'mark-all-1');
  expect(remove).toHaveBeenCalledWith(notification.id, 'delete-1');
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(unreadKey)?.isInvalidated).toBe(true);
});

function queryHarness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false }
    }
  });
  const wrapper = ({ children }: PropsWithChildren) => React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}
