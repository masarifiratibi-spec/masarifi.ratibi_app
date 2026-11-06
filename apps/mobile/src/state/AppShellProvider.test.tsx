import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import React from 'react';
import {
  Alert,
  AppState,
  Linking,
  Text,
  type AppStateStatus
} from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { clearAppShellStorageOwner } from '@/storage/app-shell-storage';

import {
  AppShellHydrationProvider,
  AppShellProvider
} from './AppShellProvider';
import * as database from '@/storage/database';
import { useAppShellStore } from './app-shell';
import { usePreferenceStore } from './preferences';
import { HttpError } from '@/services/live/http-client';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { resolveEntryRoute } from '@/features/shell/resolve-entry-route';
import { translate } from '@/localization/i18n';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

const mockRestoreAppShellSession = jest.fn(
  async (..._args: unknown[]) => undefined
);
const mockSynchronizeLiveCoreFinance = jest.fn(async () => undefined);
const mockRefreshPlatformOperations = jest.fn(async () => undefined);
const mockSyncAutomaticTracking = jest.fn(async () => undefined);
const mockTouchActivity = jest.fn(async () => undefined);
const mockRecordMobileForeground = jest.fn(async () => undefined);
jest.mock('@/services/live/mobile-activity', () => ({
  recordMobileForeground: () => mockRecordMobileForeground()
}));
const mockRestoreSession = jest.fn();
const mockEnsureLivePushDeviceRegistration = jest.fn(
  async (..._args: unknown[]) => 'granted'
);
let mockLiveClerkSessionKey: string | null | undefined;

jest.mock('@/features/auth/session-controller', () => ({
  restoreAppShellSession: (...args: unknown[]) =>
    mockRestoreAppShellSession(...args)
}));
jest.mock('@/features/auth/auth-flow', () => ({
  authService: {
    touchActivity: () => mockTouchActivity(),
    restoreSession: () => mockRestoreSession()
  }
}));
jest.mock('@/services/live/clerk-provider', () => ({
  useLiveClerkSessionKey: () => mockLiveClerkSessionKey
}));
jest.mock('@/services/live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: () => mockSynchronizeLiveCoreFinance()
}));
jest.mock('@/services/platform-operations-service', () => ({
  refreshPlatformOperations: () => mockRefreshPlatformOperations()
}));
jest.mock('@/services/automatic-tracking-coordinator', () => ({
  syncAutomaticTracking: () => mockSyncAutomaticTracking()
}));
jest.mock('@/services/live/engagement-service', () => ({
  ensureLivePushDeviceRegistration: (...args: unknown[]) =>
    mockEnsureLivePushDeviceRegistration(...args)
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn()
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() }
}));

