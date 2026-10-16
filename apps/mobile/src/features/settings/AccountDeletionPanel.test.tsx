import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getClerkInstance } from '@clerk/expo';
import * as ExpoCrypto from 'expo-crypto';

import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import { HttpError } from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import {
  loadAccountDeletionJournal,
  saveAccountDeletionOperationId,
  saveAccountDeletionRequestId
} from '@/storage/account-deletion-journal';
import {
  readAsyncStorageForTest,
  resetAsyncStorageForTest
} from '@/test-utils/async-storage';
import { renderWithProviders } from '@/test-utils/render';
import SecuritySettingsRoute from '@app/security/settings';
import { PrivacySettingsScreen } from './PrivacySettingsScreen';
import { AccountDeletionPanel } from './AccountDeletionPanel';

const mockRequest = jest.fn();
jest.mock('@/services/mocks/subscription-settings-service', () => ({
  ...jest.requireActual('@/services/mocks/subscription-settings-service'),
  settingsService: jest
    .requireActual('@/services/live/auth-service')
    .createLiveIdentityService({
      request: (...args: unknown[]) => mockRequest(...args)
    })
}));

const deletion = {
  id: 'deletion-123',
  status: 'verified',
  requestedAt: '2026-10-16T00:00:00.000Z',
  coolingOffEndsAt: '2099-10-17T00:00:00.000Z',
  completedAt: null,
  retainedCategories: [],
  version: 1
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockRequest.mockReset();
  await resetAsyncStorageForTest();
  let operationSequence = 0;
  jest
    .spyOn(ExpoCrypto, 'randomUUID')
    .mockImplementation(
      () =>
        `11111111-1111-4111-8111-${(++operationSequence).toString().padStart(12, '0')}`
    );
  changeLocale('en');
  useAppShellStore.setState({
    session: { userId: 'disposable-owner', status: 'authenticated' } as never
  });
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });
});

test('shows the real cooling-off deadline and offers confirmed cancellation without claiming deletion complete', async () => {
  mockRequest.mockResolvedValueOnce(deletion).mockResolvedValueOnce(null);
  renderWithProviders(<AccountDeletionPanel />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(screen.getByText(/2099/)).toBeTruthy();
  expect(
    screen.queryByText(t('settings.deletion.status.completed'))
  ).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: t('settings.deletion.cancel') })
  );
  await screen.findByText(t('settings.deletion.status.cancelled'));
  expect(await loadAccountDeletionJournal('disposable-owner')).toEqual({
    requestId: 'deletion-123',
    operationId: null
  });
  expect(mockRequest).toHaveBeenLastCalledWith(
    '/api/v1/me/deletion-requests/deletion-123',
    expect.objectContaining({ method: 'DELETE' })
  );
});

test('explains recent authentication and resumes the confirmed request after Clerk verifies the current session', async () => {
  mockRequest
    .mockRejectedValueOnce(
      new HttpError('session_expired', 403, 'RECENT_AUTH_REQUIRED')
    )
    .mockResolvedValueOnce(deletion);
  const session = {
    id: 'session-a',
    status: 'active',
    startVerification: jest.fn().mockResolvedValue({
      supportedFirstFactors: [
        {
          strategy: 'phone_code',
          phoneNumberId: 'phone-a',
          safeIdentifier: '+966 *** 123'
        }
      ]
    }),
    prepareFirstFactorVerification: jest.fn().mockResolvedValue({}),
    attemptFirstFactorVerification: jest
      .fn()
      .mockResolvedValue({ status: 'complete' }),
    getToken: jest.fn().mockResolvedValue('fresh-token')
  };
  (getClerkInstance as jest.Mock).mockReturnValue({
    user: { id: 'disposable-owner' },
    session
  });
  renderWithProviders(<AccountDeletionPanel />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await screen.findByText(t('settings.deletion.recentAuth'));
  fireEvent.press(
    screen.getByRole('button', { name: t('settings.deletion.reverify') })
  );
  fireEvent.changeText(
    await screen.findByLabelText(t('settings.deletion.code')),
    '123456'
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('settings.deletion.verify') })
  );
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(session.getToken).toHaveBeenCalledWith({ skipCache: true });
  expect(mockRequest.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    mockRequest.mock.calls[1][1].headers['Idempotency-Key']
  );
});

