import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useAppShellStore } from '@/state/app-shell';
import { signOutAppShellSession, retryPendingLogout } from './owner-lifecycle';
import { registerLiveClerkBridge, captureLiveClerkOwner } from './live/auth-service';
import { cacheLocalOwnerAccess, createAppShellStorage, configureAppShellStorageOwner, loadLocalOwnerAccess, loadLogoutDisposition, prepareLogoutDisposition } from '@/storage/app-shell-storage';
import { restoreAppShellSession } from '@/features/auth/session-controller';
import type { AuthService } from '@/services/contracts/app-shell-service';
import type { ProfileSetupSnapshot } from '@/domain/settings';
import * as automationPolicy from '@/config/mobile-automation';
import * as phoneNotifications from '@/services/platform/phone-notification-service';
import { usePreferenceStore } from '@/state/preferences';
import { captureLiveClerkIdentity, terminatePinnedLogout } from './live/auth-service';
import { configureDatabaseOwner } from '@/storage/database';
import * as financeSync from '@/services/live/core-finance-service';
import * as trackingSync from '@/services/automatic-tracking-coordinator';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import { clearDatabaseOwner } from '@/storage/database';

const mockSecure = new Map<string, string>();
const mockRows = new Map<string, number>();
const mockPurges: string[] = [];
let mockStorageFailure: 'prepare' | 'ready' | null = null;
let mockPurgeFailure = false;
let mockAfterPurge: (() => Promise<void>) | null = null;
let mockSelectedDatabaseOwner: string | null = null;
let mockPendingCount = 1;
const mockDatabaseSelections: string[] = [];
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (key.includes('logoutDisposition') && JSON.parse(value).phase === (mockStorageFailure === 'prepare' ? 'prepared' : mockStorageFailure === 'ready' ? 'cleanup-ready' : 'never')) throw new Error('STORAGE_INTERRUPTED');
    mockSecure.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecure.delete(key); })
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
  digestStringAsync: async (_algorithm: string, value: string) => jest.requireActual('node:crypto').createHash('sha256').update(value).digest('hex')
}));
// Native database erasure is the I/O boundary; protected admission storage is real.
jest.mock('@/storage/database', () => ({
  configureDatabaseOwner: async (ownerId: string) => { mockSelectedDatabaseOwner = ownerId; mockDatabaseSelections.push(ownerId); },
  clearDatabaseOwner: jest.fn(async () => undefined),
  hasQuarantinedOwnerDatabase: async () => false,
  openDatabase: async () => ({
    getFirstAsync: async (sql: string) => sql.includes('AS count') ? { count: mockPendingCount } : null,
    getAllAsync: async () => [],
    runAsync: async () => undefined
  }),
  purgeAccountDatabase: async (owner: string) => {
    mockPurges.push(owner);
    if (mockPurgeFailure) throw new Error('PURGE_INTERRUPTED');
    mockRows.delete(owner);
    await mockAfterPurge?.();
  }
}));
jest.mock('@/services/platform/bank-notification-service', () => ({ bankNotificationService: { readRecent: async () => [] } }));

const owner = 'user_logout_a';
const other = 'user_logout_b';
const originalSession = { id: 'session-original-a', userId: owner, method: 'google' as const, issuedAt: 1, expiresAt: 9999999999999 };
let mockSession: typeof originalSession | null;
let mockProviderFailure = false;
let mockProviderGate: Promise<void> | null = null;
const sdkSignOut = jest.fn(async () => {
  await mockProviderGate;
  if (mockProviderFailure) throw new Error('PROVIDER_UNCERTAIN');
  mockSession = null;
});
const session = (id = owner) => ({ status: 'authenticated' as const, userId: id, method: 'google' as const, issuedAt: 1, expiresAt: 9999999999999, restoration: 'restored' as const });
const privacy = { enabled: true, autoLockDuration: 'immediate' as const, appLockStatus: 'unlocked' as const };
const incompleteProfile: ProfileSetupSnapshot = {
  complete: false,
  profile: { name: null, avatar: 'default', phone: null, googleAccount: null, email: null, country: 'SA', currency: 'SAR', timeZone: 'Asia/Riyadh', completion: [], version: 1 },
  preferences: { defaultCurrency: 'SAR', language: 'en', theme: 'system', calendar: 'gregorian', weekStart: 6, privacySettings: {}, version: 1 },
  onboarding: { step: 'welcome', completedSteps: [], completedAt: null, version: 1 }
};
async function seed(id = owner) {
  await configureAppShellStorageOwner(id);
  const storage = createAppShellStorage();
  await storage.savePrivacyLock(privacy);
  await cacheLocalOwnerAccess(session(id));
  useAppShellStore.setState({ session: session(id), privacyLock: privacy, profileSetupStatus: 'complete', logoutRecoveryOwnerId: null, logoutQuiescingOwnerId: null });
}

