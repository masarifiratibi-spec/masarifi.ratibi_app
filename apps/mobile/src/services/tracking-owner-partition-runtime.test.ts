import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createHash } from 'node:crypto';
import * as database from '@/storage/database';
import { useAppShellStore } from '@/state/app-shell';
import {
  beginTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import { restoreAppShellSession } from '@/features/auth/session-controller';
import { createMockAuthService } from '@/services/mocks/auth-service';
import { registerLiveClerkBridge } from '@/services/live/auth-service';
import {
  TrackingSourcePreferences,
  trackingSourcePreferences
} from './tracking-source-preferences';
import * as installationConsent from './tracking-installation-consent';
import {
  configureTrackingBackground,
  runTrackingBackground,
  scheduleTrackingFollowUp,
  purgeDeletedOwnerTracking,
  disableTrackingBackground
} from './tracking-background-runtime';
import { syncAutomaticTracking } from './automatic-tracking-coordinator';
import { createAndroidBankNotificationService } from './platform/bank-notification-service.android';
import { bankNotificationService } from './platform/bank-notification-service';
import { createAndroidSmsInboxService } from './platform/sms-inbox-service.android';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';
import { signOutAppShellSession, retryPendingLogout } from './owner-lifecycle';
import {
  prepareLogoutDisposition,
  markLogoutCleanupReady,
  loadLogoutDisposition
} from '@/storage/app-shell-storage';
import { reconcileTrackingSaves } from './tracking-save-confirmation';
import * as TaskManager from 'expo-task-manager';
import './tracking-push-task';
import { settingsService } from './mocks/subscription-settings-service';

const mockSecureValues = new Map<string, string>();
const mockNative = {
  pending: null as { ownerDigest: string; generation: string } | null,
  committed: null as { ownerDigest: string; generation: string } | null,
  suspended: true,
  configured: null as Record<string, unknown> | null,
  failure: null as 'prepare' | 'commit' | null,
  onConfigure: null as (() => Promise<void>) | null,
  onPrepare: null as (() => Promise<void>) | null
};
const owner = 'user_currentA';
const digest = createHash('sha256').update(owner).digest('hex');
const contextKey = `masarifi.tracking.background-context.v3.${digest}`;
const legacyKey = 'masarifi.tracking.background-context.v2';
const retained = JSON.stringify({
  ownerId: 'user_retainedB',
  generation: '22222222-2222-4222-8222-222222222222'
});
let sdkUser: string | null = owner;

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.masarifi.mobile' } } }
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecureValues.get(key) ?? null,
  setItemAsync: async (key: string, encoded: string) => {
    mockSecureValues.set(key, encoded);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureValues.delete(key);
  }
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, content: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(content)
      .digest('hex'),
  randomUUID: () => jest.requireActual('node:crypto').randomUUID()
}));
jest.mock('expo-notifications', () => ({
  registerTaskAsync: async () => undefined
}));
jest.mock('./automatic-tracking-coordinator', () => ({
  syncAutomaticTracking: jest.fn(async () => ({ status: 'idle' }))
}));
jest.mock('@/storage/pending-owner-work', () => ({
  pendingOwnerWork: async () => 1,
  ownerVoiceAudioReferences: async () => []
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('./tracking-sync-device', () => ({
  ensureTrackingSyncDevice: async () => undefined
}));
jest.mock('./automatic-tracking-service', () => ({
  automaticTrackingService: {
    listImportOutcomes: async () => [
      {
        status: 'accepted',
        itemId: 'owned-item',
        transactionId: '10000000-0000-4000-8000-000000000011',
        notificationId: '20000000-0000-4000-8000-000000000019'
      }
    ]
  }
}));
jest.mock('./live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: async () => undefined,
  createLiveLedgerService: () => ({
    getTransaction: async () => ({
      id: '10000000-0000-4000-8000-000000000011',
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'SAR',
      title: 'Synthetic purchase',
      source: 'automatic',
      status: 'posted',
      syncStatus: 'synced',
      deletedAt: null
    })
  })
}));
jest.mock('../../modules/masarifi-sms-inbox', () => ({
  MasarifiSmsInbox: {
    suspendTrackingOwner: async () => {
      mockNative.suspended = true;
    },
    restoreTrackingOwner: async () => 'PRESERVED',
    prepareTrackingOwnerV4: async (encoded: string) => {
      const lease = JSON.parse(encoded) as {
        ownerDigest: string;
        generation: string;
        previousGeneration?: string;
      };
      const saved = JSON.parse(
        mockSecureValues.get(
          `masarifi.tracking.background-context.v3.${lease.ownerDigest}`
        ) ?? 'null'
      );
      if (
        !saved ||
        saved.generation !== lease.generation ||
        saved.phase !== 'prepared'
      )
        throw new Error('native_prepare_intent_missing');
      if (
        mockNative.pending &&
        mockNative.pending.generation !== lease.generation &&
        (mockNative.committed?.ownerDigest !== lease.ownerDigest ||
          mockNative.committed.generation !== lease.previousGeneration)
      )
        throw new Error('native_prepare_generation_lost');
      mockNative.pending = lease;
      mockNative.suspended = true;
      if (mockNative.failure === 'prepare') {
        mockNative.failure = null;
        throw new Error('native_prepare_interrupted');
      }
      await mockNative.onPrepare?.();
    },
    commitTrackingOwnerV4: async (ownerDigest: string, generation: string) => {
      const saved = JSON.parse(
        mockSecureValues.get(
          `masarifi.tracking.background-context.v3.${ownerDigest}`
        ) ?? 'null'
      );
      if (
        !saved ||
        saved.phase !== 'committed' ||
        saved.generation !== generation ||
        mockNative.pending?.generation !== generation
      )
        throw new Error('native_commit_agreement_missing');
      mockNative.committed = { ownerDigest, generation };
      mockNative.suspended = false;
      if (mockNative.failure === 'commit') {
        mockNative.failure = null;
        throw new Error('native_ack_interrupted');
      }
    },
    configureTrackingOwner: async () => {
      throw new Error('legacy_configure_forbidden');
    },
    configureTrackingOwnerV4: async (encoded: string) => {
      const request = JSON.parse(encoded);
      if (
        (mockNative.suspended &&
          (request.configuration.sms || request.configuration.notification)) ||
        !mockNative.committed ||
        mockNative.committed.ownerDigest !== request.ownerDigest ||
        mockNative.committed.generation !== request.generation ||
        mockNative.pending?.generation !== request.generation
      )
        throw new Error('native_configure_lease_stale');
      mockNative.configured = request;
      await mockNative.onConfigure?.();
    },
    pauseTrackingCaptureV4: async (ownerDigest: string, generation: string) => {
      if (
        mockNative.committed?.ownerDigest !== ownerDigest ||
        mockNative.committed.generation !== generation
      )
        throw new Error('native_pause_lease_stale');
    },
    retainedNotificationCountV4: jest.fn(async () => 7),
    purgeTrackingOwnerDataV4: jest.fn(async () => {
      mockNative.suspended = true;
    }),
    clearTrackingOwnerV4: async () => {
      mockNative.suspended = true;
    },
    presentCaptureConfirmationV4: jest.fn(async () => true),
    presentCaptureConfirmation: async () => {
      throw new Error('unscoped_presentation_forbidden');
    },
    clearTrackingOwner: async () => {
      throw new Error('legacy_clear_forbidden');
    },
    smsActivationBoundary: async () => ({
      activatedAt: Date.now(),
      afterId: '0'
    }),
    scheduleTrackingFollowUp: jest.fn(async () => true)
  }
}));

const originalEnvironment = { ...process.env };
const pushHandler = jest.mocked(TaskManager.defineTask).mock.calls[0]![1];
beforeEach(async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
    'pk_test_nonfunctionalfixture';
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  mockSecureValues.clear();
  mockSecureValues.set(legacyKey, retained);
  mockNative.pending = null;
  mockNative.committed = null;
  mockNative.suspended = true;
  mockNative.configured = null;
  mockNative.failure = null;
  mockNative.onConfigure = null;
  mockNative.onPrepare = null;
  sdkUser = owner;
  jest.mocked(syncAutomaticTracking).mockClear();
  await AsyncStorage.clear();
  clearTrackingIsolation();
  beginTrackingAdmission();
  jest.spyOn(database, 'configureDatabaseOwner').mockResolvedValue(undefined);
  jest.spyOn(database, 'clearDatabaseOwner').mockResolvedValue(undefined);
  useAppShellStore.setState({
    hydrated: true,
    session: null,
    profileSetupStatus: 'unknown',
    profileSetupSnapshot: null,
    logoutQuiescingOwnerId: null,
    logoutRecoveryOwnerId: null
  });
});

