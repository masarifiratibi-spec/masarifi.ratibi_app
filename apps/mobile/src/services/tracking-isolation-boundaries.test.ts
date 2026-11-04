import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as database from '@/storage/database';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { resetLocalUserData } from '@/storage/local-data-reset';
import {
  registerRuntimeUserDataReset,
  resetRuntimeUserData,
  resetRuntimeIdentityData
} from '@/storage/runtime-user-data-reset';
import { isolateTrackingForOwner } from '@/state/tracking-admission';
import { TrackingSourcePreferences } from './tracking-source-preferences';
import { createAndroidBankNotificationService } from './platform/bank-notification-service.android';
import { createAndroidSmsInboxService } from './platform/sms-inbox-service.android';
import { createLiveAutomaticTrackingService } from './live/automatic-tracking-service';
import { signOutAppShellSession, retryPendingLogout } from './owner-lifecycle';
import { createMockAuthService } from './mocks/auth-service';
import { useAppShellStore } from '@/state/app-shell';
import {
  disableTrackingBackground,
  purgeDeletedOwnerTracking
} from './tracking-background-runtime';
import {
  syncAutomaticTracking,
  resyncAutomaticTracking,
  updateAutomaticTrackingKeywords
} from './automatic-tracking-coordinator';

beforeEach(() => {
  isolateTrackingForOwner('user_currentA');
});

afterEach(() => {
  clearTrackingIsolation();
  jest.restoreAllMocks();
});

it.each(['load', 'clear'] as const)(
  'blocks queue %s before database or legacy migration',
  async (operation) => {
    const open = jest
      .spyOn(database, 'openDatabase')
      .mockRejectedValue(new Error('unexpected database access'));
    const storage = {
      getItem: jest.fn(async () => 'foreign bytes'),
      removeItem: jest.fn(async () => undefined)
    };
    const queue = new SmsImportQueue(storage);
    await expect(queue[operation]('user_currentA')).rejects.toThrow(
      'tracking_owner_isolated'
    );
    expect(open).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  }
);