const previousMode = process.env.EXPO_PUBLIC_CLIENT_MODE;
const previousDemo = process.env.EXPO_PUBLIC_DEMO_MODE;
const previousApi = process.env.EXPO_PUBLIC_API_URL;
const os = Object.getOwnPropertyDescriptor(Platform, 'OS');
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live'; process.env.EXPO_PUBLIC_DEMO_MODE = '0'; process.env.EXPO_PUBLIC_API_URL = 'https://inert.invalid';
  mockSecure.clear(); mockRows.clear(); mockRows.set(owner, 1); mockRows.set(other, 1); mockPurges.length = 0;
  mockStorageFailure = null; mockPurgeFailure = false; mockAfterPurge = null; mockProviderFailure = false; mockProviderGate = null;
  mockSelectedDatabaseOwner = owner; mockDatabaseSelections.length = 0;
  mockSession = { ...originalSession }; sdkSignOut.mockClear(); useAppShellStore.getState().reset();
  jest.mocked(clearDatabaseOwner).mockClear();
  mockPendingCount = 1;
  jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('offline'));
  registerLiveClerkBridge({ getSession: async () => mockSession, getToken: async () => 'boundary-token', signOut: sdkSignOut, startPhone: jest.fn(), verifyPhone: jest.fn(), resendPhone: jest.fn(), signInWithGoogle: jest.fn(), reverifyConflict: jest.fn() });
  await seed();
});
afterEach(() => { jest.restoreAllMocks(); useAppShellStore.getState().reset(); });
afterAll(() => {
  if (os) Object.defineProperty(Platform, 'OS', os);
  if (previousMode === undefined) delete process.env.EXPO_PUBLIC_CLIENT_MODE; else process.env.EXPO_PUBLIC_CLIENT_MODE = previousMode;
  if (previousDemo === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE; else process.env.EXPO_PUBLIC_DEMO_MODE = previousDemo;
  if (previousApi === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previousApi;
});
const logout = (accept = true, scope: 'local' | 'all' = 'local') => signOutAppShellSession({} as never, scope, { confirmRemoval: async () => accept });

it('ordinary sign-out keeps owner data and pending work without sync or a removal question', async () => {
  const finance = jest.spyOn(financeSync, 'synchronizeLiveCoreFinance').mockResolvedValue(undefined);
  const tracking = jest.spyOn(trackingSync, 'syncAutomaticTracking').mockResolvedValue({status:'idle',sessionId:null,reviewId:null,duplicateId:null,errorCode:null});
  const nativeRead = jest.spyOn(bankNotificationService, 'readRecent');
  await expect(signOutAppShellSession({} as never,'local')).resolves.toBe(true);
  expect(mockRows.get(owner)).toBe(1);
  expect(mockRows.get(other)).toBe(1);
  expect(mockPurges).toEqual([]);
  expect(clearDatabaseOwner).toHaveBeenCalledWith(owner,{preservePendingWork:true});
  expect(finance).not.toHaveBeenCalled();
  expect(tracking).not.toHaveBeenCalled();
  expect(nativeRead).not.toHaveBeenCalled();
  expect(await loadLocalOwnerAccess()).toBeNull();
  expect(await loadLogoutDisposition(owner)).toBeNull();
  expect(useAppShellStore.getState().session?.status).toBe('signed_out');
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBeNull();
  expect(sdkSignOut).toHaveBeenCalledTimes(1);
});

it.each([false,true])('reconstructs a preserving cleanup without erasing data or terminating the session twice (legacy=%s)', async (legacy) => {
  jest.mocked(clearDatabaseOwner).mockRejectedValueOnce(new Error('CLOSE_INTERRUPTED'));
  await expect(signOutAppShellSession({} as never,'local')).rejects.toThrow('CLOSE_INTERRUPTED');
  expect(await loadLogoutDisposition(owner)).toMatchObject({phase:'cleanup-ready',dataDisposition:'preserve'});
  if (legacy) for (const [key,value] of mockSecure) {
    if (!key.includes('logoutDisposition')) continue;
    const raw = JSON.parse(value);
    delete raw.dataDisposition;
    mockSecure.set(key,JSON.stringify(raw));
  }
  useAppShellStore.getState().reset();
  await useAppShellStore.getState().hydrate();
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  await retryPendingLogout(owner);
  expect(mockRows.get(owner)).toBe(1);
  expect(mockPurges).toEqual([]);
  expect(sdkSignOut).toHaveBeenCalledTimes(1);
  expect(await loadLogoutDisposition(owner)).toBeNull();
});

it('keeps preserving recovery discoverable after marker removal fails following session cleanup', async () => {
  let fail = true;
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => {
    if (fail && key.includes('logoutDisposition')) { fail = false; throw new Error('MARKER_REMOVE_INTERRUPTED'); }
    mockSecure.delete(key);
  });
  await expect(signOutAppShellSession({} as never,'local')).rejects.toThrow('MARKER_REMOVE_INTERRUPTED');
  useAppShellStore.getState().reset();
  await useAppShellStore.getState().hydrate();
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  expect(await loadLocalOwnerAccess()).toBeNull();
  await retryPendingLogout(owner);
  expect(sdkSignOut).toHaveBeenCalledTimes(1);
  expect(mockRows.get(owner)).toBe(1);
  expect(await loadLogoutDisposition(owner)).toBeNull();
});

it('does not wait for network synchronization when the owner has no pending work', async () => {
  mockPendingCount = 0;
  const finance = jest.spyOn(financeSync, 'synchronizeLiveCoreFinance').mockResolvedValue(undefined);
  const tracking = jest.spyOn(trackingSync, 'syncAutomaticTracking').mockResolvedValue({status:'idle',sessionId:null,reviewId:null,duplicateId:null,errorCode:null});
  await expect(logout()).resolves.toBe(true);
  expect(finance).not.toHaveBeenCalled();
  expect(tracking).not.toHaveBeenCalled();
  expect(sdkSignOut).toHaveBeenCalledTimes(1);
});

it('keeps a single visible progress state through provider termination and clears it on completion', async () => {
  let release!: () => void;
  mockProviderGate = new Promise<void>(resolve => { release = resolve; });
  const progress: (string | null | undefined)[] = [];
  const unsubscribe = useAppShellStore.subscribe(state => progress.push(state.logoutInProgressOwnerId));
  try {
    const operation = logout();
    expect(useAppShellStore.getState().logoutInProgressOwnerId).toBe(owner);
    for (let attempt = 0; attempt < 100 && !sdkSignOut.mock.calls.length; attempt++) await new Promise(resolve => setTimeout(resolve, 0));
    expect(sdkSignOut).toHaveBeenCalledTimes(1);
    expect(useAppShellStore.getState().logoutInProgressOwnerId).toBe(owner);
    const active = progress.indexOf(owner);
    expect(active).toBeGreaterThanOrEqual(0);
    expect(progress.slice(active).every(value => value === owner)).toBe(true);
    release();
    await operation;
    expect(useAppShellStore.getState().logoutInProgressOwnerId).toBeNull();
    expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBeNull();
  } finally { release(); unsubscribe(); }
});

it('does not synchronize a replacement owner during the logout preflight', async () => {
  const finance = jest.spyOn(financeSync, 'synchronizeLiveCoreFinance').mockResolvedValue(undefined);
  const tracking = jest.spyOn(trackingSync, 'syncAutomaticTracking').mockResolvedValue({status:'idle',sessionId:null,reviewId:null,duplicateId:null,errorCode:null});
  jest.spyOn(bankNotificationService, 'readRecent').mockImplementationOnce(async () => {
    mockSession = {...originalSession,id:'replacement-session',userId:other};
    await seed(other);
    return [];
  });
  await expect(logout()).rejects.toMatchObject({code:'session_expired'});
  expect(finance).not.toHaveBeenCalled();
  expect(tracking).not.toHaveBeenCalled();
  expect(sdkSignOut).not.toHaveBeenCalled();
  expect(mockPurges).toEqual([]);
  expect(mockRows.get(other)).toBe(1);
});

it('keeps data and admission when cancellation precedes disposition', async () => {
  await expect(logout(false)).resolves.toBe(false);
  expect(await loadLogoutDisposition(owner)).toBeNull();
  expect(await loadLocalOwnerAccess()).toMatchObject({ userId: owner });
  expect(sdkSignOut).not.toHaveBeenCalled(); expect(mockRows.get(owner)).toBe(1);
});

it('revokes the registered automation installation under the pinned disposition before SDK termination without granting financial admission', async () => {
  jest.spyOn(automationPolicy, 'isMobileAutomationEnabled').mockReturnValue(true);
  const registration = { deviceFingerprint: 'owned-fixture-installation', platform: 'android' as const, appVersion: '1.0.0' };
  jest.spyOn(phoneNotifications, 'getDeviceRegistration').mockResolvedValue(registration);
  usePreferenceStore.setState({ returnRemindersEnabled: true, returnRemindersOwnerId: owner });
  jest.mocked(global.fetch).mockImplementation(async (url, options) => {
    if (!String(url).endsWith('/api/v1/tracking/device/installations/sign-out')) throw new TypeError('offline');
    expect(String(url)).toBe('https://inert.invalid/api/v1/tracking/device/installations/sign-out');
    expect(JSON.parse(String(options?.body))).toEqual({ deviceRegistration: registration });
    expect(sdkSignOut).not.toHaveBeenCalled();
    expect(usePreferenceStore.getState().returnRemindersEnabled).toBe(false);
    expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'prepared', ownerId: owner, sessionId: originalSession.id });
    await expect(captureLiveClerkIdentity()).rejects.toMatchObject({ domainCode: 'LOGOUT_PENDING' });
    return { ok: true, status: 200, json: async () => ({ data: {}, meta: { requestId: 'logout-fixture' } }) } as Response;
  });
  await expect(logout()).resolves.toBe(true);
  expect(jest.mocked(global.fetch).mock.calls.filter(([url]) => String(url).endsWith('/api/v1/tracking/device/installations/sign-out'))).toHaveLength(1);
  expect(sdkSignOut).toHaveBeenCalledWith({ scope: 'current', sessionId: originalSession.id });
  expect(await loadLogoutDisposition(owner)).toBeNull();
  expect(mockRows.has(owner)).toBe(false);
});

