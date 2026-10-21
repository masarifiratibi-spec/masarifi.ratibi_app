import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { getClerkInstance, useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { MobileIdentityProvider } from '@/services/live/clerk-provider';
import {
  loadDeletionCompletion,
  saveDeletionCompletion
} from '@/storage/deletion-completion-journal';
import {
  deletionNative,
  resetDeletionNative,
  seedDeletedOwner
} from '@/test-utils/deletion-native-boundaries';
import { AccountDeletionPanel } from '@/features/settings/AccountDeletionPanel';
import { DevAccountDeletionRecovery } from '@/features/settings/DevAccountDeletionRecovery';

jest.mock(
  'expo-crypto',
  () =>
    jest.requireActual('@/test-utils/deletion-native-boundaries').deletionNative
      .crypto
);
jest.mock(
  'expo-secure-store',
  () =>
    jest.requireActual('@/test-utils/deletion-native-boundaries').deletionNative
      .secureStore
);
jest.mock(
  'expo-file-system',
  () =>
    jest.requireActual('@/test-utils/deletion-native-boundaries').deletionNative
      .fileSystem
);
jest.mock(
  'expo-sqlite',
  () =>
    jest.requireActual('@/test-utils/deletion-native-boundaries').deletionNative
      .sqlite
);

let clerkOwner: string | null;
const fetchBoundary = jest.fn();
const sdkToken = jest.fn(async () => 'sdk_fresh_token');
const sdkSignOut = jest.fn(async (): Promise<void> => undefined);
const request = {
  id: 'dd7b8232-9442-489f-8a4d-4e9e3c3e9386',
  status: 'completed',
  requestedAt: '2026-10-16T08:00:00.000Z',
  coolingOffEndsAt: '2026-10-16T08:00:00.000Z',
  completedAt: '2026-10-16T08:00:00.000Z',
  retainedCategories: [],
  version: 3
};
function successful(payload: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    json: async () => payload,
    headers: new Headers()
  } as Response;
}
function session(ownerId: string | null) {
  useAppShellStore.setState({
    session: ownerId
      ? {
          status: 'authenticated',
          userId: ownerId,
          method: 'google',
          issuedAt: Date.now() - 1_000,
          expiresAt: Date.now() + 60_000,
          restoration: 'restored'
        }
      : null
  });
}
function Runtime({
  presentation = 'default'
}: {
  presentation?: 'default' | 'link';
}) {
  return (
    <MobileIdentityProvider>
      <FoundationProviders>
        <DevAccountDeletionRecovery />
        <AccountDeletionPanel presentation={presentation} />
      </FoundationProviders>
    </MobileIdentityProvider>
  );
}
beforeEach(async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  process.env.EXPO_PUBLIC_APP_VARIANT = 'staging-development-privacy';
  process.env.EXPO_PUBLIC_API_URL =
    'https://api.staging.masarifiratibi.com/dev-privacy';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_bWFzYXJpZmkudGVzdCQ';
  await AsyncStorage.clear();
  resetDeletionNative();
  changeLocale('en');
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  fetchBoundary.mockReset();
  sdkToken.mockClear();
  sdkSignOut.mockReset();
  sdkSignOut.mockResolvedValue(undefined);
  global.fetch = fetchBoundary;
  (useAuth as jest.Mock).mockImplementation(() => ({
    isLoaded: true,
    isSignedIn: clerkOwner !== null,
    sessionId: clerkOwner ? `session_${clerkOwner}` : null,
    getToken: sdkToken,
    signOut: sdkSignOut
  }));
  (getClerkInstance as jest.Mock).mockImplementation(() => ({
    user: clerkOwner ? { id: clerkOwner } : null,
    session: clerkOwner
      ? {
          id: `session_${clerkOwner}`,
          status: 'active',
          lastActiveAt: new Date(Date.now() - 1_000),
          expireAt: new Date(Date.now() + 60_000)
        }
      : null,
    status: 'ready',
    on: () => undefined,
    off: () => undefined
  }));
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
});

test('shows irreversible confirmation and progress from the compact entry, then removes deletion UI after sign-out', async () => {
  const owner = 'user_native_revoked';
  clerkOwner = owner;
  session(owner);
  const ownerFile = seedDeletedOwner(owner);
  let finishPost!: (response: Response) => void;
  fetchBoundary.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finishPost = resolve;
      })
  );
  const confirmation = jest
    .spyOn(Alert, 'alert')
    .mockImplementation(() => undefined);
  render(<Runtime presentation="link" />);
  const deleteButton = await screen.findByRole('button', {
    name: t('appShell.security.deleteAccount')
  });
  await waitFor(() => expect(deleteButton).toBeEnabled());
  expect(deleteButton).toHaveStyle({ backgroundColor: 'transparent' });
  expect(screen.queryByText(t('settings.deletion.dev.description'))).toBeNull();
  expect(screen.queryByText(t('settings.deletion.retentionNotice'))).toBeNull();
  fireEvent.press(deleteButton);
  expect(confirmation).toHaveBeenCalledWith(
    t('appShell.security.deleteAccount'),
    t('settings.deletion.dev.confirmation'),
    expect.any(Array)
  );
  await act(async () => {
    confirmation.mock.calls[0][2]
      ?.find((button) => button.style === 'destructive')
      ?.onPress?.();
  });
  expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  expect(screen.queryByText(t('settings.deletion.dev.deleting'), { includeHiddenElements: true })).toBeNull();
  await waitFor(() => expect(fetchBoundary).toHaveBeenCalledTimes(1));
  expect(sdkToken).toHaveBeenCalledWith({ skipCache: true });
  expect((await loadDeletionCompletion(owner))?.phase).toBe('submitted');
  await act(async () => {
    clerkOwner = null;
    session(null);
    finishPost(successful(request, 202));
  });
  await waitFor(async () =>
    expect(await loadDeletionCompletion(owner)).toBeNull()
  );
  expect(screen.queryByText(t('settings.deletion.dev.completed'))).toBeNull();
  expect(deletionNative.files.has(ownerFile)).toBe(false);
  expect(await loadDeletionCompletion(owner)).toBeNull();
  confirmation.mockRestore();
});