afterEach(() => {
  clearTrackingIsolation();
  jest.restoreAllMocks();
  for (const key of [
    'EXPO_PUBLIC_CLIENT_MODE',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'
  ]) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

function verifiedSession() {
  const now = Date.now();
  const session = {
    status: 'authenticated' as const,
    userId: owner,
    method: 'google' as const,
    issuedAt: now,
    expiresAt: now + 3_600_000,
    restoration: 'restored' as const
  };
  const interactive = async (): Promise<never> => {
    throw new Error('interactive_auth_not_expected');
  };
  registerLiveClerkBridge({
    getSession: async () =>
      sdkUser
        ? {
            id: 'sess_currentA',
            userId: sdkUser,
            method: 'google',
            issuedAt: now,
            expiresAt: now + 3_600_000
          }
        : null,
    getToken: async () => 'nonfunctional-token',
    startPhone: interactive,
    verifyPhone: interactive,
    resendPhone: interactive,
    signInWithGoogle: interactive,
    reverifyConflict: interactive,
    signOut: interactive
  });
  return { ...createMockAuthService(), restoreSession: async () => session };
}

it('keeps native capture disabled until the current production receipt has local acknowledgment', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  await new TrackingSourcePreferences().set('sms', true);
  await new TrackingSourcePreferences().set('notification', true);
  const permit = jest
    .spyOn(installationConsent, 'hasProductionTrackingConsent')
    .mockResolvedValue(false);
  await configureTrackingBackground(
    owner,
    { keywords: [], senders: [] },
    'automatic_clear'
  );
  expect(mockNative.configured).toMatchObject({
    configuration: { sms: false, notification: false }
  });
  permit.mockResolvedValue(true);
  await configureTrackingBackground(
    owner,
    { keywords: [], senders: [] },
    'automatic_clear'
  );
  expect(mockNative.configured).toMatchObject({
    configuration: { sms: true, notification: true }
  });
});

it('assesses all retained native notifications without reading their payloads and fences SDK changes', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const service = createAndroidBankNotificationService();
  const lease = useTrackingAdmission.getState().nativeLease;
  expect(await service.retainedCount?.()).toBe(7);
  expect(MasarifiSmsInbox?.retainedNotificationCountV4).toHaveBeenCalledWith(
    lease?.ownerDigest,
    lease?.generation
  );
  sdkUser = 'user_retainedB';
  await expect(service.retainedCount?.()).rejects.toThrow();
});