it.each(['registration-missing', 'revocation-offline', 'registration-switch', 'token-switch', 'http-switch', 'token-missing'] as const)('preserves the disposition and data without closing a replacement across automation %s', async cut => {
  jest.spyOn(automationPolicy, 'isMobileAutomationEnabled').mockReturnValue(true);
  const registration = { deviceFingerprint: 'owned-fixture-installation', platform: 'android' as const, appVersion: '1.0.0' };
  const replace = async () => { mockSession = { ...originalSession, id: 'replacement-session-b', userId: other }; await seed(other); };
  jest.spyOn(phoneNotifications, 'getDeviceRegistration').mockImplementation(async () => {
    if (cut === 'registration-missing') return null;
    if (cut === 'registration-switch') await replace();
    return registration;
  });
  registerLiveClerkBridge({ getSession: async () => mockSession, getToken: async () => {
    if (await loadLogoutDisposition(owner)) {
      if (cut === 'token-switch') await replace();
      if (cut === 'token-missing') return null;
    }
    return 'boundary-token';
  }, signOut: sdkSignOut, startPhone: jest.fn(), verifyPhone: jest.fn(), resendPhone: jest.fn(), signInWithGoogle: jest.fn(), reverifyConflict: jest.fn() });
  jest.mocked(global.fetch).mockImplementation(async url => {
    if (!String(url).endsWith('/api/v1/tracking/device/installations/sign-out') || cut === 'revocation-offline') throw new TypeError('offline');
    if (cut === 'http-switch') await replace();
    return { ok: true, status: 200, json: async () => ({ data: {}, meta: { requestId: 'logout-fixture' } }) } as Response;
  });
  await expect(logout()).rejects.toThrow();
  expect(sdkSignOut).not.toHaveBeenCalled(); expect(mockPurges).toEqual([]);
  expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'prepared', sessionId: originalSession.id });
  expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
  const sent = jest.mocked(global.fetch).mock.calls.filter(([url]) => String(url).endsWith('/api/v1/tracking/device/installations/sign-out'));
  expect(sent).toHaveLength(cut === 'revocation-offline' || cut === 'http-switch' ? 1 : 0);
  if (cut.endsWith('switch')) {
    expect(useAppShellStore.getState().session?.userId).toBe(other);
    expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
  }
});

