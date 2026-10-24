import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';
import { useAppShellStore } from '@/state/app-shell';
import {
  configureTrackingBackground,
  disableTrackingBackground,
  scheduleTrackingFollowUp
} from './tracking-background-runtime';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateTrackingConsent } from './tracking-source-preferences';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import * as database from '@/storage/database';
import {
  restoreAppShellSession,
  signOutAppShellSession
} from '@/features/auth/session-controller';
import type { AuthService } from '@/services/contracts/app-shell-service';
import { createMockAuthService } from '@/services/mocks/auth-service';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.masarifi.mobile' } } }
}));

let mockNativeNotifications: string[] = [];

jest.mock('../../modules/masarifi-sms-inbox', () => ({
  MasarifiSmsInbox: {
    configureTrackingOwner: jest.fn(async () => undefined),
    clearTrackingOwner: jest.fn(async () => {
      mockNativeNotifications = [];
    }),
    suspendTrackingOwner: jest.fn(async () => undefined),
    restoreTrackingOwner: jest.fn(async () => 'PRESERVED'),
    scheduleTrackingFollowUp: jest.fn(async () => true)
  }
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, value: string) => 'digest:' + value
  ),
  randomUUID: () => 'generation-test'
}));
jest.mock('expo-notifications', () => ({
  registerTaskAsync: jest.fn(async () => undefined)
}));
const rules = {
  keywords: [],
  senders: [{ normalizedSender: 'com.bank.app', trusted: true, enabled: true }]
};
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalClerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
beforeEach(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
    'pk_test_nonfunctionalfixture';
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  await disableTrackingBackground();
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'owner-a',
      method: 'google',
      issuedAt: 1,
      expiresAt: 2,
      restoration: 'restored'
    }
  });
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest
    .mocked(MasarifiSmsInbox!.restoreTrackingOwner)
    .mockResolvedValue('PRESERVED');
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' });
  jest.clearAllMocks();
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  if (originalClerkKey === undefined)
    delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalClerkKey;
});