it('does not report zero retained work when the admitted native bridge is unavailable', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  await expect(
    createAndroidBankNotificationService(null).retainedCount?.()
  ).rejects.toThrow();
});

it('includes old-generation notifications and pending source commands in removal assessment', async () => {
  const auth = verifiedSession();
  await restoreAppShellSession(auth, () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  Object.defineProperty(bankNotificationService, 'retainedCount', {
    configurable: true,
    value: async () => 7
  });
  jest
    .spyOn(trackingSourcePreferences, 'hasPendingConsent')
    .mockResolvedValue(true);
  let assessed: number | null | undefined;
  try {
    expect(
      await signOutAppShellSession(auth, 'local', {
        confirmRemoval: async (count) => {
          assessed = count;
          return false;
        }
      })
    ).toBe(false);
    expect(assessed).toBe(9);
    expect(useAppShellStore.getState().session?.userId).toBe(owner);
    expect(mockSecureValues.get(legacyKey)).toBe(retained);
  } finally {
    delete bankNotificationService.retainedCount;
  }
});

it.each(['cold', 'cached'] as const)(
  '%s verified bootstrap admits independent Tracking without modifying retained legacy context',
  async (path) => {
    const auth = verifiedSession();
    if (path === 'cached')
      useAppShellStore.setState({
        session: { ...(await auth.restoreSession()), restoration: 'local' },
        profileSetupStatus: 'complete'
      });
    await restoreAppShellSession(auth, () => true, {
      getProfileSetup: async () => ({ complete: true })
    } as never);
    expect(useAppShellStore.getState()).toMatchObject({
      session: { userId: owner },
      profileSetupStatus: 'complete'
    });
    expect(useTrackingAdmission.getState()).toMatchObject({
      ready: true,
      admittedOwnerId: owner,
      isolatedForOwnerId: null
    });
    expect(mockNative.committed).toMatchObject({ ownerDigest: digest });
    expect(JSON.parse(mockSecureValues.get(contextKey)!)).toMatchObject({
      ownerId: owner,
      phase: 'committed'
    });
    expect(mockSecureValues.get(legacyKey)).toBe(retained);
  }
);

it('keeps intake suspended until the authoritative profile completes', async () => {
  let entered!: () => void;
  let release!: (snapshot: { complete: boolean }) => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const restoration = restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => {
      entered();
      return new Promise((resolve) => {
        release = resolve;
      });
    }
  } as never);
  await waiting;
  try {
    expect(mockNative.pending).toMatchObject({ ownerDigest: digest });
    expect(mockNative.committed).toBeNull();
    expect(mockNative.suspended).toBe(true);
    expect(useTrackingAdmission.getState().ready).toBe(false);
  } finally {
    release({ complete: true });
    await restoration;
  }
  expect(useTrackingAdmission.getState().ready).toBe(true);
});