describe('AppShellProvider', () => {
  it('keeps explicit encrypted-database recovery available while fonts still cover the navigator', async () => {
    const originalHydrate = useAppShellStore.getState().hydrate;
    let recovery: ((ownerId: string) => void) | undefined;
    jest
      .spyOn(database, 'configureDatabaseRecoveryListener')
      .mockImplementation((listener) => {
        recovery = listener;
      });
    const quarantine = jest.spyOn(database, 'quarantineUnrecoverableDatabase');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAppShellStore.setState({
      hydrated: false,
      hydrate: async () => {
        await Promise.resolve();
        recovery?.('user_encrypted_recovery');
      }
    });
    const view = render(
      <AppShellHydrationProvider>
        <Text>Fonts still pending</Text>
      </AppShellHydrationProvider>
    );
    try {
      await act(async () => {});
      expect(alert).toHaveBeenCalledWith(
        translate('storageRecovery.title'),
        translate('storageRecovery.body'),
        expect.arrayContaining([
          expect.objectContaining({
            text: translate('storageRecovery.confirm'),
            onPress: expect.any(Function)
          })
        ])
      );
      expect(quarantine).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      useAppShellStore.setState({ hydrate: originalHydrate });
      jest.restoreAllMocks();
    }
  });
  it('restores benchmark profile and platform reads without startup or foreground writers', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    const restoreEnvironment = installBenchmarkEnvironment();
    mockLiveClerkSessionKey = 'benchmark-owner';
    let receiveState!: (state: AppStateStatus) => void;
    const previousListener = jest
      .mocked(AppState.addEventListener)
      .getMockImplementation()!;
    const listener = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        receiveState = handler;
        return { remove: jest.fn() };
      });
    try {
      render(
        <AppShellProvider>
          <Text>benchmark read</Text>
        </AppShellProvider>
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        receiveState('active');
      });
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
      expect(mockRefreshPlatformOperations).toHaveBeenCalledTimes(2);
      expect(mockSynchronizeLiveCoreFinance).not.toHaveBeenCalled();
      expect(mockSyncAutomaticTracking).not.toHaveBeenCalled();
      expect(mockEnsureLivePushDeviceRegistration).not.toHaveBeenCalled();
      expect(mockRecordMobileForeground).not.toHaveBeenCalled();
    } finally {
      restoreEnvironment();
      listener.mockImplementation(previousListener);
    }
  });
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
    mockLiveClerkSessionKey = undefined;
    useAppShellStore.getState().reset();
    usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    mockRestoreAppShellSession.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  });

  it('starts the verified live restore while fonts still cover the navigator, without starting foreground writers', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-behind-fonts';
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);
    const tree = (fontsReady: boolean) => (
      <AppShellHydrationProvider>
        {fontsReady ? (
          <AppShellProvider>
            <ProtectedContent />
          </AppShellProvider>
        ) : (
          <Text>Fonts still pending</Text>
        )}
      </AppShellHydrationProvider>
    );
    const view = render(tree(false));
    try {
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
      expect(mockSynchronizeLiveCoreFinance).not.toHaveBeenCalled();
      expect(mockEnsureLivePushDeviceRegistration).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.queryByText('protected child')).toBeNull();
      view.rerender(tree(true));
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
      expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
      expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      hydrate.mockRestore();
    }
  });

  it('serializes a replaced SDK session behind fonts and never admits the late original restore', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'original-session-behind-fonts';
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);
    let release!: () => void;
    const admitted: boolean[] = [];
    mockRestoreAppShellSession
      .mockImplementationOnce(async (_auth, isCurrent) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        admitted.push((isCurrent as () => boolean)());
      })
      .mockImplementationOnce(async (_auth, isCurrent) => {
        admitted.push((isCurrent as () => boolean)());
      });
    const tree = (fontsReady: boolean) => (
      <AppShellHydrationProvider>
        {fontsReady ? (
          <AppShellProvider>
            <ProtectedContent />
          </AppShellProvider>
        ) : (
          <Text>Fonts still pending</Text>
        )}
      </AppShellHydrationProvider>
    );
    const view = render(tree(false));
    try {
      await act(async () => {});
      mockLiveClerkSessionKey = 'new-session-behind-fonts';
      view.rerender(tree(false));
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
      await act(async () => release());
      expect(admitted).toEqual([false, true]);
      expect(mockSynchronizeLiveCoreFinance).not.toHaveBeenCalled();
      view.rerender(tree(true));
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(2);
      expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      hydrate.mockRestore();
    }
  });

  it('does not reuse a completed A restore after A-to-B-to-A while a newer restore is still queued behind fonts', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-A';
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);
    let releaseB: (() => void) | undefined;
    mockRestoreAppShellSession
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<undefined>((resolve) => {
            releaseB = () => resolve(undefined);
          })
      )
      .mockResolvedValueOnce(undefined);
    const tree = (fontsReady: boolean) => (
      <AppShellHydrationProvider>
        {fontsReady ? (
          <AppShellProvider>
            <ProtectedContent />
          </AppShellProvider>
        ) : (
          <Text>Fonts still pending</Text>
        )}
      </AppShellHydrationProvider>
    );
    const view = render(tree(false));
    try {
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
      mockLiveClerkSessionKey = 'session-B';
      view.rerender(tree(false));
      await act(async () => {});
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(2);
      mockLiveClerkSessionKey = 'session-A';
      view.rerender(tree(true));
      await act(async () => {});
      expect(mockSynchronizeLiveCoreFinance).not.toHaveBeenCalled();
      expect(mockEnsureLivePushDeviceRegistration).not.toHaveBeenCalled();
      await act(async () => releaseB?.());
      expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(3);
      expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
      expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      await act(async () => releaseB?.());
      hydrate.mockRestore();
    }
  });

  it('bootstraps the same Clerk session after a 401 and successful Google reauthentication', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'same-clerk-session';
    const controller = jest.requireActual<
      typeof import('@/features/auth/session-controller')
    >('@/features/auth/session-controller');
    const session = {
      ...authenticatedSession,
      userId: 'user_live_google',
      expiresAt: Date.now() + 60_000
    };
    mockRestoreSession.mockResolvedValue(session);
    const getProfileSetup = jest
      .fn()
      .mockRejectedValueOnce(new HttpError('session_expired', 401))
      .mockResolvedValue({
        complete: true,
        profile: { currency: 'SAR' },
        preferences: {},
        onboarding: {}
      });
    mockRestoreAppShellSession.mockImplementation(async (auth, isCurrent) => {
      await controller.restoreAppShellSession(
        auth as never,
        isCurrent as never,
        { getProfileSetup }
      );
    });
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(useAppShellStore.getState().session?.status).toBe('expired')
    );
    await act(async () => {
      await controller.completeAuthenticatedSession(session);
    });
    await waitFor(() =>
      expect(useAppShellStore.getState().profileSetupStatus).toBe('complete')
    );
    expect(getProfileSetup).toHaveBeenCalledTimes(2);
    expect(
      resolveEntryRoute({
        ...useAppShellStore.getState(),
        firstLaunchOnboardingCompleted: true
      })
    ).toBe('/(tabs)/home');
  });

  it('always renders children on first render so the navigator mounts immediately', () => {
    // Before hydration, children must still render. The entry route — not the
    // provider — owns the loading gate, so the Expo Router Stack is never
    // unmounted (which previously caused "navigate before mounting Root Layout").
    useAppShellStore.setState({ hydrated: false });
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );

    expect(screen.getByText('protected child')).toBeOnTheScreen();
    hydrate.mockRestore();
  });

  it('triggers hydration once when not yet hydrated', async () => {
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('waits for Clerk and restores the authoritative live session', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'sess_live_123';
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);
    expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
    expect(mockSyncAutomaticTracking).toHaveBeenCalledTimes(1);
    expect(mockTouchActivity).toHaveBeenCalledTimes(1);
    expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledTimes(1);
    hydrate.mockRestore();
  });

  it('serializes live restores and rejects a stale session result', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    let releaseFirst: (() => void) | undefined;
    mockLiveClerkSessionKey = 'sess_old';
    mockRestoreAppShellSession
      .mockImplementationOnce(async (_service, isCurrent) => {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        if ((isCurrent as () => boolean)())
          useAppShellStore.setState({ pendingDestination: '/stale' });
      })
      .mockImplementationOnce(async (_service, isCurrent) => {
        if ((isCurrent as () => boolean)())
          useAppShellStore.setState({ pendingDestination: '/current' });
      });

    const view = render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => Promise.resolve());

    mockLiveClerkSessionKey = 'sess_current';
    view.rerender(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRestoreAppShellSession).toHaveBeenCalledTimes(2);
    expect(useAppShellStore.getState().pendingDestination).toBe('/current');
  });

  it('does not repeat the activity read after validated profile bootstrap, but refreshes on resume', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-profile-validated';
    let receiveState!: (state: AppStateStatus) => void;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        receiveState = listener;
        return { remove: jest.fn() };
      });
    mockRestoreAppShellSession.mockImplementation(async () => {
      useAppShellStore.setState({
        session: authenticatedSession,
        profileSetupStatus: 'complete',
        profileSetupSnapshot: { complete: true } as never
      });
    });
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1)
    );
    expect(mockTouchActivity).not.toHaveBeenCalled();
    act(() => receiveState('active'));
    expect(mockTouchActivity).toHaveBeenCalledTimes(1);
  });

  it('finishes profile bootstrap after its own owner hydration changes (September 30 Loading regression)', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-hydration-test';
    useAppShellStore.setState({ hydrated: true });
    mockRestoreSession.mockResolvedValue({
      status: 'authenticated',
      userId: 'user_live_hydration',
      method: 'google',
      issuedAt: 1,
      expiresAt: 4_000_000_000_000,
      restoration: 'restored'
    });
    let finishStorage!: (value: null) => void;
    const storage = new Promise<null>((resolve) => {
      finishStorage = resolve;
    });
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) =>
        key === 'masarifi.appShell.nativePrivacyLock.v1' ||
        key.startsWith('masarifi.appShell.nativePrivacyLock.v1.')
          ? storage
          : null
      );
    let finishProfile!: (value: unknown) => void;
    const profile = new Promise((resolve) => {
      finishProfile = resolve;
    });
    const { restoreAppShellSession } = jest.requireActual(
      '@/features/auth/session-controller'
    );
    mockRestoreAppShellSession.mockImplementation((service, isCurrent) =>
      restoreAppShellSession(service, isCurrent, {
        getProfileSetup: () => profile
      })
    );
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(useAppShellStore.getState().hydrated).toBe(false)
    );
    await act(async () => {
      finishStorage(null);
      finishProfile({ complete: true });
    });
    await waitFor(() =>
      expect(useAppShellStore.getState().profileSetupStatus).toBe('complete')
    );
    expect(useAppShellStore.getState().session?.userId).toBe(
      'user_live_hydration'
    );
  });

  it('retries a failed profile bootstrap without discarding the current authenticated owner', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-retry-test';
    const session = {
      status: 'authenticated' as const,
      userId: 'user_live_retry',
      method: 'google' as const,
      issuedAt: 1,
      expiresAt: 4_000_000_000_000,
      restoration: 'restored' as const
    };
    useAppShellStore.setState({
      hydrated: true,
      session,
      profilePromptDismissed: true
    });
    mockRestoreSession.mockResolvedValue(session);
    const getProfileSetup = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ complete: true });
    const { restoreAppShellSession } = jest.requireActual(
      '@/features/auth/session-controller'
    );
    mockRestoreAppShellSession.mockImplementation((service, isCurrent) =>
      restoreAppShellSession(service, isCurrent, { getProfileSetup })
    );
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(useAppShellStore.getState().profileSetupStatus).toBe('error')
    );
    act(() => useAppShellStore.getState().retryBootstrap());
    await waitFor(() =>
      expect(useAppShellStore.getState().profileSetupStatus).toBe('complete')
    );
    expect(useAppShellStore.getState()).toMatchObject({
      session,
      profilePromptDismissed: true
    });
  });

  it('forwards app state changes and preserves locale preferences', async () => {
    let listener: ((state: string) => void) | null = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, callback) => {
        listener = callback as (state: string) => void;
        return { remove: jest.fn() };
      });
    useAppShellStore.setState({ hydrated: true });
    const onAppStateChange = jest.fn();

    render(
      <AppShellProvider onAppStateChange={onAppStateChange}>
        <ProtectedContent />
      </AppShellProvider>
    );
    const emitAppState = listener as ((state: string) => void) | null;
    emitAppState?.('background');

    expect(onAppStateChange).toHaveBeenCalledWith('background');
    expect(usePreferenceStore.getState()).toMatchObject({
      locale: 'en',
      direction: 'ltr'
    });
  });

  it('retries live core-finance sync when an authenticated app becomes active', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'sess_live_123';
    let listener: ((state: string) => void) | null = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, callback) => {
        listener = callback as (state: string) => void;
        return { remove: jest.fn() };
      });

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockSynchronizeLiveCoreFinance.mockClear();
    mockSyncAutomaticTracking.mockClear();
    mockTouchActivity.mockClear();
    mockEnsureLivePushDeviceRegistration.mockClear();
    const emitAppState = listener as ((state: string) => void) | null;
    emitAppState?.('active');

    expect(mockSynchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
    expect(mockSyncAutomaticTracking).toHaveBeenCalledTimes(1);
    expect(mockTouchActivity).toHaveBeenCalledTimes(1);
    expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1);
  });

  it('retries failed push registration on foreground with an authenticated token source', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-push-retry';
    let receiveState!: (state: AppStateStatus) => void;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        receiveState = listener;
        return { remove: jest.fn() };
      });
    mockEnsureLivePushDeviceRegistration.mockRejectedValueOnce(
      new Error('offline')
    );
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1)
    );
    await act(async () => {
      receiveState('active');
    });
    await waitFor(() =>
      expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(2)
    );
    expect(mockEnsureLivePushDeviceRegistration.mock.calls[1]?.[0]).toEqual({
      token: expect.any(Function)
    });
  });

  it('does not start concurrent push registrations during repeated foreground events', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    mockLiveClerkSessionKey = 'session-push-flight';
    let receiveState!: (state: AppStateStatus) => void;
    let finish!: (value: string) => void;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        receiveState = listener;
        return { remove: jest.fn() };
      });
    mockEnsureLivePushDeviceRegistration.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await waitFor(() =>
      expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1)
    );
    act(() => {
      receiveState('active');
      receiveState('active');
    });
    expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish('granted');
    });
    await act(async () => {
      receiveState('active');
    });
    expect(mockEnsureLivePushDeviceRegistration).toHaveBeenCalledTimes(2);
  });

  it('retains only a safe initial deep-link destination across authentication gates', async () => {
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('masarifi://reports');
    useAppShellStore.setState({ hydrated: true });

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppShellStore.getState().pendingDestination).toBe(
      '/(tabs)/reports'
    );
  });

  it('opens a cold Reports link that resolves after authenticated Home hydration', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    let releaseUrl!: (url: string) => void;
    jest.spyOn(Linking, 'getInitialURL').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUrl = resolve as typeof releaseUrl;
        })
    );
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      onboarding: null,
      privacyLock: null,
      profileSetupStatus: 'complete'
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      releaseUrl('masarifi://reports');
    });
    expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/reports');
  });

  it('retains an early cold Reports link across actual owner authentication/storage hydration', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    clearAppShellStorageOwner();
    const digest = jest
      .spyOn(Crypto, 'digestStringAsync')
      .mockResolvedValue('a'.repeat(64));
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValueOnce('masarifi://reports');
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {});
    expect(useAppShellStore.getState().pendingDestination).toBe(
      '/(tabs)/reports'
    );
    try {
      await act(async () => {
        await useAppShellStore.getState().authenticate({
          ...authenticatedSession,
          userId: 'user_live_reports'
        });
        useAppShellStore.getState().setProfileSetup('complete');
      });
    } finally {
      digest.mockRestore();
    }
    expect(useAppShellStore.getState().pendingDestination).toBe(
      '/(tabs)/reports'
    );
    expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/reports');
  });

  it('retains a newer runtime Reports link through owner hydration and ignores late initial URL', async () => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    clearAppShellStorageOwner();
    const digest = jest
      .spyOn(Crypto, 'digestStringAsync')
      .mockResolvedValue('b'.repeat(64));
    let releaseInitial!: (url: string) => void;
    let receive!: (event: { url: string }) => void;
    jest.spyOn(Linking, 'getInitialURL').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseInitial = resolve as typeof releaseInitial;
        })
    );
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        receive = listener;
        return { remove: jest.fn() } as never;
      });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    try {
      await act(async () => receive({ url: 'masarifi://reports' }));
      await act(async () => releaseInitial('masarifi://tracking'));
      await act(async () => {
        await useAppShellStore.getState().authenticate({
          ...authenticatedSession,
          userId: 'user_runtime_reports'
        });
        useAppShellStore.getState().setProfileSetup('complete');
      });
      expect(useAppShellStore.getState().pendingDestination).toBe(
        '/(tabs)/reports'
      );
      expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/reports');
    } finally {
      digest.mockRestore();
    }
  });

  it('opens a safe runtime deep link through the current access gate', async () => {
    let linkListener: ((event: { url: string }) => void) | null = null;
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        linkListener = listener;
        return { remove: jest.fn() } as never;
      });
    useAppShellStore.setState({
      hydrated: true,
      session: {
        status: 'authenticated',
        userId: 'user-1',
        method: 'google',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        restoration: 'restored'
      },
      onboarding: null,
      privacyLock: null,
      profileSetupStatus: 'complete'
    });

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      linkListener?.({ url: 'masarifi://tracking' });
      await Promise.resolve();
    });

    expect(router.replace).toHaveBeenCalledWith('/tracking');
  });
});

function ProtectedContent() {
  return <Text>protected child</Text>;
}