describe('durable DEV follow-up scheduling', () => {
  const generation = '11111111-1111-4111-8111-111111111111';
  const retainedContext = JSON.stringify({ ownerId: 'owner-a', generation });
  let priorEnvironment: Record<string, string | undefined>;
  beforeEach(() => {
    priorEnvironment = {
      EXPO_PUBLIC_CLIENT_MODE: process.env.EXPO_PUBLIC_CLIENT_MODE,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
    };
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = [
      'pk',
      'test',
      'nonfunctionalfixture'
    ].join('_');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(retainedContext);
  });
  afterEach(() => {
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    jest
      .mocked(Crypto.digestStringAsync)
      .mockReset()
      .mockImplementation(
        async (_algorithm: unknown, ownerId: string) => 'digest:' + ownerId
      );
    jest
      .mocked(MasarifiSmsInbox!.scheduleTrackingFollowUp!)
      .mockReset()
      .mockResolvedValue(true);
    for (const [key, value] of Object.entries(priorEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('allows follow-up for the explicitly marked production build origin', async () => {
    const channel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    process.env.EXPO_PUBLIC_RELEASE_CHANNEL = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://approved-production.example.com';
    try {
      await scheduleTrackingFollowUp('owner-a');
      expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).toHaveBeenCalledWith(
        'digest:owner-a',
        generation
      );
    } finally {
      if (channel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
      else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = channel;
    }
  });
  it('requests follow-up using only the authenticated retained owner digest and generation', async () => {
    await scheduleTrackingFollowUp('owner-a');

    expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).toHaveBeenCalledWith(
      'digest:owner-a',
      generation
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(MasarifiSmsInbox!.configureTrackingOwner).not.toHaveBeenCalled();
  });

  it.each([
    ['demo', 'https://api.staging.masarifiratibi.com', 'android'],
    ['live', 'https://api.masarifiratibi.com', 'android'],
    ['live', 'https://api.staging.masarifiratibi.com.evil.test', 'android'],
    ['live', 'https://api.staging.masarifiratibi.com', 'ios']
  ])(
    'does not schedule outside the live Staging Android scope (%s, %s, %s)',
    async (mode, api, platform) => {
      process.env.EXPO_PUBLIC_CLIENT_MODE = mode;
      process.env.EXPO_PUBLIC_API_URL = api;
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: platform
      });

      await scheduleTrackingFollowUp('owner-a');

      expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).not.toHaveBeenCalled();
    }
  );

  it.each([
    null,
    JSON.stringify({ ownerId: 'owner-b', generation }),
    JSON.stringify({ ownerId: 'owner-a', generation: 'short' })
  ])(
    'does not schedule absent or mismatched retained ownership (%s)',
    async (raw) => {
      jest.mocked(SecureStore.getItemAsync).mockResolvedValue(raw);

      await scheduleTrackingFollowUp('owner-a');

      expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).not.toHaveBeenCalled();
    }
  );

  it.each(['owner', 'consent', 'native-generation'] as const)(
    'denies a follow-up when %s changes during the secure context read',
    async (changed) => {
      jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(async () => {
        if (changed === 'owner') useAppShellStore.setState({ session: null });
        else if (changed === 'consent') invalidateTrackingConsent();
        else void disableTrackingBackground();
        return retainedContext;
      });

      await scheduleTrackingFollowUp('owner-a');

      expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).not.toHaveBeenCalled();
    }
  );

  it('denies a follow-up after consent changes during hashing', async () => {
    jest.mocked(Crypto.digestStringAsync).mockImplementationOnce(async () => {
      invalidateTrackingConsent();
      return 'digest:owner-a';
    });

    await scheduleTrackingFollowUp('owner-a');

    expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).not.toHaveBeenCalled();
  });

  it('denies a follow-up after the retained native generation changes during hashing', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce(retainedContext)
      .mockResolvedValueOnce(
        JSON.stringify({
          ownerId: 'owner-a',
          generation: '22222222-2222-4222-8222-222222222222'
        })
      );

    await scheduleTrackingFollowUp('owner-a');

    expect(MasarifiSmsInbox!.scheduleTrackingFollowUp).not.toHaveBeenCalled();
  });

  it('preserves older native binary compatibility when follow-up scheduling is absent', async () => {
    const method = MasarifiSmsInbox!.scheduleTrackingFollowUp;
    delete MasarifiSmsInbox!.scheduleTrackingFollowUp;
    try {
      await expect(
        scheduleTrackingFollowUp('owner-a')
      ).resolves.toBeUndefined();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    } finally {
      MasarifiSmsInbox!.scheduleTrackingFollowUp = method;
    }
  });

  it('propagates native scheduling errors for the coordinator to report', async () => {
    jest
      .mocked(MasarifiSmsInbox!.scheduleTrackingFollowUp!)
      .mockRejectedValueOnce(new Error('native unavailable'));

    await expect(scheduleTrackingFollowUp('owner-a')).rejects.toThrow(
      'native unavailable'
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

it.each(['com.masarifi.mobile.dev', 'com.masarifi.mobile'])(
  'keeps local tracking independent of unsupported remote push only in %s',
  async (packageName) => {
    const previousPackage = Constants.expoConfig!.android!.package;
    const previousUrl = process.env.EXPO_PUBLIC_API_URL;
    const previousMode = process.env.EXPO_PUBLIC_CLIENT_MODE;
    const previousKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
    Constants.expoConfig!.android!.package = packageName;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
      'pk_test_nonfunctionalfixture';
    const register = jest.mocked(Notifications.registerTaskAsync);
    register.mockRejectedValueOnce(
      new Error(
        'class expo.modules.interfaces.taskManager.TaskManagerInterface module not found'
      )
    );
    try {
      const configured = configureTrackingBackground(
        'owner-a',
        rules,
        'automatic_clear'
      );
      if (packageName === 'com.masarifi.mobile.dev') {
        await expect(configured).resolves.toBeUndefined();
        expect(register).not.toHaveBeenCalled();
      } else {
        await expect(configured).rejects.toThrow(
          'TaskManagerInterface module not found'
        );
        expect(register).toHaveBeenCalledTimes(1);
      }
      expect(MasarifiSmsInbox!.configureTrackingOwner).toHaveBeenCalled();
      expect(MasarifiSmsInbox!.suspendTrackingOwner).not.toHaveBeenCalled();
    } finally {
      register.mockReset().mockResolvedValue(null);
      Constants.expoConfig!.android!.package = previousPackage;
      if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = previousUrl;
      if (previousMode === undefined)
        delete process.env.EXPO_PUBLIC_CLIENT_MODE;
      else process.env.EXPO_PUBLIC_CLIENT_MODE = previousMode;
      if (previousKey === undefined)
        delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
      else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = previousKey;
    }
  }
);

it('refuses broader admission on a native binary without an explicit DEV capability', async () => {
  const native = MasarifiSmsInbox!;
  const prior = native.configureTrackingOwnerV3;
  native.configureTrackingOwnerV3 = jest.fn(async () => undefined);
  try {
    await expect(
      configureTrackingBackground(
        'owner-a',
        {
          ...rules,
          accountingPolicy: 'default_account_nominal_v1',
          sourceAdmissionPolicy: 'financial_content_v1'
        } as Parameters<typeof configureTrackingBackground>[1],
        'automatic_clear'
      )
    ).rejects.toThrow('tracking_native_upgrade_required');
  } finally {
    native.configureTrackingOwnerV3 = prior;
  }
});

it.each([
  ['signed-out', false],
  ['rejected', false],
  ['timeout', false],
  ['rejected', true],
  ['timeout', true]
] as const)(
  'preserves data and denies access after current live restoration %s with prior authentication %s',
  async (outcome, previouslyAuthenticated) => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    const retained = new Map([
      ['masarifi.appShell.session', 'retained-session-bytes'],
      ['masarifi.tracking.background-context.v2', 'retained-context-bytes']
    ]);
    mockNativeNotifications = ['retained-notification'];
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      retained.delete(key);
    });
    const close = jest
      .spyOn(database, 'clearDatabaseOwner')
      .mockResolvedValue(undefined);
    await AsyncStorage.setItem(
      'masarifi.tracking.smsImportQueue.v1',
      'retained-legacy-SMS'
    );
    useAppShellStore.setState({
      session: previouslyAuthenticated
        ? useAppShellStore.getState().session
        : null,
      pendingDestination: '/reports'
    });
    if (outcome === 'timeout') jest.useFakeTimers();
    const auth = {
      restoreSession: async () => {
        if (outcome === 'rejected') throw new Error('identity unavailable');
        if (outcome === 'timeout') return new Promise(() => undefined);
        return { status: 'signed_out' };
      }
    } as AuthService;
    try {
      const restoring = restoreAppShellSession(auth);
      if (outcome === 'signed-out') await restoring;
      else {
        const rejected =
          outcome === 'timeout'
            ? expect(restoring).rejects.toMatchObject({
                code: 'provider_unavailable',
                failureSource: 'timeout'
              })
            : expect(restoring).rejects.toThrow('identity unavailable');
        if (outcome === 'timeout') await jest.advanceTimersByTimeAsync(30_000);
        await rejected;
      }
      expect(useAppShellStore.getState().session?.status).toBe('signed_out');
      expect(useAppShellStore.getState().pendingDestination).toBeNull();
      expect(retained.get('masarifi.appShell.session')).toBe(
        'retained-session-bytes'
      );
      expect(retained.get('masarifi.tracking.background-context.v2')).toBe(
        'retained-context-bytes'
      );
      expect(
        await AsyncStorage.getItem('masarifi.tracking.smsImportQueue.v1')
      ).toBe('retained-legacy-SMS');
      expect(mockNativeNotifications).toEqual(['retained-notification']);
      expect(close.mock.calls[0]?.[0]).toBeUndefined();
      expect(MasarifiSmsInbox?.suspendTrackingOwner).toHaveBeenCalled();
      await configureTrackingBackground('owner-a', rules, 'automatic_clear');
      expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      delete process.env.EXPO_PUBLIC_CLIENT_MODE;
    }
  }
);