it.each(['prepare', 'commit'] as const)(
  'reconciles an interrupted native %s using the same durable generation',
  async (boundary) => {
    const auth = verifiedSession();
    const profile = {
      getProfileSetup: async () => ({ complete: true })
    } as never;
    mockNative.failure = boundary;
    await expect(
      restoreAppShellSession(auth, () => true, profile)
    ).rejects.toThrow();
    const preparedGeneration = mockNative.pending?.generation;
    expect(preparedGeneration).toBeDefined();
    expect(useTrackingAdmission.getState().ready).toBe(false);
    await restoreAppShellSession(auth, () => true, profile);
    expect(useTrackingAdmission.getState()).toMatchObject({
      ready: true,
      admittedOwnerId: owner
    });
    expect(mockNative.committed?.generation).toBe(preparedGeneration);
    expect(mockSecureValues.get(legacyKey)).toBe(retained);
  }
);

it('does not inherit unscoped source consent or another account destination', async () => {
  await AsyncStorage.setItem(
    'masarifi.tracking.sources.v1',
    JSON.stringify({
      smsEnabled: true,
      notificationEnabled: true,
      notificationAccountId: '11111111-1111-4111-8111-111111111111'
    })
  );
  const legacy = await AsyncStorage.getItem('masarifi.tracking.sources.v1');
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  expect(await new TrackingSourcePreferences().load()).toEqual({
    smsEnabled: false,
    notificationEnabled: false
  });
  expect(await AsyncStorage.getItem('masarifi.tracking.sources.v1')).toBe(
    legacy
  );
});

