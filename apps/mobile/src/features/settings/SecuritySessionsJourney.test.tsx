import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('./settings-queries', () => ({
  useSettingsSessions: jest.fn(),
  useRevokeSession: jest.fn(),
  useRevokeAllSessions: jest.fn(),
  useSecurityEvents: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./settings-queries') as {
  useSettingsSessions: jest.Mock;
  useRevokeSession: jest.Mock;
  useRevokeAllSessions: jest.Mock;
  useSecurityEvents: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SecurityEventScreen } = require('./SecurityEventScreen') as { SecurityEventScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SessionListScreen } = require('./SessionListScreen') as { SessionListScreen: React.ComponentType };

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSettingsSessions.mockReturnValue({ data: sessions(), isLoading: false, isError: false });
  mockQueries.useRevokeSession.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.useRevokeAllSessions.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.useSecurityEvents.mockReturnValue({ data: events(), isLoading: false, isError: false });
});

test('session list shows current/other/expired/revoked sessions and success-only revocation actions', () => {
  const revoke = jest.fn();
  const revokeAll = jest.fn();
  mockQueries.useRevokeSession.mockReturnValue({ mutate: revoke, isPending: false });
  mockQueries.useRevokeAllSessions.mockReturnValue({ mutate: revokeAll, isPending: false });

  renderWithProviders(<SessionListScreen />);

  expect(screen.getByText(t('settings.sessions.current'))).toBeTruthy();
  expect(screen.getByText('Pixel 8')).toBeTruthy();
  expect(screen.getByText('Old iPhone')).toBeTruthy();
  expect(screen.getByText('MacBook')).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.revoking'))).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.revoked'))).toBeTruthy();

  fireEvent.press(screen.getByText(t('settings.sessions.revoke', { device: 'Old iPhone' })));
  fireEvent.press(screen.getByText(t('settings.sessions.revokeAll')));
  fireEvent.press(screen.getAllByText(t('settings.sessions.revokeAll')).at(-1)!);

  expect(revoke).toHaveBeenCalledWith({ sessionId: 'session-2', operationId: expect.stringMatching(/^settings-revoke-session-/) });
  expect(revokeAll).toHaveBeenCalledWith({ operationId: expect.stringMatching(/^settings-revoke-all-/) });
});

test('session revocation exposes pending, failure recovery, and success-only current clearing', () => {
  mockQueries.useRevokeSession.mockReturnValue({ mutate: jest.fn(), isPending: true, isError: false, isSuccess: false });
  mockQueries.useRevokeAllSessions.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: true, isSuccess: false });

  renderWithProviders(<SessionListScreen />);

  expect(screen.getByText(t('settings.sessions.pending'))).toBeTruthy();
  expect(screen.getByText(t('settings.sessions.failure'))).toBeTruthy();
  expect(screen.queryByText(t('settings.sessions.currentCleared'))).toBeNull();
});

test('non-current session revoke success does not claim current session clearing', () => {
  mockQueries.useRevokeSession.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false, isSuccess: true, data: { value: sessions()[1] } });

  renderWithProviders(<SessionListScreen />);

  expect(screen.queryByText(t('settings.sessions.currentCleared'))).toBeNull();
});

test('current clearing is visible after current-session or revoke-all success only', () => {
  mockQueries.useRevokeSession.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false, isSuccess: true, data: { value: sessions()[0] } });
  const current = renderWithProviders(<SessionListScreen />);
  expect(screen.getByText(t('settings.sessions.currentCleared'))).toBeTruthy();
  current.unmount();

  mockQueries.useRevokeSession.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false, isSuccess: false });
  mockQueries.useRevokeAllSessions.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false, isSuccess: true });
  renderWithProviders(<SessionListScreen />);
  expect(screen.getByText(t('settings.sessions.currentCleared'))).toBeTruthy();
});

test('security events show masked context and recovery destinations without raw technical values', () => {
  renderWithProviders(<SecurityEventScreen />);

  expect(screen.getByText(t('settings.securityEvents.new_session'))).toBeTruthy();
  expect(screen.getByText(t('settings.securityEvents.access_protection_change'))).toBeTruthy();
  expect(screen.getByText(t('settings.securityEvents.recover.security'))).toBeTruthy();
  expect(screen.queryByText(/token|ip address|credential|secret/i)).toBeNull();
});

function sessions() {
  return [
    { id: 'session-1', deviceLabel: 'Pixel 8', platform: 'android', createdAt: 1, lastActiveAt: 2, isCurrentDevice: true, status: 'active' },
    { id: 'session-2', deviceLabel: 'Old iPhone', platform: 'ios', createdAt: 1, lastActiveAt: 2, isCurrentDevice: false, status: 'active' },
    { id: 'session-3', deviceLabel: 'MacBook', platform: 'web', createdAt: 1, lastActiveAt: 2, isCurrentDevice: false, status: 'revoking' },
    { id: 'session-4', deviceLabel: 'Web', platform: 'web', createdAt: 1, lastActiveAt: 2, isCurrentDevice: false, status: 'revoked' }
  ];
}

function events() {
  return {
    items: [
      { id: 'event-1', type: 'new_session', deviceLabel: 'Pixel 8', platform: 'android', occurredAt: 1, status: 'succeeded', recoveryDestination: { kind: 'security', eventId: 'event-1' } },
      { id: 'event-2', type: 'access_protection_change', deviceLabel: 'Device', platform: 'android', occurredAt: 2, status: 'pending', recoveryDestination: { kind: 'settings', destination: 'security' } }
    ],
    nextCursor: null,
    total: 2
  };
}
