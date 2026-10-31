import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('./settings-queries', () => ({
  useSettingsSessions: jest.fn(),
  useRevokeSession: jest.fn(),
  useSecurityEvents: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./settings-queries') as {
  useSettingsSessions: jest.Mock;
  useRevokeSession: jest.Mock;
  useSecurityEvents: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SecurityEventScreen } = require('./SecurityEventScreen') as {
  SecurityEventScreen: React.ComponentType;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SessionListScreen } = require('./SessionListScreen') as {
  SessionListScreen: React.ComponentType;
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSettingsSessions.mockReturnValue({
    data: sessions(),
    isLoading: false,
    isError: false
  });
  mockQueries.useRevokeSession.mockReturnValue({
    mutate: jest.fn(),
    isPending: false
  });
  mockQueries.useSecurityEvents.mockReturnValue({
    data: events(),
    isLoading: false,
    isError: false
  });
});

test('session list shows current/other/expired/revoked sessions and individual revocation', () => {
  const revoke = jest.fn();
  mockQueries.useRevokeSession.mockReturnValue({
    mutate: revoke,
    isPending: false
  });

  renderWithProviders(<SessionListScreen />);

  expect(screen.getByText(t('settings.sessions.title'))).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.current'))).toBeTruthy();
  expect(screen.getByText('Pixel 8')).toBeTruthy();
  expect(screen.getByText('Old iPhone')).toBeTruthy();
  expect(screen.getByText('MacBook')).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.revoking'))).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.revoked'))).toBeTruthy();

  fireEvent.press(
    screen.getByText(t('settings.sessions.revoke', { device: 'Old iPhone' }))
  );

  expect(revoke).toHaveBeenCalledWith({
    sessionId: 'session-2',
    operationId: expect.stringMatching(/^settings-revoke-session-/)
  });
});

test('session revocation exposes pending, failure recovery, and success-only current clearing', () => {
  mockQueries.useRevokeSession.mockReturnValue({
    mutate: jest.fn(),
    isPending: true,
    isError: true,
    isSuccess: false
  });

  renderWithProviders(<SessionListScreen />);

  expect(screen.getByText(t('settings.sessions.pending'))).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.failure'))).toBeTruthy();
  expect(screen.queryByText(t('settings.sessions.currentCleared'))).toBeNull();
});

test('non-current session revoke success does not claim current session clearing', () => {
  mockQueries.useRevokeSession.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { value: sessions()[1] }
  });

  renderWithProviders(<SessionListScreen />);

  expect(screen.queryByText(t('settings.sessions.currentCleared'))).toBeNull();
});

test('current clearing is visible after current-session success only', () => {
  mockQueries.useRevokeSession.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { value: sessions()[0] }
  });
  renderWithProviders(<SessionListScreen />);
  expect(screen.getByText(t('settings.sessions.currentCleared'))).toBeTruthy();
});

test('security events show masked context and recovery destinations without raw technical values', () => {
  renderWithProviders(<SecurityEventScreen />);

  expect(screen.getByText(t('settings.securityEvents.title'))).toBeTruthy();
  expect(
    screen.getByText(t('settings.securityEvents.new_session'))
  ).toBeTruthy();
  expect(
    screen.getByText(t('settings.securityEvents.access_protection_change'))
  ).toBeTruthy();
  expect(
    screen.getByText(t('settings.securityEvents.recover.security'))
  ).toBeTruthy();
  expect(screen.queryByText(/token|ip address|credential|secret/i)).toBeNull();
});

test.each([
  ['en', 'other', 'Account activity'],
  ['ar', 'other', 'نشاط الحساب'],
  ['en', 'session_revocation', 'Session revoked'],
  ['ar', 'session_revocation', 'تم إلغاء الجلسة']
] as const)('localizes %s %s events without exposing the event code', (locale, type, label) => {
  changeLocale(locale);
  mockQueries.useSecurityEvents.mockReturnValue({
    data: { pages: [{ items: [{ ...events().items[0], type, eventType: 'unmapped.private_event' }] }] }
  });
  renderWithProviders(<SecurityEventScreen />);
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByText('settings.securityEvents.other')).toBeNull();
  expect(screen.queryByText('unmapped.private_event')).toBeNull();
});