it('configures the leased native namespace without replacing the retained legacy context', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  await configureTrackingBackground(
    owner,
    { keywords: [], senders: [] },
    'automatic_clear'
  );
  expect(mockNative.configured).toMatchObject({
    ownerDigest: digest,
    configuration: { sms: false, notification: false }
  });
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('writes and clears source consent only in the admitted owner namespace', async () => {
  const legacy = JSON.stringify({
    smsEnabled: true,
    notificationEnabled: true
  });
  await AsyncStorage.setItem('masarifi.tracking.sources.v1', legacy);
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const sources = new TrackingSourcePreferences();
  await sources.set('sms', true);
  expect(await sources.load()).toMatchObject({
    smsEnabled: true,
    notificationEnabled: false
  });
  expect(await AsyncStorage.getItem('masarifi.tracking.sources.v1')).toBe(
    legacy
  );
  await sources.clear();
  expect(await sources.load()).toEqual({
    smsEnabled: false,
    notificationEnabled: false
  });
  expect(await AsyncStorage.getItem('masarifi.tracking.sources.v1')).toBe(
    legacy
  );
});

it('does not adopt overwrite or clear mismatched source records under an owner key', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const key = `masarifi.tracking.sources.v3.${digest}`;
  const mismatched = JSON.stringify({
    version: 3,
    ownerId: 'user_retainedB',
    revision: 1,
    sources: { smsEnabled: true, notificationEnabled: true }
  });
  await AsyncStorage.setItem(key, mismatched);
  const sources = new TrackingSourcePreferences();
  for (const operation of [
    () => sources.load(),
    () => sources.set('sms', true),
    () => sources.clear()
  ]) {
    await expect(operation()).rejects.toThrow(
      'tracking_source_owner_unavailable'
    );
  }
  expect(await AsyncStorage.getItem(key)).toBe(mismatched);
});

it('rotates consent generations while keeping unchanged configuration stable', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const rules = { keywords: [], senders: [] };
  await configureTrackingBackground(owner, rules, 'paused');
  const first = { ...mockNative.committed! };
  await configureTrackingBackground(owner, rules, 'paused');
  expect(mockNative.committed).toEqual(first);
  await new TrackingSourcePreferences().set('sms', true);
  await configureTrackingBackground(owner, rules, 'paused');
  expect(mockNative.committed?.generation).not.toBe(first.generation);
  expect(useTrackingAdmission.getState().nativeLease).toEqual(
    mockNative.committed
  );
});

it.each(['prepare', 'commit'] as const)(
  'recovers consent rotation interrupted at %s without losing its generation',
  async (boundary) => {
    const auth = verifiedSession();
    const profile = {
      getProfileSetup: async () => ({ complete: true })
    } as never;
    await restoreAppShellSession(auth, () => true, profile);
    const rules = { keywords: [], senders: [] };
    await configureTrackingBackground(owner, rules, 'paused');
    await new TrackingSourcePreferences().set('sms', true);
    mockNative.failure = boundary;
    await expect(
      configureTrackingBackground(owner, rules, 'paused')
    ).rejects.toThrow();
    const interrupted = mockNative.pending?.generation;
    beginTrackingAdmission();
    await restoreAppShellSession(auth, () => true, profile);
    await configureTrackingBackground(owner, rules, 'paused');
    expect(mockNative.committed?.generation).toBe(interrupted);
    expect(mockSecureValues.get(legacyKey)).toBe(retained);
  }
);

