import React from 'react';
import { Alert, AppState, Platform, type AppStateStatus } from 'react-native';
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
import {
  beginTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import { trackingNativeRuntime } from './platform/tracking-native-runtime';
import { createHash } from 'node:crypto';

jest.mock('./platform/tracking-native-runtime', () => ({
  trackingNativeRuntime: {
    prepareTrackingOwnerV4: jest.fn(async () => {
      throw new Error('deleted_owner_must_not_be_admitted');
    }),
    commitTrackingOwnerV4: jest.fn(async () => {
      throw new Error('deleted_owner_must_not_be_admitted');
    }),
    resumeTrackingOwnerPurgeV4: jest.fn(async () => undefined)
  }
}));
const originalPlatform = Platform.OS;

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
const originalAppStateListener = jest.isMockFunction(AppState.addEventListener)
  ? jest.mocked(AppState.addEventListener).getMockImplementation()
  : undefined;
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
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    headers: new Headers()
  } as Response;
}
function productionRuntime() {
  process.env.EXPO_PUBLIC_APP_VARIANT = 'production';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.masarifiratibi.com';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_bWFzYXJpZmkudGVzdCQ';
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
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform
  });
  if (
    originalAppStateListener &&
    jest.isMockFunction(AppState.addEventListener)
  )
    jest
      .mocked(AppState.addEventListener)
      .mockImplementation(originalAppStateListener);
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
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform
  });
  delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
});

