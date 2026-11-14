import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  notifyManager,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query';

import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';
import {
  settingsKeys,
  useDeleteLocalData,
  usePrivacyRequest,
  useRevokeSession,
  useSecurityEvents,
  useSettingsProfile,
  useSettingsSessions,
  useSaveSettingsProfile
} from './settings-queries';

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(callback);
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    callback();
  });
});

const previousSession = useAppShellStore.getState().session;
afterEach(() => {
  jest.restoreAllMocks();
  useAppShellStore.setState({ session: previousSession });
});

test('security event pages never expose the previous owner cache after switching accounts', async () => {
  const { wrapper } = queryHarness();
  const first = {
    items: [{ id: 'private-owner-a-event' }],
    nextCursor: null,
    total: 1
  };
  const second = { items: [], nextCursor: null, total: 0 };
  let complete!: (value: never) => void;
  const list = jest
    .spyOn(settingsService, 'listSecurityEvents')
    .mockResolvedValueOnce(first as never)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
  setOwner('owner-a');
  const events = renderHook(() => useSecurityEvents(), { wrapper });
  await waitFor(() =>
    expect(events.result.current.data?.pages).toEqual([first])
  );

  act(() => setOwner('owner-b'));
  expect(events.result.current.data).toBeUndefined();
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  await act(async () => {
    complete(second as never);
  });
  await waitFor(() =>
    expect(events.result.current.data?.pages).toEqual([second])
  );
  events.unmount();
});

test('a late security event response cannot populate the previous owner cache after switching', async () => {
  const { client, wrapper } = queryHarness();
  let complete!: (value: never) => void;
  const oldPage = {
    items: [{ id: 'private-owner-a-event' }],
    nextCursor: null,
    total: 1
  };
  const newPage = { items: [], nextCursor: null, total: 0 };
  const list = jest
    .spyOn(settingsService, 'listSecurityEvents')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    )
    .mockResolvedValue(newPage as never);
  setOwner('owner-a');
  const events = renderHook(() => useSecurityEvents(), { wrapper });
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  act(() => setOwner('owner-b'));
  await act(async () => {
    complete(oldPage as never);
  });
  await waitFor(() =>
    expect(events.result.current.data?.pages).toEqual([newPage])
  );
  expect(
    client.getQueryData([
      ...settingsKeys.securityEvents(),
      { ownerId: 'owner-a' }
    ])
  ).toBeUndefined();
  expect(
    JSON.stringify(
      client.getQueriesData({ queryKey: settingsKeys.securityEvents() })
    )
  ).not.toContain('private-owner-a-event');
});

function setOwner(userId: string) {
  useAppShellStore.setState({
    session: {
      userId,
      method: 'google',
      status: 'authenticated',
      restoration: 'restored',
      issuedAt: 1,
      expiresAt: 9999999999999
    }
  });
}

test('loads profile, sessions, and security events from the settings service owner', async () => {
  const { wrapper } = queryHarness();
  const profile = userProfile();
  const sessions = [{ id: 'session-1', status: 'active', isCurrentDevice: true }];
  const events = { items: [{ id: 'event-1', type: 'new_session' }], nextCursor: null, total: 1 };
  jest.spyOn(settingsService, 'getProfile').mockResolvedValue(profile as never);
  jest.spyOn(settingsService, 'listSessions').mockResolvedValue(sessions as never);
  jest.spyOn(settingsService, 'listSecurityEvents').mockResolvedValue(events as never);

  const profileQuery = renderHook(() => useSettingsProfile(), { wrapper });
  const sessionsQuery = renderHook(() => useSettingsSessions(), { wrapper });
  const eventsQuery = renderHook(() => useSecurityEvents('cursor-1'), { wrapper });

  await waitFor(() => expect(profileQuery.result.current.data).toBe(profile));
  await waitFor(() => expect(sessionsQuery.result.current.data).toBe(sessions));
  await waitFor(() => expect(eventsQuery.result.current.data?.pages).toEqual([events]));
  expect(settingsService.listSecurityEvents).toHaveBeenCalledWith('cursor-1');
});