it('uses leased notification reads acknowledgements and capture controls and rejects changed SDK identity', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const lease = useTrackingAdmission.getState().nativeLease!;
  const legacy = async (): Promise<never> => {
    throw new Error('unscoped_native_forbidden');
  };
  const read = jest.fn(async () => []);
  const ack = jest.fn(async () => undefined);
  const capture = jest.fn(async () => undefined);
  const native = {
    readRecentNotifications: legacy,
    acknowledgeNotifications: legacy,
    setNotificationCaptureEnabled: legacy,
    openNotificationAccessSettings: legacy,
    isNotificationAccessEnabled: async () => true,
    readRecentNotificationsV4: read,
    acknowledgeNotificationsV4: ack,
    setNotificationCaptureEnabledV4: capture
  };
  const service = createAndroidBankNotificationService(native);
  await expect(service.readRecent(10)).resolves.toEqual([]);
  await service.acknowledge(['public-operation']);
  await service.setCaptureEnabled(false);
  expect(read).toHaveBeenCalledWith(lease.ownerDigest, lease.generation, 10);
  expect(ack).toHaveBeenCalledWith(lease.ownerDigest, lease.generation, [
    'public-operation'
  ]);
  expect(capture).toHaveBeenCalledWith(
    lease.ownerDigest,
    lease.generation,
    false
  );
  read.mockImplementationOnce(async () => {
    sdkUser = 'user_other';
    return [];
  });
  await expect(service.readRecent(10)).rejects.toThrow();
});

it('uses the native leased SMS page and rejects an explicit foreign owner before reading', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const lease = useTrackingAdmission.getState().nativeLease!;
  const read = jest.fn(async () => ({
    version: 2,
    messages: [],
    lastScanned: { receivedAt: 10, id: '0' },
    hasMore: false,
    scanned: 0
  }));
  const service = createAndroidSmsInboxService({
    readRecentSms: async () => {
      throw new Error('unscoped_native_forbidden');
    },
    readFinancialSmsPageV4: read,
    isNetworkAvailable: async () => true
  });
  await service.readPage!({ ownerId: owner, since: 10, limit: 10 });
  expect(read).toHaveBeenCalledWith(
    JSON.stringify({ ...lease, since: 10, afterId: '0', limit: 10 })
  );
  await expect(
    service.readPage!({ ownerId: 'user_other', since: 10, limit: 10 })
  ).rejects.toThrow();
  expect(read).toHaveBeenCalledTimes(1);
});

it('preserves independent concurrent source approvals', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const preferences = new TrackingSourcePreferences();
  await Promise.all([
    preferences.set('sms', true),
    preferences.set('notification', true)
  ]);
  expect(await preferences.load()).toMatchObject({
    smsEnabled: true,
    notificationEnabled: true
  });
});

it('runs current leased headless work and follow-ups without reading the foreign legacy selector', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const lease = useTrackingAdmission.getState().nativeLease!;
  mockSecureValues.set(legacyKey, '{unattributed retained bytes');
  await runTrackingBackground(lease);
  expect(syncAutomaticTracking).toHaveBeenCalledTimes(1);
  await runTrackingBackground({
    ...lease,
    generation: 'stale-generation-0000'
  });
  expect(syncAutomaticTracking).toHaveBeenCalledTimes(1);
  await scheduleTrackingFollowUp(owner);
  expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).toHaveBeenCalledWith(
    lease.ownerDigest,
    lease.generation
  );
  expect(mockSecureValues.get(legacyKey)).toBe('{unattributed retained bytes');
});