test.each(['staging-development-privacy', undefined, 'production'])(
  'keeps confirmed deletion receipt-backed through SDK revocation and cleanup (%s)',
  async (variant) => {
    if (variant === undefined) {
      delete process.env.EXPO_PUBLIC_APP_VARIANT;
      process.env.EXPO_PUBLIC_API_URL =
        'https://api.staging.masarifiratibi.com';
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
        'pk_live_bWFzYXJpZmkudGVzdCQ';
    }
    if (variant === 'production') {
      productionRuntime();
    }
    const owner =
      variant === 'production'
        ? 'user_production_revoked'
        : variant === undefined
          ? 'user_ordinary_revoked'
          : 'user_native_revoked';
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
    expect(
      screen.queryByText(t('settings.deletion.dev.description'))
    ).toBeNull();
    expect(
      screen.queryByText(t('settings.deletion.retentionNotice'))
    ).toBeNull();
    fireEvent.press(deleteButton);
    expect(confirmation).toHaveBeenCalledWith(
      t('appShell.security.deleteAccount'),
      t(
        variant === 'production'
          ? 'appShell.security.deleteAccount.confirmation'
          : 'settings.deletion.dev.confirmation'
      ),
      expect.any(Array)
    );
    await act(async () => {
      confirmation.mock.calls[0][2]
        ?.find((button) => button.style === 'destructive')
        ?.onPress?.();
    });
    await waitFor(() => expect(fetchBoundary).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchBoundary.mock.calls[0][1].body)).toMatchObject({
      confirmation: 'DELETE_MY_ACCOUNT',
      completionToken: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
    expect(
      screen.queryByText(t('settings.deletion.dev.deleting'), {
        includeHiddenElements: true
      })
    ).toBeNull();
    if (variant === undefined)
      expect(fetchBoundary.mock.calls[0][0]).toBe(
        'https://api.staging.masarifiratibi.com/account-deletion/api/v1/me/deletion-requests'
      );
    if (variant === 'production')
      expect(fetchBoundary.mock.calls[0][0]).toBe(
        'https://api.masarifiratibi.com/api/v1/me/deletion-requests'
      );
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
  }
);

test.each(['development', 'production'])(
  'recovers a persisted capability signed out without a Clerk token or POST (%s)',
  async (variant) => {
    if (variant === 'production') productionRuntime();
    const owner = `user_cold_recovery_${variant}`;
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
  }
);

test.each(['development', 'production'])(
  'preserves another owner and SDK session during captured-owner cleanup (%s)',
  async (variant) => {
    if (variant === 'production') productionRuntime();
    const owner = `user_switch_during_sdk_${variant}`;
    const other = `user_kept_during_sdk_${variant}`;
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
  }
);

test.each(['development', 'production'])(
  'recovers a lost response after SDK revocation on foreground without another POST (%s)',
  async (variant) => {
    if (variant === 'production') productionRuntime();
    const owner = `user_resume_on_foreground_${variant}`;
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
    const logs = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
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
  }
);

test.each([false, true])(
  'continues a persisted Production deletion without a code, while refusing a different SDK owner: %s',
  async (foreignSdk) => {
    productionRuntime();
    const owner = 'user_production_saved_deletion';
    clerkOwner = owner;
    session(owner);
    const file = seedDeletedOwner(owner);
    const otherFile = seedDeletedOwner('user_other_retained');
    const retained = {
      ownerId: owner,
      operationId: 'd2227d58-f407-4867-89d8-8843d7a6fef6',
      completionToken: 'e'.repeat(64),
      phase: 'verification_required' as const,
      requestId: null,
      completedAt: null,
      attempts: 0,
      nextAttemptAt: 0,
      retryAfterAt: 0
    };
    await saveDeletionCompletion(retained);
    const startVerification = jest.fn();
    (getClerkInstance as jest.Mock).mockImplementation(() => ({
      user: { id: clerkOwner },
      session: {
        id: `session_${clerkOwner}`,
        status: 'active',
        lastActiveAt: new Date(Date.now() - 1000),
        expireAt: new Date(Date.now() + 60000),
        startVerification
      },
      status: 'ready',
      on: () => undefined,
      off: () => undefined
    }));
    const confirmation = jest.spyOn(Alert, 'alert');
    try {
      render(<Runtime />);
      const resume = await screen.findByRole('button', {
        name: t('settings.deletion.continue')
      });
      expect(
        screen.queryByRole('button', { name: t('settings.deletion.reverify') })
      ).toBeNull();
      expect(screen.queryByLabelText(t('settings.deletion.code'))).toBeNull();
      expect(fetchBoundary).not.toHaveBeenCalled();
      if (foreignSdk) clerkOwner = 'user_other_retained';
      else fetchBoundary.mockResolvedValueOnce(successful(request, 202));
      fireEvent.press(resume);
      if (foreignSdk) {
        await screen.findByText(t('settings.deletion.error'));
        expect(fetchBoundary).not.toHaveBeenCalled();
        expect(await loadDeletionCompletion(owner)).toEqual(retained);
        expect(deletionNative.files.has(file)).toBe(true);
      } else {
        await waitFor(async () =>
          expect(await loadDeletionCompletion(owner)).toBeNull()
        );
        expect(fetchBoundary).toHaveBeenCalledTimes(1);
        expect(fetchBoundary.mock.calls[0][1].headers['Idempotency-Key']).toBe(
          retained.operationId
        );
        expect(
          JSON.parse(fetchBoundary.mock.calls[0][1].body).completionToken
        ).toBe(retained.completionToken);
        expect(deletionNative.files.has(file)).toBe(false);
      }
      expect(deletionNative.files.has(otherFile)).toBe(true);
      expect(startVerification).not.toHaveBeenCalled();
      expect(confirmation).not.toHaveBeenCalled();
    } finally {
      confirmation.mockRestore();
    }
  }
);

test.each([false, true])(
  'completes Android receipt recovery without admitting the deleted owner; other active owner=%s',
  async (otherActive) => {
    productionRuntime();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android'
    });
    const owner = 'user_android_deleted';
    const other = 'user_android_retained';
    clerkOwner = otherActive ? other : null;
    session(clerkOwner);
    beginTrackingAdmission();
    if (otherActive)
      useTrackingAdmission.setState({
        ready: true,
        admittedOwnerId: other,
        nativeLease: {
          ownerDigest: createHash('sha256').update(other).digest('hex'),
          generation: 'retained-generation-1234'
        },
        sessionAnchor: 'retained-session'
      });
    const file = seedDeletedOwner(owner);
    const retainedFile = seedDeletedOwner(other);
    const digest = createHash('sha256').update(owner).digest('hex');
    const contextKey = `masarifi.tracking.background-context.v3.${digest}`;
    deletionNative.secrets.set(
      contextKey,
      JSON.stringify({
        version: 3,
        ownerId: owner,
        generation: 'deleted-generation-1234',
        phase: 'committed'
      })
    );
    const otherKey = `masarifi.tracking.background-context.v3.${createHash('sha256').update(other).digest('hex')}`;
    deletionNative.secrets.set(otherKey, 'retained other owner bytes');
    await saveDeletionCompletion({
      ownerId: owner,
      operationId: '0f8dd8dd-df36-413a-9bd0-50ccfce872fe',
      completionToken: 'a'.repeat(64),
      phase: 'submitted',
      requestId: null,
      completedAt: null,
      attempts: 0,
      nextAttemptAt: 0,
      retryAfterAt: 0
    });
    let finishReceipt!: (value: Response) => void;
    fetchBoundary.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishReceipt = resolve;
        })
    );
    const purge = jest.mocked(
      trackingNativeRuntime!.resumeTrackingOwnerPurgeV4!
    );
    purge.mockClear();
    render(<Runtime />);
    await waitFor(() => expect(fetchBoundary).toHaveBeenCalledTimes(1));
    const admission = { ...useTrackingAdmission.getState() };
    expect(admission.ready).toBe(false);
    await act(async () =>
      finishReceipt(
        successful({
          id: request.id,
          status: 'completed',
          completedAt: request.completedAt,
          errorCode: null,
          version: 3
        })
      )
    );
    await waitFor(async () =>
      expect(await loadDeletionCompletion(owner)).toBeNull()
    );
    expect(purge).toHaveBeenCalledWith(digest, 'deleted-generation-1234');
    expect(deletionNative.secrets.has(contextKey)).toBe(false);
    expect(deletionNative.secrets.get(otherKey)).toBe(
      'retained other owner bytes'
    );
    expect(deletionNative.files.has(file)).toBe(false);
    expect(deletionNative.files.has(retainedFile)).toBe(true);
    expect(useAppShellStore.getState().session?.userId ?? null).toBe(
      otherActive ? other : null
    );
    expect(useTrackingAdmission.getState()).toEqual(admission);
    expect(
      trackingNativeRuntime!.prepareTrackingOwnerV4
    ).not.toHaveBeenCalled();
    expect(sdkSignOut).not.toHaveBeenCalled();
  }
);