test('invalidates precise profile, session, privacy, and deletion scopes only on success', async () => {
  const { client, wrapper } = queryHarness();
  client.setQueryData(settingsKeys.profile(), userProfile());
  client.setQueryData(settingsKeys.sessions(), []);
  client.setQueryData(settingsKeys.privacyRequest('data_export'), { status: 'accepted' });
  jest.spyOn(settingsService, 'saveProfile').mockResolvedValue({ value: userProfile(2), affectedScopes: ['settings.profile', 'reports.live', 'assistant.context', 'notifications.policy'] } as never);
  jest.spyOn(settingsService, 'revokeSession').mockResolvedValue({ value: { id: 'session-1' }, affectedScopes: ['settings.sessions'] } as never);
  jest.spyOn(settingsService, 'requestPrivacyAction').mockResolvedValue({ value: { kind: 'data_export' }, affectedScopes: ['settings.privacy-request.data_export'] } as never);
  jest.spyOn(settingsService, 'deleteLocalData').mockResolvedValue({ value: { deletedRows: 4 }, affectedScopes: ['settings.local-data', 'notifications.list', 'assistant.conversations'] } as never);

  const save = renderHook(() => useSaveSettingsProfile(), { wrapper });
  const revoke = renderHook(() => useRevokeSession(), { wrapper });
  const privacy = renderHook(() => usePrivacyRequest(), { wrapper });
  const localDelete = renderHook(() => useDeleteLocalData(), { wrapper });

  await act(async () => {
    await save.result.current.mutateAsync({ input: userProfile(), expectedVersion: 1, operationId: 'save-profile' });
    await revoke.result.current.mutateAsync({ sessionId: 'session-1', operationId: 'revoke-1' });
    await privacy.result.current.mutateAsync({ kind: 'data_export', operationId: 'export-1' });
    await localDelete.result.current.mutateAsync({ operationId: 'delete-local' });
  });

  expect(client.getQueryState(settingsKeys.profile())?.isInvalidated).toBe(true);
  expect(client.getQueryState(settingsKeys.sessions())?.isInvalidated).toBe(true);
  expect(client.getQueryState(settingsKeys.privacyRequest('data_export'))?.isInvalidated).toBe(true);
});

test('preserves cached profile after failed save', async () => {
  const { client, wrapper } = queryHarness();
  const profile = userProfile();
  client.setQueryData(settingsKeys.profile(), profile);
  jest.spyOn(settingsService, 'saveProfile').mockRejectedValue(new Error('conflict'));

  const save = renderHook(() => useSaveSettingsProfile(), { wrapper });
  await expect(save.result.current.mutateAsync({ input: profile, expectedVersion: 99, operationId: 'conflict' })).rejects.toThrow('conflict');
  expect(client.getQueryData(settingsKeys.profile())).toEqual(profile);
});

test('delete hook uses the exported settings singleton local reset path', async () => {
  const { wrapper } = queryHarness();
  const deleteSpy = jest.spyOn(settingsService, 'deleteLocalData').mockResolvedValue({ value: { deletedRows: 2 }, affectedScopes: ['settings.local-data'] } as never);
  const localDelete = renderHook(() => useDeleteLocalData(), { wrapper });

  await act(async () => {
    await localDelete.result.current.mutateAsync({ operationId: 'singleton-delete' });
  });

  expect(deleteSpy).toHaveBeenCalledWith('singleton-delete');
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

function userProfile(version = 1) {
  return {
    name: 'Dana',
    avatar: 'default',
    phone: '+966500000000',
    googleAccount: null,
    email: 'dana@example.com',
    country: 'SA',
    currency: 'SAR',
    timeZone: 'Asia/Riyadh',
    completion: ['identity', 'currency'],
    version
  };
}