test('live security event pages retain their rows during a page failure and expose retry and recovery', () => {
  const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);
  const fetchNextPage = jest.fn();
  const refetch = jest.fn();
  const [first, second] = events().items;
  mockQueries.useSecurityEvents.mockReturnValue({
    data: { pages: [{ items: [first] }, { items: [second] }] },
    isLoading: false,
    isError: true,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage,
    refetch
  });
  renderWithProviders(<SecurityEventScreen />);
  expect(
    screen.getByText(t('settings.securityEvents.new_session'))
  ).toBeTruthy();
  expect(
    screen.getByText(t('settings.securityEvents.access_protection_change'))
  ).toBeTruthy();
  fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached');
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  fireEvent.press(
    screen.getByRole('button', { name: t('coreFinance.action.retry') })
  );
  expect(refetch).toHaveBeenCalledTimes(1);
  fireEvent.press(
    screen.getByText(t('settings.securityEvents.recover.security'))
  );
  expect(push).toHaveBeenCalledWith('/security/settings');
  push.mockRestore();
});

test('security events distinguish loading, failed reads with retry, and a successful empty page', () => {
  const refetch = jest.fn();
  mockQueries.useSecurityEvents.mockReturnValue({ isLoading: true });
  const view = renderWithProviders(<SecurityEventScreen />);
  expect(screen.getByText(t('settings.securityEvents.loading'))).toBeTruthy();
  view.unmount();
  mockQueries.useSecurityEvents.mockReturnValue({ isLoading: false, refetch });
  const failed = renderWithProviders(<SecurityEventScreen />);
  expect(screen.getByText(t('settings.securityEvents.error'))).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: t('coreFinance.action.retry') })
  );
  expect(refetch).toHaveBeenCalledTimes(1);
  failed.unmount();
  mockQueries.useSecurityEvents.mockReturnValue({
    data: { pages: [{ items: [] }] }
  });
  renderWithProviders(<SecurityEventScreen />);
  expect(screen.getByText(t('settings.securityEvents.empty'))).toBeTruthy();
  expect(screen.queryByText(t('settings.securityEvents.error'))).toBeNull();
});

function sessions() {
  return [
    {
      id: 'session-1',
      deviceLabel: 'Pixel 8',
      platform: 'android',
      createdAt: 1,
      lastActiveAt: 2,
      isCurrentDevice: true,
      status: 'active'
    },
    {
      id: 'session-2',
      deviceLabel: 'Old iPhone',
      platform: 'ios',
      createdAt: 1,
      lastActiveAt: 2,
      isCurrentDevice: false,
      status: 'active'
    },
    {
      id: 'session-3',
      deviceLabel: 'MacBook',
      platform: 'web',
      createdAt: 1,
      lastActiveAt: 2,
      isCurrentDevice: false,
      status: 'revoking'
    },
    {
      id: 'session-4',
      deviceLabel: 'Web',
      platform: 'web',
      createdAt: 1,
      lastActiveAt: 2,
      isCurrentDevice: false,
      status: 'revoked'
    }
  ];
}

function events() {
  return {
    items: [
      {
        id: 'event-1',
        type: 'new_session',
        deviceLabel: 'Pixel 8',
        platform: 'android',
        occurredAt: 1,
        status: 'succeeded',
        recoveryDestination: { kind: 'security', eventId: 'event-1' }
      },
      {
        id: 'event-2',
        type: 'access_protection_change',
        deviceLabel: 'Device',
        platform: 'android',
        occurredAt: 2,
        status: 'pending',
        recoveryDestination: { kind: 'settings', destination: 'security' }
      }
    ],
    nextCursor: null,
    total: 2
  };
}