it.each(['rejected', 'timeout'] as const)(
  'does not suspend a newer owner after a stale restoration %s',
  async (outcome) => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    jest.useFakeTimers();
    const newerSession = useAppShellStore.getState().session!;
    useAppShellStore.setState({ session: null });
    let reject!: (error: Error) => void;
    let current = true;
    const auth = {
      restoreSession: () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    } as AuthService;
    try {
      const restoring = restoreAppShellSession(auth, () => current);
      const rejected =
        outcome === 'timeout'
          ? expect(restoring).rejects.toMatchObject({
              code: 'provider_unavailable',
              failureSource: 'timeout'
            })
          : expect(restoring).rejects.toThrow('stale identity');
      current = false;
      useAppShellStore.setState({ session: newerSession });
      if (outcome === 'timeout') await jest.advanceTimersByTimeAsync(30_000);
      else reject(new Error('stale identity'));
      await rejected;
      expect(useAppShellStore.getState().session).toEqual(newerSession);
      expect(MasarifiSmsInbox?.suspendTrackingOwner).not.toHaveBeenCalled();
      expect(MasarifiSmsInbox?.clearTrackingOwner).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      delete process.env.EXPO_PUBLIC_CLIENT_MODE;
    }
  }
);

it('keeps unavailable restoration denied when native suspension fails without destructive fallback', async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  mockNativeNotifications = ['retained'];
  jest.spyOn(database, 'clearDatabaseOwner').mockResolvedValue(undefined);
  jest
    .mocked(MasarifiSmsInbox!.suspendTrackingOwner)
    .mockRejectedValueOnce(new Error('native unavailable'));
  useAppShellStore.setState({ session: null });
  const auth = {
    restoreSession: async () => ({ status: 'signed_out' })
  } as AuthService;
  try {
    await expect(restoreAppShellSession(auth)).rejects.toThrow(
      'native unavailable'
    );
    expect(useAppShellStore.getState().session?.status).toBe('signed_out');
    expect(mockNativeNotifications).toEqual(['retained']);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      'masarifi.tracking.background-context.v2'
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'masarifi.appShell.localOwner.v1'
    );
    expect(MasarifiSmsInbox?.suspendTrackingOwner).toHaveBeenCalledTimes(1);
    await configureTrackingBackground('owner-a', rules, 'automatic_clear');
    expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
  } finally {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  }
});