test.each(['unconfirmed', 'changed'] as const)(
  'refuses local erasure without the same durable completed receipt: %s',
  async (kind) => {
    productionRuntime();
    clerkOwner = null;
    session(null);
    const owner = 'user_receipt_guard';
    const file = seedDeletedOwner(owner);
    const journal = {
      ownerId: owner,
      operationId: 'cf7887b8-6123-44c7-a5f7-9310fd0afca9',
      completionToken: 'b'.repeat(64),
      phase:
        kind === 'unconfirmed'
          ? ('submitted' as const)
          : ('server_completed' as const),
      requestId: kind === 'unconfirmed' ? null : request.id,
      completedAt: kind === 'unconfirmed' ? null : request.completedAt,
      attempts: 0,
      nextAttemptAt: 0,
      retryAfterAt: 0
    };
    await saveDeletionCompletion(journal);
    const read = deletionNative.secureStore.getItemAsync;
    const original = read.getMockImplementation()!;
    if (kind === 'changed')
      read.mockImplementationOnce(async (key) => {
        const value = await original(key);
        deletionNative.secrets.set(
          key,
          JSON.stringify({ ...journal, requestId: 'another-receipt' })
        );
        return value;
      });
    const purge = jest.mocked(
      trackingNativeRuntime!.resumeTrackingOwnerPurgeV4!
    );
    const calls = purge.mock.calls.length;
    const { eraseDeletedAccountLocalData } = jest.requireActual<
      typeof import('./account-data-erasure')
    >('./account-data-erasure');
    await expect(eraseDeletedAccountLocalData(owner)).rejects.toThrow(
      kind === 'unconfirmed'
        ? 'deletion_completion_unverified'
        : 'deletion_completion_changed'
    );
    expect(deletionNative.files.has(file)).toBe(true);
    expect(purge).toHaveBeenCalledTimes(calls);
  }
);