test('relaunches signed out and recovers a persisted capability without obtaining a Clerk token or posting again', async () => {
  const owner = 'user_cold_recovery';
  clerkOwner = null;
  session(null);
  const ownerFile = seedDeletedOwner(owner);
  await saveDeletionCompletion({
    ownerId: owner,
    operationId: 'e19e67d3-467d-4319-a410-b643532e4bb4',
    completionToken: 'd'.repeat(64),
    phase: 'submitted',
    requestId: null,
    completedAt: null,
    attempts: 0,
    nextAttemptAt: 0,
    retryAfterAt: 0
  });
  fetchBoundary.mockResolvedValueOnce(
    successful({
      id: request.id,
      status: 'completed',
      completedAt: request.completedAt,
      errorCode: null,
      version: 3
    })
  );
  render(<Runtime />);
  await waitFor(async () =>
    expect(await loadDeletionCompletion(owner)).toBeNull()
  );
  expect(screen.queryByText(t('settings.deletion.dev.completed'))).toBeNull();
  expect(fetchBoundary).toHaveBeenCalledTimes(1);
  expect(fetchBoundary.mock.calls[0][1].method).toBe('GET');
  expect(fetchBoundary.mock.calls[0][1].headers.Authorization).toBe(
    `Bearer ${'d'.repeat(64)}`
  );
  expect(sdkToken).not.toHaveBeenCalled();
  expect(deletionNative.files.has(ownerFile)).toBe(false);
});

test('the SDK signs out only the captured old session when another owner becomes active during cleanup', async () => {
  const owner = 'user_switch_during_sdk';
  const other = 'user_kept_during_sdk';
  clerkOwner = owner;
  session(owner);
  const otherFile = seedDeletedOwner(other);
  let releaseSdk!: () => void;
  sdkSignOut.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        releaseSdk = resolve;
      })
  );
  fetchBoundary.mockResolvedValueOnce(successful(request, 202));
  const confirmation = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  const runtime = render(<Runtime />);
  const deleteButton = await screen.findByRole('button', {
    name: t('appShell.security.deleteAccount')
  });
  await waitFor(() => expect(deleteButton).toBeEnabled());
  fireEvent.press(deleteButton);
  await waitFor(() =>
    expect(sdkSignOut).toHaveBeenCalledWith({ sessionId: `session_${owner}` })
  );
  await act(async () => {
    clerkOwner = other;
    session(other);
    runtime.rerender(<Runtime />);
    releaseSdk();
  });
  await waitFor(async () =>
    expect(await loadDeletionCompletion(owner)).toBeNull()
  );
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(deletionNative.files.has(otherFile)).toBe(true);
  expect(screen.queryByText(t('settings.deletion.dev.completed'))).toBeNull();
  confirmation.mockRestore();
});

test('foreground activation recovers a lost response after Clerk revocation without a new POST', async () => {
  const owner = 'user_resume_on_foreground';
  clerkOwner = owner;
  session(owner);
  const appStateListeners = new Set<(state: AppStateStatus) => void>();
  const appState = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      appStateListeners.add(listener);
      return {
        remove: () => {
          appStateListeners.delete(listener);
        }
      };
    });
  const logs = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const confirmation = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  fetchBoundary.mockRejectedValueOnce(
    new TypeError('connection lost after sending')
  );
  render(<Runtime />);
  const deleteButton = await screen.findByRole('button', {
    name: t('appShell.security.deleteAccount')
  });
  await waitFor(() => expect(deleteButton).toBeEnabled());
  fireEvent.press(deleteButton);
  await screen.findByText(t('settings.deletion.error'));
  await act(async () => {
    clerkOwner = null;
    session(null);
  });
  fetchBoundary.mockResolvedValueOnce(
    successful({
      id: request.id,
      status: 'completed',
      completedAt: request.completedAt,
      errorCode: null,
      version: 3
    })
  );
  await act(async () => {
    appStateListeners.forEach((listener) => listener('active'));
  });
  await waitFor(async () =>
    expect(await loadDeletionCompletion(owner)).toBeNull()
  );
  expect(screen.queryByText(t('settings.deletion.dev.completed'))).toBeNull();
  expect(fetchBoundary.mock.calls.map(([, init]) => init.method)).toEqual([
    'POST',
    'GET'
  ]);
  expect(sdkToken).toHaveBeenCalledTimes(1);
  appState.mockRestore();
  logs.mockRestore();
  confirmation.mockRestore();
});