it('retains explicit provider logout cleanup after an unavailable restore', async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  mockNativeNotifications = ['retained'];
  jest.spyOn(database, 'clearDatabaseOwner').mockResolvedValue(undefined);
  await AsyncStorage.setItem(
    'masarifi.tracking.smsImportQueue.v1',
    'retained-legacy-SMS'
  );
  useAppShellStore.setState({ session: null });
  const auth: AuthService = {
    ...createMockAuthService(),
    restoreSession: async () => ({
      status: 'signed_out',
      userId: null,
      method: null,
      issuedAt: null,
      expiresAt: null,
      restoration: 'idle'
    }),
    signOut: async () => undefined
  };
  try {
    await restoreAppShellSession(auth);
    await signOutAppShellSession(auth, 'local');
    expect(mockNativeNotifications).toEqual([]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'masarifi.appShell.session'
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'masarifi.tracking.background-context.v2'
    );
    expect(
      await AsyncStorage.getItem('masarifi.tracking.smsImportQueue.v1')
    ).toBeNull();
  } finally {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  }
});

it('preserves durable notification work when cold authentication restores the same owner', async () => {
  mockNativeNotifications = ['retained-notification'];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      ownerId: 'owner-a',
      generation: '11111111-1111-4111-8111-111111111111'
    })
  );
  useAppShellStore.setState({ session: null });
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' });
  expect(mockNativeNotifications).toEqual(['retained-notification']);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('preserves native work through the actual live cold-authentication store path', async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  const session = useAppShellStore.getState().session!;
  mockNativeNotifications = ['retained-notification'];
  jest.spyOn(database, 'configureDatabaseOwner').mockResolvedValue(undefined);
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
    key === 'masarifi.tracking.background-context.v2'
      ? JSON.stringify({
          ownerId: 'owner-a',
          generation: '11111111-1111-4111-8111-111111111111'
        })
      : null
  );
  useAppShellStore.setState({ session: null });
  try {
    await useAppShellStore.getState().authenticate(session);
    expect(useAppShellStore.getState().session?.userId).toBe('owner-a');
    expect(mockNativeNotifications).toEqual(['retained-notification']);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      'masarifi.tracking.background-context.v2'
    );
  } finally {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  }
});