test('restores the owned request after reopening and reports refresh errors visibly', async () => {
  await saveAccountDeletionRequestId('disposable-owner', 'deletion-123');
  mockRequest
    .mockResolvedValueOnce(deletion)
    .mockRejectedValueOnce(new HttpError('provider_unavailable', 503));
  renderWithProviders(<AccountDeletionPanel />);
  await screen.findByText(t('settings.deletion.status.verified'));
  fireEvent.press(
    screen.getByRole('button', { name: t('settings.deletion.refresh') })
  );
  await screen.findByText(t('settings.deletion.error'));
  expect(
    screen.getByRole('button', { name: t('settings.deletion.refresh') })
  ).toBeEnabled();
});

test.each([
  ['rate_limited', 429, 'settings.deletion.rateLimited'],
  ['provider_unavailable', 503, 'settings.deletion.error']
] as const)(
  'retries restoration after %s without offering a new deletion',
  async (code, status, message) => {
    await saveAccountDeletionRequestId('disposable-owner', 'deletion-123');
    await saveAccountDeletionOperationId(
      'disposable-owner',
      'existing-operation'
    );
    mockRequest
      .mockRejectedValueOnce(new HttpError(code, status))
      .mockResolvedValueOnce(deletion);
    renderWithProviders(<AccountDeletionPanel />);
    await screen.findByText(t(message));
    expect(
      screen.queryByRole('button', {
        name: t('appShell.security.deleteAccount')
      })
    ).toBeNull();
    fireEvent.press(
      screen.getByRole('button', { name: t('settings.deletion.refresh') })
    );
    await screen.findByText(t('settings.deletion.status.verified'));
    expect(screen.getByText(/2099/)).toBeTruthy();
    expect(await loadAccountDeletionJournal('disposable-owner')).toEqual({
      requestId: 'deletion-123',
      operationId: 'existing-operation'
    });
    expect(
      mockRequest.mock.calls.map(([path, options]) => [
        path,
        options?.method ?? 'GET'
      ])
    ).toEqual([
      ['/api/v1/me/deletion-requests/deletion-123', 'GET'],
      ['/api/v1/me/deletion-requests/deletion-123', 'GET']
    ]);
  }
);

test('recovers each switched owner independently and persists only request and operation identifiers', async () => {
  await saveAccountDeletionRequestId('disposable-owner', 'deletion-123');
  await saveAccountDeletionOperationId('disposable-owner', 'operation-first');
  await saveAccountDeletionRequestId('another-owner', 'deletion-other');
  await saveAccountDeletionOperationId('another-owner', 'operation-other');
  mockRequest
    .mockResolvedValueOnce(deletion)
    .mockResolvedValueOnce({ ...deletion, id: 'deletion-other' });
  renderWithProviders(<AccountDeletionPanel />);
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(mockRequest.mock.calls[0]?.[0]).toBe(
    '/api/v1/me/deletion-requests/deletion-123'
  );
  await act(async () => {
    useAppShellStore.setState({
      session: { userId: 'another-owner', status: 'authenticated' } as never
    });
  });
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(mockRequest.mock.calls[1]?.[0]).toBe(
    '/api/v1/me/deletion-requests/deletion-other'
  );
  expect(await loadAccountDeletionJournal('disposable-owner')).toEqual({
    requestId: 'deletion-123',
    operationId: 'operation-first'
  });
  expect(await loadAccountDeletionJournal('another-owner')).toEqual({
    requestId: 'deletion-other',
    operationId: 'operation-other'
  });
  const deletionEntries = Object.entries(
    await readAsyncStorageForTest()
  ).filter(([key]) => key.startsWith('masarifi.deletion.'));
  expect(Object.fromEntries(deletionEntries)).toEqual({
    'masarifi.deletion.disposable-owner': 'deletion-123',
    'masarifi.deletion.disposable-owner.operation': 'operation-first',
    'masarifi.deletion.another-owner': 'deletion-other',
    'masarifi.deletion.another-owner.operation': 'operation-other'
  });
});