it('restores admission after cancelling a quiesced logout without touching retained data', async () => {
  const auth = verifiedSession();
  await restoreAppShellSession(auth, () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const generation = mockNative.committed!.generation;
  const result = await signOutAppShellSession(auth, 'local', {
    confirmRemoval: async () => false
  });
  expect(result).toBe(false);
  expect(useTrackingAdmission.getState()).toMatchObject({
    ready: true,
    admittedOwnerId: owner
  });
  expect(mockNative.suspended).toBe(false);
  expect(mockNative.committed?.generation).toBe(generation);
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('purges only the admitted owner namespace and leaves foreign legacy context and consent intact', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  await new TrackingSourcePreferences().set('notification', true);
  await AsyncStorage.setItem(
    'masarifi.tracking.sources.v1',
    'unattributed legacy consent'
  );
  await purgeDeletedOwnerTracking(owner);
  expect(mockSecureValues.has(contextKey)).toBe(false);
  expect(
    await AsyncStorage.getItem(`masarifi.tracking.sources.v3.${digest}`)
  ).toBeNull();
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
  expect(await AsyncStorage.getItem('masarifi.tracking.sources.v1')).toBe(
    'unattributed legacy consent'
  );
});

it('finishes only a durable approved cold logout preservation after its SDK session is already gone', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const record = await prepareLogoutDisposition({
    ownerId: owner,
    sessionId: 'sess_currentA',
    scope: 'local',
    dataDisposition: 'preserve'
  });
  await markLogoutCleanupReady(record);
  sdkUser = null;
  useAppShellStore.setState({ session: null });
  beginTrackingAdmission();
  await retryPendingLogout(owner);
  expect(await loadLogoutDisposition(owner)).toBeNull();
  expect(useTrackingAdmission.getState().ready).toBe(false);
  expect(mockNative.suspended).toBe(true);
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('presents an owned accepted save using the exact native generation', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const generation = useTrackingAdmission.getState().nativeLease!.generation;
  expect(await reconcileTrackingSaves(owner, 'owned-import-session')).toBe(
    true
  );
  expect(MasarifiSmsInbox!.presentCaptureConfirmationV4).toHaveBeenCalledWith(
    expect.stringContaining(`"generation":"${generation}"`)
  );
});

it('resolves push work through the verified current owner instead of the retained legacy selector', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  mockSecureValues.set(legacyKey, '{unattributed retained bytes');
  await pushHandler({
    data: {
      data: {
        automaticCapture: true,
        notificationId: '20000000-0000-4000-8000-000000000019'
      }
    },
    error: null
  } as never);
  expect(syncAutomaticTracking).toHaveBeenCalledTimes(1);
  expect(mockSecureValues.get(legacyKey)).toBe('{unattributed retained bytes');
});

it('can configure current Tracking again after an explicit local clear without touching legacy context', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const rules = { keywords: [], senders: [] };
  await configureTrackingBackground(owner, rules, 'paused');
  await disableTrackingBackground();
  await configureTrackingBackground(owner, rules, 'paused');
  expect(mockNative.suspended).toBe(false);
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('rejects cold cleanup when a different SDK session or disposition replaces the approved one', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const record = await prepareLogoutDisposition({
    ownerId: owner,
    sessionId: 'sess_currentA',
    scope: 'local',
    dataDisposition: 'preserve'
  });
  await markLogoutCleanupReady(record);
  sdkUser = 'user_foreign';
  beginTrackingAdmission();
  const raw = mockSecureValues.get(contextKey);
  await expect(retryPendingLogout(owner)).rejects.toThrow();
  expect(mockSecureValues.get(contextKey)).toBe(raw);
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('rechecks the authoritative profile before admitting cold headless work', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const lease = useTrackingAdmission.getState().nativeLease!;
  beginTrackingAdmission();
  useAppShellStore.setState({ session: null, profileSetupStatus: 'unknown' });
  const profile = jest
    .spyOn(settingsService, 'getProfileSetup')
    .mockImplementation(async () => {
      expect(mockNative.suspended).toBe(true);
      expect(useTrackingAdmission.getState().ready).toBe(false);
      return { complete: true } as never;
    });
  await runTrackingBackground(lease);
  expect(profile).toHaveBeenCalledTimes(1);
  expect(syncAutomaticTracking).toHaveBeenCalledTimes(1);
  expect(useTrackingAdmission.getState()).toMatchObject({
    ready: true,
    admittedOwnerId: owner
  });
});

it('preserves a later SMS policy row boundary when it supersedes source activation', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const now = Date.now();
  const preferences = new TrackingSourcePreferences(AsyncStorage, async () => ({
    activatedAt: now - 1000,
    afterId: '42'
  }));
  await preferences.set('sms', true);
  await configureTrackingBackground(
    owner,
    {
      keywords: [],
      senders: [],
      activation: {
        smsActivatedAt: now - 500,
        smsActivationId: '99',
        notificationActivatedAt: now - 500
      }
    },
    'paused'
  );
  expect(mockNative.configured).toMatchObject({
    configuration: { smsActivatedAt: now - 500, smsActivationId: '99' }
  });
});

it('releases an owner database without discarding retained Tracking during shell sign-out', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  await useAppShellStore.getState().signOut();
  expect(database.clearDatabaseOwner).toHaveBeenCalledWith(owner, {
    preservePendingWork: true
  });
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it('revokes in-flight configuration before saving a new consent and reconciles without losing the change', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockNative.onConfigure = async () => {
    entered();
    await held;
  };
  const rules = { keywords: [], senders: [] };
  const configuration = configureTrackingBackground(owner, rules, 'paused');
  // Attach rejection handling before releasing the external boundary.
  const rejection = expect(configuration).rejects.toThrow(
    'tracking_restore_unavailable'
  );
  await waiting;
  const update = new TrackingSourcePreferences().set('sms', true);
  mockNative.onConfigure = null;
  release();
  await rejection;
  await update;
  expect((await new TrackingSourcePreferences().load()).smsEnabled).toBe(true);
  await configureTrackingBackground(owner, rules, 'paused');
  expect(mockNative.suspended).toBe(false);
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});

it.each([
  { smsEnabled: true, notificationEnabled: false },
  { smsEnabled: true, notificationEnabled: false, smsActivatedAt: 1000 },
  { smsEnabled: false, notificationEnabled: true }
])(
  'does not accept enabled sources without their observed activation boundary: %p',
  async (sources) => {
    await restoreAppShellSession(verifiedSession(), () => true, {
      getProfileSetup: async () => ({ complete: true })
    } as never);
    const key = `masarifi.tracking.sources.v3.${digest}`;
    const raw = JSON.stringify({
      version: 3,
      ownerId: owner,
      revision: 1,
      sources
    });
    await AsyncStorage.setItem(key, raw);
    await expect(new TrackingSourcePreferences().load()).rejects.toThrow(
      'tracking_source_owner_unavailable'
    );
    expect(await AsyncStorage.getItem(key)).toBe(raw);
  }
);

it('persists consent overtaking native preparation and reconciles that exact intent before rotating again', async () => {
  await restoreAppShellSession(verifiedSession(), () => true, {
    getProfileSetup: async () => ({ complete: true })
  } as never);
  const rules = { keywords: [], senders: [] };
  await configureTrackingBackground(owner, rules, 'paused');
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockNative.onPrepare = async () => {
    entered();
    await held;
  };
  const changed = { ...rules, configurationRevision: 'b'.repeat(64) };
  const configuring = configureTrackingBackground(owner, changed, 'paused');
  const rejected = expect(configuring).rejects.toThrow(
    'tracking_restore_unavailable'
  );
  await waiting;
  const intent = mockNative.pending!.generation;
  const update = new TrackingSourcePreferences().set('notification', true);
  const updated = expect(update).resolves.toMatchObject({
    notificationEnabled: true
  });
  mockNative.onPrepare = null;
  release();
  await rejected;
  await updated;
  expect(JSON.parse(mockSecureValues.get(contextKey)!).generation).toBe(intent);
  await configureTrackingBackground(owner, changed, 'paused');
  expect(mockNative.committed!.generation).not.toBe(intent);
  expect(mockNative.suspended).toBe(false);
  expect(await new TrackingSourcePreferences().load()).toMatchObject({
    notificationEnabled: true
  });
  expect(mockSecureValues.get(legacyKey)).toBe(retained);
});