it('still clears durable native notifications on explicit sign-out', async () => {
  mockNativeNotifications = ['retained-notification'];
  await resetRuntimeIdentityData();
  expect(mockNativeNotifications).toEqual([]);
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
    'masarifi.tracking.background-context.v2'
  );
});

it('retains owner continuity when disabling SMS while keeping notifications', async () => {
  mockNativeNotifications = ['retained-notification'];
  await disableTrackingBackground(true);
  expect(mockNativeNotifications).toEqual(['retained-notification']);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.suspendTrackingOwner).toHaveBeenCalledTimes(1);
});

it('leaves cold authentication uninitialized when ownership cannot be proven', async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  const session = useAppShellStore.getState().session!;
  mockNativeNotifications = ['retained-notification'];
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (key) =>
      key === 'masarifi.tracking.background-context.v2' ? '{' : null
    );
  useAppShellStore.setState({ session: null });
  try {
    await expect(
      useAppShellStore.getState().authenticate(session)
    ).rejects.toThrow('tracking_restore_unavailable');
    expect(useAppShellStore.getState().session).toBeNull();
    expect(mockNativeNotifications).toEqual(['retained-notification']);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  } finally {
    delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  }
});

it('blocks cold restoration of a different saved owner without native cleanup or context deletion', async () => {
  mockNativeNotifications = ['previous-owner-notification'];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      ownerId: 'owner-b',
      generation: '11111111-1111-4111-8111-111111111111'
    })
  );
  await expect(
    resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' })
  ).rejects.toThrow('tracking_restore_unavailable');
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(mockNativeNotifications).toEqual(['previous-owner-notification']);
  expect(MasarifiSmsInbox?.restoreTrackingOwner).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.suspendTrackingOwner).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('rejects a destructive result from an older native restoration implementation', async () => {
  mockNativeNotifications = ['retained-notification'];
  jest
    .mocked(MasarifiSmsInbox!.restoreTrackingOwner)
    .mockResolvedValueOnce('CLEARED');
  await expect(
    resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' })
  ).rejects.toThrow('tracking_restore_unavailable');
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('rejects ambiguous native ownership while retaining durable notifications and saved context', async () => {
  mockNativeNotifications = ['retained-notification'];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      ownerId: 'owner-a',
      generation: '11111111-1111-4111-8111-111111111111'
    })
  );
  jest
    .mocked(MasarifiSmsInbox!.restoreTrackingOwner)
    .mockResolvedValueOnce('BLOCKED');
  await expect(
    resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' })
  ).rejects.toThrow('tracking_restore_unavailable');
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(mockNativeNotifications).toEqual(['retained-notification']);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
});

it('cannot restore old identity after a sign-out races the native restoration', async () => {
  mockNativeNotifications = ['retained-notification'];
  let release!: (value: string) => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  jest
    .mocked(MasarifiSmsInbox!.restoreTrackingOwner)
    .mockImplementationOnce(async () => {
      entered();
      return new Promise<string>((resolve) => {
        release = resolve;
      });
    });
  const restoration = resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' });
  const rejected = expect(restoration).rejects.toThrow(
    'tracking_restore_unavailable'
  );
  await ready;
  const signout = resetRuntimeIdentityData();
  release('PRESERVED');
  await Promise.all([rejected, signout]);
  expect(mockNativeNotifications).toEqual([]);
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
});