test('a failed terminal request starts a new operation after reopening', async () => {
  await saveAccountDeletionRequestId('disposable-owner', 'deletion-123');
  await saveAccountDeletionOperationId('disposable-owner', 'prior-operation');
  mockRequest
    .mockResolvedValueOnce({ ...deletion, status: 'failed' })
    .mockResolvedValueOnce(deletion);
  renderWithProviders(<AccountDeletionPanel />);
  await screen.findByText(t('settings.deletion.status.failed'));
  expect(
    (await loadAccountDeletionJournal('disposable-owner')).operationId
  ).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(mockRequest.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(
    'prior-operation'
  );
});

test('confirmed completion clears the local authenticated session', async () => {
  mockRequest.mockResolvedValueOnce({
    ...deletion,
    status: 'completed',
    completedAt: '2026-10-16T01:00:00.000Z'
  });
  renderWithProviders(<AccountDeletionPanel />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await waitFor(() =>
    expect(useAppShellStore.getState().session?.status).toBe('signed_out')
  );
});

test('a late completion for the previous owner cannot sign out the switched owner', async () => {
  let resolveRequest!: (result: unknown) => void;
  mockRequest.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveRequest = resolve;
    })
  );
  renderWithProviders(<AccountDeletionPanel />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  await act(async () => {
    useAppShellStore.setState({
      session: { userId: 'another-owner', status: 'authenticated' } as never
    });
    resolveRequest({
      ...deletion,
      status: 'completed',
      completedAt: '2026-10-16T01:00:00.000Z'
    });
  });
  expect(useAppShellStore.getState().session?.userId).toBe('another-owner');
  expect(await loadAccountDeletionJournal('another-owner')).toEqual({
    requestId: null,
    operationId: null
  });
});

test('a rejected cancellation retains the actual scheduled state and displays an error in Arabic', async () => {
  changeLocale('ar');
  mockRequest
    .mockResolvedValueOnce(deletion)
    .mockRejectedValueOnce(new HttpError('conflict', 409));
  renderWithProviders(<AccountDeletionPanel />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await screen.findByText(t('settings.deletion.status.verified'));
  fireEvent.press(
    screen.getByRole('button', { name: t('settings.deletion.cancel') })
  );
  await screen.findByText(t('settings.deletion.error'));
  expect(
    screen.getByText(
      'تعذر تأكيد الطلب. تحقق من اتصالك وحاول مجددًا. لم يتم تأكيد اكتمال الحذف.'
    )
  ).toBeTruthy();
  expect(screen.getByText(t('settings.deletion.status.verified'))).toBeTruthy();
  expect(
    screen.queryByText(t('settings.deletion.status.cancelled'))
  ).toBeNull();
  expect(
    (await loadAccountDeletionJournal('disposable-owner')).operationId
  ).toBe(mockRequest.mock.calls[0][1].headers['Idempotency-Key']);
});

test.each([
  ['security', SecuritySettingsRoute],
  ['privacy', PrivacySettingsScreen]
])('%s settings exposes the governed deletion panel', async (_name, Screen) => {
  mockRequest.mockResolvedValueOnce(deletion);
  renderWithProviders(<Screen />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
  );
  await screen.findByText(t('settings.deletion.status.verified'));
  expect(
    screen.queryByText(t('settings.deletion.status.completed'))
  ).toBeNull();
});

test.each([true, false])(
  'distinguishes request transport failure after verification from an invalid code (%s)',
  async (codeAccepted) => {
    mockRequest
      .mockRejectedValueOnce(
        new HttpError('session_expired', 403, 'RECENT_AUTH_REQUIRED')
      )
      .mockRejectedValueOnce(new HttpError('provider_unavailable', 503));
    (getClerkInstance as jest.Mock).mockReturnValue({
      user: { id: 'disposable-owner' },
      session: {
        id: 'session-a',
        status: 'active',
        startVerification: jest.fn().mockResolvedValue({
          supportedFirstFactors: [
            {
              strategy: 'phone_code',
              phoneNumberId: 'phone-a',
              safeIdentifier: '+966 *** 123'
            }
          ]
        }),
        prepareFirstFactorVerification: jest.fn().mockResolvedValue({}),
        attemptFirstFactorVerification: codeAccepted
          ? jest.fn().mockResolvedValue({ status: 'complete' })
          : jest.fn().mockRejectedValue(new Error('code rejected')),
        getToken: jest.fn().mockResolvedValue('fresh-token')
      }
    });
    renderWithProviders(<AccountDeletionPanel />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: t('appShell.security.deleteAccount')
        })
      ).toBeEnabled()
    );
    fireEvent.press(
      screen.getByRole('button', { name: t('appShell.security.deleteAccount') })
    );
    await screen.findByText(t('settings.deletion.recentAuth'));
    fireEvent.press(
      screen.getByRole('button', { name: t('settings.deletion.reverify') })
    );
    fireEvent.changeText(
      await screen.findByLabelText(t('settings.deletion.code')),
      '123456'
    );
    fireEvent.press(
      screen.getByRole('button', { name: t('settings.deletion.verify') })
    );
    await screen.findByText(
      t(
        codeAccepted
          ? 'settings.deletion.error'
          : 'settings.deletion.verificationError'
      )
    );
    expect(
      screen.queryByText(t('settings.deletion.status.completed'))
    ).toBeNull();
  }
);