it('does not authorize an altered logout disposition or expose its cleanup token to normal financial capture', async () => {
  jest.spyOn(automationPolicy, 'isMobileAutomationEnabled').mockReturnValue(true);
  const record = await prepareLogoutDisposition({ ownerId: owner, sessionId: originalSession.id, scope: 'local' });
  await expect(terminatePinnedLogout({ ...record, id: '22222222-2222-4222-8222-222222222222' })).rejects.toMatchObject({ domainCode: 'LOGOUT_SESSION_UNVERIFIED' });
  await expect(terminatePinnedLogout({...record,dataDisposition:'remove'})).rejects.toMatchObject({domainCode:'LOGOUT_SESSION_UNVERIFIED'});
  await expect(captureLiveClerkIdentity()).rejects.toMatchObject({ domainCode: 'LOGOUT_PENDING' });
  expect(global.fetch).not.toHaveBeenCalled(); expect(sdkSignOut).not.toHaveBeenCalled();
});

it('does not repeat installation revocation or SDK termination when automation cleanup-ready resumes', async () => {
  jest.spyOn(automationPolicy, 'isMobileAutomationEnabled').mockReturnValue(true);
  jest.spyOn(phoneNotifications, 'getDeviceRegistration').mockResolvedValue({ deviceFingerprint: 'owned-fixture-installation', platform: 'android', appVersion: '1.0.0' });
  jest.mocked(global.fetch).mockImplementation(async url => {
    if (!String(url).endsWith('/api/v1/tracking/device/installations/sign-out')) throw new TypeError('offline');
    return { ok: true, status: 200, json: async () => ({ data: {}, meta: { requestId: 'logout-fixture' } }) } as Response;
  });
  mockPurgeFailure = true; await expect(logout()).rejects.toThrow('PURGE_INTERRUPTED');
  const record = await loadLogoutDisposition(owner);
  expect(record).toMatchObject({ phase: 'cleanup-ready' });
  const calls = jest.mocked(global.fetch).mock.calls.length;
  mockPurgeFailure = false;
  useAppShellStore.getState().reset(); await useAppShellStore.getState().hydrate();
  await Promise.all([retryPendingLogout(owner), retryPendingLogout(owner)]);
  expect(global.fetch).toHaveBeenCalledTimes(calls); expect(sdkSignOut).toHaveBeenCalledTimes(1);
  expect(await loadLogoutDisposition(owner)).toBeNull();
});