it('blocks source changes before reading retained consent or changing native capture', async () => {
  const storage = {
    getItem: jest.fn(async () => 'foreign sources'),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
  const sources = new TrackingSourcePreferences(storage);
  for (const operation of [
    () => sources.load(),
    () => sources.set('sms', true),
    () => sources.setNotificationAccount(null),
    () => sources.clear()
  ]) {
    await expect(operation()).rejects.toThrow('tracking_owner_isolated');
  }
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});

it('blocks notification read, acknowledgement and capture toggles at the native adapter', async () => {
  const native = {
    isNotificationAccessEnabled: jest.fn(),
    openNotificationAccessSettings: jest.fn(),
    setNotificationCaptureEnabled: jest.fn(),
    readRecentNotifications: jest.fn(),
    acknowledgeNotifications: jest.fn()
  };
  const service = createAndroidBankNotificationService(native);
  for (const operation of [
    () => service.readRecent(100),
    () => service.acknowledge(['retained']),
    () => service.setCaptureEnabled(true),
    () => service.openSettings()
  ]) {
    await expect(operation()).rejects.toThrow('tracking_owner_isolated');
  }
  for (const boundary of Object.values(native))
    expect(boundary).not.toHaveBeenCalled();
});

it('blocks direct SMS reads before crossing native boundaries', async () => {
  const native = {
    readRecentSms: jest.fn(),
    readSmsPage: jest.fn(),
    isNetworkAvailable: jest.fn()
  };
  const service = createAndroidSmsInboxService(native);
  await expect(service.readRecent({ since: 0, limit: 10 })).rejects.toThrow(
    'tracking_owner_isolated'
  );
  await expect(
    service.readPage!({
      since: 0,
      afterId: '0',
      limit: 10,
      ownerId: 'user_currentA'
    })
  ).rejects.toThrow('tracking_owner_isolated');
  expect(native.readRecentSms).not.toHaveBeenCalled();
  expect(native.readSmsPage).not.toHaveBeenCalled();
});

it('blocks tracking HTTP and coordinator entry before tokens, queues or pending submissions', async () => {
  const token = jest.fn(async () => 'fixture-token');
  const request = jest.fn();
  const service = createLiveAutomaticTrackingService({
    baseUrl: 'https://fixture.invalid',
    token,
    request
  });
  await expect(service.getStatus()).rejects.toThrow('tracking_owner_isolated');
  await expect(service.listKeywordRules()).rejects.toThrow(
    'tracking_owner_isolated'
  );
  for (const operation of [
    syncAutomaticTracking,
    resyncAutomaticTracking,
    () => updateAutomaticTrackingKeywords([])
  ]) {
    await expect(operation()).rejects.toThrow('tracking_owner_isolated');
  }
  expect(token).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it('rejects local and runtime cleanup before any reset participant or persisted bytes change', async () => {
  const storageKey = 'masarifi.tracking.smsImportQueue.v1';
  await AsyncStorage.setItem(storageKey, 'retained legacy bytes');
  const reset = jest.fn();
  const unregister = registerRuntimeUserDataReset(reset);
  const open = jest
    .spyOn(database, 'openDatabase')
    .mockRejectedValue(new Error('unexpected database access'));
  try {
    await expect(resetLocalUserData('isolated-operation')).rejects.toThrow(
      'tracking_owner_isolated'
    );
    await expect(resetRuntimeUserData()).rejects.toThrow(
      'tracking_owner_isolated'
    );
    await expect(resetRuntimeIdentityData()).rejects.toThrow(
      'tracking_owner_isolated'
    );
    expect(reset).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(storageKey)).toBe(
      'retained legacy bytes'
    );
  } finally {
    unregister();
  }
});

it('rejects logout and native cleanup without consuming credentials or retained work', async () => {
  const auth = createMockAuthService();
  const signOut = jest.spyOn(auth, 'signOut');
  await expect(signOutAppShellSession(auth, 'local')).rejects.toThrow(
    'tracking_owner_isolated'
  );
  await expect(retryPendingLogout('user_currentA')).rejects.toThrow(
    'tracking_owner_isolated'
  );
  await expect(disableTrackingBackground()).rejects.toThrow(
    'tracking_owner_isolated'
  );
  await expect(purgeDeletedOwnerTracking('user_currentA')).rejects.toThrow(
    'tracking_owner_isolated'
  );
  expect(signOut).not.toHaveBeenCalled();
});

it('does not withdraw the shell session when direct store logout is refused', async () => {
  const session = {
    status: 'authenticated' as const,
    userId: 'user_currentA',
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: 4_000_000_000_000,
    restoration: 'restored' as const
  };
  useAppShellStore.setState({ session });
  await expect(useAppShellStore.getState().signOut()).rejects.toThrow(
    'tracking_owner_isolated'
  );
  expect(useAppShellStore.getState().session).toEqual(session);
});

it.each(['source', 'account'] as const)(
  'rejects a %s preference write if isolation begins during its read',
  async (operation) => {
    clearTrackingIsolation();
    let release!: (raw: string) => void;
    const storage = {
      getItem: jest.fn(
        () =>
          new Promise<string>((resolve) => {
            release = resolve;
          })
      ),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    const sources = new TrackingSourcePreferences(storage);
    const writing =
      operation === 'source'
        ? sources.set('sms', false)
        : sources.setNotificationAccount(null);
    const rejected = expect(writing).rejects.toThrow('tracking_owner_isolated');
    isolateTrackingForOwner('user_currentA');
    release('{}');
    await rejected;
    expect(storage.setItem).not.toHaveBeenCalled();
  }
);

it('does not clear legacy bytes when isolation overtakes queued database cleanup', async () => {
  clearTrackingIsolation();
  let release!: (db: never) => void;
  jest.spyOn(database, 'openDatabase').mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const run = jest.fn();
  jest
    .spyOn(database, 'runExclusiveDatabaseTransaction')
    .mockImplementation(async (_db, action) =>
      action({ runAsync: run } as never)
    );
  const storage = { getItem: jest.fn(), removeItem: jest.fn() };
  const cleaning = expect(
    new SmsImportQueue(storage).clear('user_currentA')
  ).rejects.toThrow('tracking_owner_isolated');
  isolateTrackingForOwner('user_currentA');
  release({} as never);
  await cleaning;
  expect(run).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});