it('preserves durable work when cold restoration overtakes native configuration', async () => {
  mockNativeNotifications = ['retained-notification'];
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  jest
    .mocked(MasarifiSmsInbox!.configureTrackingOwner)
    .mockImplementationOnce(async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
  const configuring = configureTrackingBackground(
    'owner-a',
    rules,
    'automatic_clear'
  );
  await ready;
  const restoring = resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' });
  release();
  await Promise.all([configuring, restoring]);
  expect(mockNativeNotifications).toEqual(['retained-notification']);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it.each(['{', '{}', '{"ownerId":"owner-a","generation":"short"}'])(
  'rejects ambiguous saved ownership without deleting notifications: %s',
  async (raw) => {
    mockNativeNotifications = ['retained-notification'];
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(raw);
    await expect(
      resetRuntimeIdentityData({ restoringOwnerId: 'owner-a' })
    ).rejects.toThrow('tracking_restore_unavailable');
    expect(mockNativeNotifications).toEqual(['retained-notification']);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(MasarifiSmsInbox?.suspendTrackingOwner).toHaveBeenCalled();
  }
);
it('disables both native intake mechanisms when cached lifecycle safety rules need refresh', async () => {
  await configureTrackingBackground(
    'owner-a',
    { ...rules, requiresRefresh: true },
    'automatic_clear'
  );
  expect(MasarifiSmsInbox?.configureTrackingOwner).toHaveBeenCalledWith(
    'digest:owner-a',
    'generation-test',
    false,
    false,
    ['com.bank.app'],
    [],
    null
  );
});

it('does not resurrect native capture when consent changes while storage is awaited', async () => {
  let loaded!: () => void;
  const awaiting = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  let resume!: () => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(async () => {
    loaded();
    await new Promise<void>((resolve) => {
      resume = resolve;
    });
    return JSON.stringify({ smsEnabled: true, notificationEnabled: true });
  });
  const configuring = configureTrackingBackground(
    'owner-a',
    rules,
    'automatic_clear'
  );
  await awaiting;
  invalidateTrackingConsent();
  const disabling = disableTrackingBackground();
  resume();
  await Promise.all([configuring, disabling]);
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.clearTrackingOwner).toHaveBeenCalled();
});
it('rejects a configuration belonging to the previous account', async () => {
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockResolvedValue(
      JSON.stringify({ smsEnabled: true, notificationEnabled: true })
    );
  await configureTrackingBackground('owner-b', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
});
it('configures both sources with trusted package scope for the active owner', async () => {
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockResolvedValue(
      JSON.stringify({ smsEnabled: false, notificationEnabled: true })
    );
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    false,
    true,
    ['com.bank.app'],
    [],
    null
  );
});
it('syncs a validated discovery policy and disabled packages without trusting unknown packages', async () => {
  const { defaultSnapshot } = require('@masarifi/transaction-parser');
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockResolvedValue(
      JSON.stringify({ smsEnabled: true, notificationEnabled: true })
    );
  await configureTrackingBackground(
    'owner-a',
    {
      ...rules,
      snapshot: defaultSnapshot,
      senders: [
        ...rules.senders,
        { normalizedSender: 'com.blocked.app', enabled: false, trusted: true }
      ]
    },
    'review_all'
  );
  const call = (MasarifiSmsInbox?.configureTrackingOwner as jest.Mock).mock
    .calls[0];
  expect(call[4]).toEqual(['com.bank.app']);
  expect(call[5]).toEqual(['com.blocked.app']);
  expect(JSON.parse(call[6])).toMatchObject({
    version: 1,
    releaseId: defaultSnapshot.releaseId
  });
});