it.each(['prepare', 'provider', 'ready'] as const)('keeps exact-owner data through a %s failure and never purges unconfirmed state', async cut => {
  if (cut === 'provider') mockProviderFailure = true; else mockStorageFailure = cut;
  await expect(logout()).rejects.toThrow();
  expect(mockPurges).toEqual([]); expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
  const disposition = await loadLogoutDisposition(owner);
  if (cut === 'prepare') {
    expect(disposition).toBeNull(); expect(sdkSignOut).not.toHaveBeenCalled();
    expect(useAppShellStore.getState().logoutQuiescingOwnerId).toBeNull();
  } else {
    expect(disposition).toMatchObject({ ownerId: owner, sessionId: originalSession.id, scope: 'local', phase: 'prepared' });
    expect(await loadLocalOwnerAccess()).toBeNull();
    useAppShellStore.getState().reset(); await useAppShellStore.getState().hydrate();
    expect(useAppShellStore.getState().session?.userId).not.toBe(owner);
  }
});

it('resumes confirmed exact-owner cleanup after reconstruction without terminating the provider again', async () => {
  mockPurgeFailure = true;
  await expect(logout()).rejects.toThrow('PURGE_INTERRUPTED');
  expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'cleanup-ready' });
  useAppShellStore.getState().reset(); await useAppShellStore.getState().hydrate();
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  mockPurgeFailure = false; await retryPendingLogout(owner);
  expect(sdkSignOut).toHaveBeenCalledTimes(1);
  expect(mockRows.has(owner)).toBe(false); expect(mockRows.get(other)).toBe(1);
  expect(await loadLogoutDisposition(owner)).toBeNull(); expect(await loadLocalOwnerAccess()).toBeNull();
});

it('retries an uncertain local termination only with the pinned original provider session', async () => {
  mockProviderFailure = true; await expect(logout()).rejects.toThrow('PROVIDER_UNCERTAIN');
  mockProviderFailure = false; await retryPendingLogout(owner);
  expect(sdkSignOut.mock.calls).toEqual([
    [{ scope: 'current', sessionId: originalSession.id }],
    [{ scope: 'current', sessionId: originalSession.id }]
  ]);
  expect(mockRows.has(owner)).toBe(false);
});

it('retains visible recovery and its owner anchor when provider restoration reports signed out', async () => {
  mockProviderFailure = true; await expect(logout()).rejects.toThrow();
  useAppShellStore.getState().reset(); await useAppShellStore.getState().hydrate();
  await restoreAppShellSession({ restoreSession: async () => ({ ...session(), status: 'signed_out', userId: null }) } as AuthService);
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  useAppShellStore.getState().reset(); await useAppShellStore.getState().hydrate();
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  expect(mockRows.get(owner)).toBe(1);
});

it.each(['null', 'replacement-owner', 'replacement-session', 'all-scope'] as const)('preserves data and refuses unsafe prepared retry for %s', async replacement => {
  mockProviderFailure = true; await expect(logout(true, replacement === 'all-scope' ? 'all' : 'local')).rejects.toThrow();
  mockProviderFailure = false;
  if (replacement === 'null') mockSession = null;
  if (replacement === 'replacement-owner') { mockSession = { ...originalSession, id: 'session-b', userId: other }; await seed(other); }
  if (replacement === 'replacement-session') mockSession = { ...originalSession, id: 'session-new-a' };
  await expect(retryPendingLogout(owner)).rejects.toThrow();
  expect(sdkSignOut).toHaveBeenCalledTimes(1); expect(mockPurges).toEqual([]);
  expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
  expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'prepared' });
  if (replacement === 'replacement-owner') expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
});

it('does not clear a replacement owner when A cleanup yields to B admission', async () => {
  mockAfterPurge = async () => { mockSession = { ...originalSession, id: 'session-b', userId: other }; await seed(other); };
  await expect(logout()).rejects.toThrow();
  expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'cleanup-ready' });
  expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(mockRows.get(other)).toBe(1);
  await expect(retryPendingLogout(owner)).rejects.toThrow();
  expect(mockPurges).toEqual([owner]); expect(sdkSignOut).toHaveBeenCalledTimes(1);
});

it('does not reselect A database when B is admitted during its cleanup-ready protected marker read', async () => {
  let readyReads = 0;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => {
    const value = mockSecure.get(key) ?? null;
    if (key.includes('logoutDisposition') && value && JSON.parse(value).phase === 'cleanup-ready' && ++readyReads === 2) {
      mockSession = { ...originalSession, id: 'replacement-session-b', userId: other };
      await seed(other);
      await configureDatabaseOwner(other);
    }
    return value;
  });
  await expect(logout()).rejects.toThrow();
  expect(await loadLogoutDisposition(owner)).toMatchObject({ phase: 'cleanup-ready' });
  expect(mockSelectedDatabaseOwner).toBe(other);
  expect(mockDatabaseSelections).toEqual([other]);
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
  expect(mockPurges).toEqual([]);
  expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
});

it('coalesces visible retry with the still-running original logout and fences new captures', async () => {
  let release!: () => void; mockProviderGate = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  sdkSignOut.mockImplementationOnce(async () => { entered(); await mockProviderGate; mockSession = null; });
  const first = logout(); await started;
  await expect(captureLiveClerkOwner()).rejects.toMatchObject({ domainCode: 'LOGOUT_PENDING' });
  const second = retryPendingLogout(owner); release(); await Promise.all([first, second]);
  expect(sdkSignOut).toHaveBeenCalledTimes(1); expect(mockPurges).toEqual([owner]);
});

it.each([false, true])('does not invent B recovery when an unrelated preparation changes revision during hydration (failure=%s)', async failed => {
  await prepareLogoutDisposition({ ownerId: owner, sessionId: originalSession.id, scope: 'local' });
  await cacheLocalOwnerAccess(session(owner)); expect(await loadLocalOwnerAccess()).toBeNull();
  await seed(other);
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => {
    if (key.includes('nativePrivacyLock')) { entered(); await gate; }
    return mockSecure.get(key) ?? null;
  });
  const hydration = useAppShellStore.getState().hydrate(); await started;
  if (failed) mockStorageFailure = 'prepare';
  const preparation = prepareLogoutDisposition({ ownerId: 'user_unrelated_c', sessionId: 'session-c', scope: 'local' });
  if (failed) await expect(preparation).rejects.toThrow('STORAGE_INTERRUPTED'); else await preparation;
  release(); await hydration;
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).not.toBe(other);
});

it('does not clear B after A restoration encounters a delayed protected-storage failure', async () => {
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(async () => { entered(); await gate; throw new Error('PROTECTED_STORAGE_UNAVAILABLE'); });
  const restoration = restoreAppShellSession({ restoreSession: async () => session() } as AuthService);
  const outcome = expect(restoration).rejects.toThrow('PROTECTED_STORAGE_UNAVAILABLE');
  await started; await seed(other); release(); await outcome;
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
});

it('does not admit A from a delayed profile result after B becomes current', async () => {
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const restoration = restoreAppShellSession({ restoreSession: async () => session() } as AuthService, () => true, {
    getProfileSetup: async () => { entered(); await gate; return incompleteProfile; }
  });
  await started; await seed(other); release(); await restoration;
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(useAppShellStore.getState().profileSetupStatus).toBe('complete');
  expect(await loadLocalOwnerAccess()).toMatchObject({ userId: other });
});

it('admits the latest externally current SDK B over the initially admitted A', async () => {
  mockSession = { ...originalSession, id: 'session-b', userId: other };
  await restoreAppShellSession({ restoreSession: async () => session(other) } as AuthService, () => true, {
    getProfileSetup: async () => incompleteProfile
  });
  expect(useAppShellStore.getState().session?.userId).toBe(other);
  expect(useAppShellStore.getState().profileSetupStatus).toBe('incomplete');
  expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
});

it('shows latest fenced SDK B recovery while preserving both owners protected data and cached A anchor', async () => {
  await seed(other); await seed(owner);
  await prepareLogoutDisposition({ ownerId: other, sessionId: 'session-b', scope: 'local' });
  const protectedBefore = new Map(mockSecure);
  mockSession = { ...originalSession, id: 'session-b', userId: other };
  const profile = jest.fn(async () => incompleteProfile);
  await restoreAppShellSession({ restoreSession: async () => session(other) } as AuthService, () => true, { getProfileSetup: profile });
  expect(useAppShellStore.getState().session?.userId).toBeNull();
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(other);
  expect(profile).not.toHaveBeenCalled();
  expect(mockSecure).toEqual(protectedBefore);
  expect(mockRows.get(owner)).toBe(1); expect(mockRows.get(other)).toBe(1);
});

it('does not restore cached A when its logout is prepared while PIN storage is loading', async () => {
  useAppShellStore.getState().reset();
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => {
    if (key.includes('nativePrivacyLock')) { entered(); await gate; }
    return mockSecure.get(key) ?? null;
  });
  const hydration = useAppShellStore.getState().hydrate(); await started;
  await prepareLogoutDisposition({ ownerId: owner, sessionId: originalSession.id, scope: 'local' });
  release(); await hydration;
  expect(useAppShellStore.getState().session?.userId).not.toBe(owner);
  expect(await loadLocalOwnerAccess()).toBeNull();
});

it('fences same-owner restoration when logout is prepared during profile loading', async () => {
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const restoration = restoreAppShellSession({ restoreSession: async () => session() } as AuthService, () => true, {
    getProfileSetup: async () => { entered(); await gate; return incompleteProfile; }
  });
  await started;
  await prepareLogoutDisposition({ ownerId: owner, sessionId: originalSession.id, scope: 'local' });
  release(); await restoration;
  expect(useAppShellStore.getState().session?.userId).not.toBe(owner);
  expect(useAppShellStore.getState().logoutRecoveryOwnerId).toBe(owner);
  expect(await loadLocalOwnerAccess()).toBeNull();
});
