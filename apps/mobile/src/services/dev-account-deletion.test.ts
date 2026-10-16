import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deletionNative,
  resetDeletionNative,
  seedDeletedOwner
} from '@/test-utils/deletion-native-boundaries';
import {
  configureDatabaseOwner,
  resetDatabaseForTests
} from '@/storage/database';
import {
  loadAccountDeletionJournal,
  saveAccountDeletionOperationId,
  saveAccountDeletionRequestId
} from '@/storage/account-deletion-journal';
import {
  loadDeletionCompletion,
  pendingDeletionOwners,
  prepareDeletionCompletion,
  saveDeletionCompletion
} from '@/storage/deletion-completion-journal';
import {
  createLiveAuthService,
  registerLiveClerkBridge,
  type LiveClerkBridge
} from '@/services/live/auth-service';
import { useAppShellStore } from '@/state/app-shell';
import {
  getDevDeletionSnapshots,
  prepareDevDeletionBootstrap,
  reconcileDevAccountDeletions,
  submitDevAccountDeletion
} from './dev-account-deletion';

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

const OWNER = 'user_privacy_owner';
const OTHER = 'user_privacy_other';
let activeOwner: string | null;
let signOutGate: Promise<void> | null;
let bridge: LiveClerkBridge;
const http = jest.fn();
let logSpy: jest.SpyInstance;
const fullRequest = {
  id: 'af2d1978-c49d-4336-ac69-d7bf65669a11',
  status: 'completed',
  requestedAt: '2026-10-16T08:00:00.000Z',
  coolingOffEndsAt: '2026-10-16T08:00:00.000Z',
  completedAt: '2026-10-16T08:00:00.000Z',
  retainedCategories: [],
  version: 3
};
const completedReceipt = {
  id: fullRequest.id,
  status: 'completed',
  completedAt: fullRequest.completedAt,
  errorCode: null,
  version: 3
};
function response(
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    headers: new Headers(headers)
  } as Response;
}
function shellOwner(ownerId: string | null) {
  useAppShellStore.setState({
    session: ownerId
      ? {
          status: 'authenticated',
          userId: ownerId,
          method: 'google',
          issuedAt: Date.now() - 60_000,
          expiresAt: Date.now() + 60_000,
          restoration: 'restored'
        }
      : null
  });
}
function snapshot() {
  return getDevDeletionSnapshots().find((entry) => entry.ownerId === OWNER);
}

beforeEach(async () => {
  process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
  process.env.EXPO_PUBLIC_APP_VARIANT = 'staging-development-privacy';
  process.env.EXPO_PUBLIC_API_URL =
    'https://api.staging.masarifiratibi.com/dev-privacy';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_bWFzYXJpZmkudGVzdCQ';
  await AsyncStorage.clear();
  resetDeletionNative();
  resetDatabaseForTests();
  activeOwner = OWNER;
  signOutGate = null;
  bridge = {
    getSession: async () =>
      activeOwner
        ? {
            id: `session_${activeOwner}`,
            userId: activeOwner,
            method: 'google',
            issuedAt: Date.now() - 1000,
            expiresAt: Date.now() + 60_000
          }
        : null,
    getToken: jest.fn(async ({ skipCache }) =>
      skipCache ? 'fresh_clerk_token' : 'cached_clerk_token'
    ),
    signOut: jest.fn(
      async ({
        sessionId
      }: {
        scope: 'current' | 'all';
        sessionId?: string;
      }) => {
        await signOutGate;
        if (`session_${activeOwner}` === sessionId) activeOwner = null;
      }
    ),
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn()
  };
  registerLiveClerkBridge(bridge);
  shellOwner(OWNER);
  http.mockReset();
  global.fetch = http;
  logSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  logSpy.mockRestore();
  delete process.env.EXPO_PUBLIC_CLIENT_MODE;
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
});

test('persists a secret capability before HTTP, accepts actual completion after Clerk revocation, and erases only that owner', async () => {
  const ownerFile = seedDeletedOwner(OWNER);
  const otherFile = seedDeletedOwner(OTHER);
  await saveAccountDeletionOperationId(OWNER, 'old-operation');
  await saveAccountDeletionRequestId(OWNER, 'old-request');
  await saveAccountDeletionRequestId(OTHER, 'other-request');
  http.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const persisted = await loadDeletionCompletion(OWNER);
    expect(persisted?.completionToken).toBe(body.completionToken);
    expect(body.completionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted?.operationId).toBe(
      (init.headers as Record<string, string>)['Idempotency-Key']
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh_clerk_token'
    );
    expect(await pendingDeletionOwners()).toContain(OWNER);
    const publicStorage = JSON.stringify(
      await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())
    );
    expect(publicStorage).not.toContain(body.completionToken);
    activeOwner = null;
    return response(fullRequest, 202);
  });
  await submitDevAccountDeletion(OWNER);
  expect(snapshot()?.phase).toBe('completed');
  expect(deletionNative.files.has(ownerFile)).toBe(false);
  expect(deletionNative.files.has(otherFile)).toBe(true);
  expect(await loadDeletionCompletion(OWNER)).toBeNull();
  expect(await pendingDeletionOwners()).toEqual([]);
  expect(await loadAccountDeletionJournal(OWNER)).toEqual({
    requestId: null,
    operationId: null
  });
  expect(await loadAccountDeletionJournal(OTHER)).toEqual({
    requestId: 'other-request',
    operationId: null
  });
  expect(useAppShellStore.getState().session?.status).toBe('signed_out');
  expect((await createLiveAuthService(bridge).restoreSession()).status).toBe(
    'signed_out'
  );
  expect(JSON.stringify(logSpy.mock.calls)).not.toMatch(/[a-f0-9]{64}/);
});

test('recovers a lost POST response after logout using only its persisted capability and no second POST', async () => {
  seedDeletedOwner(OWNER);
  http.mockImplementationOnce(async () => {
    activeOwner = null;
    throw new TypeError('offline');
  });
  await submitDevAccountDeletion(OWNER);
  const journal = await loadDeletionCompletion(OWNER);
  expect(journal?.phase).toBe('submitted');
  shellOwner(null);
  http.mockResolvedValueOnce(response(completedReceipt));
  await reconcileDevAccountDeletions({ force: true });
  expect(http.mock.calls.map(([, init]) => init.method)).toEqual([
    'POST',
    'GET'
  ]);
  expect(http.mock.calls[1][0]).toBe(
    `https://api.staging.masarifiratibi.com/dev-privacy/api/v1/privacy/deletion-completions/${journal?.operationId}`
  );
  expect(http.mock.calls[1][1].headers.Authorization).toBe(
    `Bearer ${journal?.completionToken}`
  );
  expect(snapshot()?.phase).toBe('completed');
});

test('keeps a completed checkpoint when local erasure fails and finishes without HTTP after relaunch', async () => {
  const ownerFile = seedDeletedOwner(OWNER);
  deletionNative.failFileDeletion = true;
  http.mockResolvedValueOnce(response(fullRequest, 202));
  await submitDevAccountDeletion(OWNER);
  expect((await loadDeletionCompletion(OWNER))?.phase).toBe('server_completed');
  expect(snapshot()?.phase).toBe('local_retry');
  expect(deletionNative.files.has(ownerFile)).toBe(true);
  // Process-local UI state cannot supply completion; reload the durable checkpoint.
  deletionNative.failFileDeletion = false;
  shellOwner(null);
  await reconcileDevAccountDeletions({ force: true });
  expect(http).toHaveBeenCalledTimes(1);
  expect(snapshot()?.phase).toBe('completed');
  expect(deletionNative.files.has(ownerFile)).toBe(false);
});

test.each([401, 404, 429, 503])(
  'does not infer completion from a %i capability response',
  async (status) => {
    seedDeletedOwner(OWNER);
    http.mockRejectedValueOnce(new TypeError('lost response'));
    await submitDevAccountDeletion(OWNER);
    http.mockResolvedValueOnce(
      response(
        { code: status === 429 ? 'RATE_LIMITED' : 'NOT_FOUND' },
        status,
        { 'Retry-After': '120' }
      )
    );
    const startedAt = Date.now();
    await reconcileDevAccountDeletions({ force: true });
    expect(snapshot()?.phase).not.toBe('completed');
    expect((await loadDeletionCompletion(OWNER))?.phase).toBe('submitted');
    expect(snapshot()?.nextAttemptAt).toBeGreaterThanOrEqual(
      startedAt + 120_000
    );
    expect(
      http.mock.calls.filter(([, init]) => init.method === 'POST')
    ).toHaveLength(1);
    await reconcileDevAccountDeletions({ force: true });
    expect(http).toHaveBeenCalledTimes(2);
  }
);

test('never signs out a newly active owner while the old owner signout is awaiting the SDK', async () => {
  const oldFile = seedDeletedOwner(OWNER);
  const otherFile = seedDeletedOwner(OTHER);
  let release!: () => void;
  signOutGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  http.mockResolvedValueOnce(response(fullRequest, 202));
  const completion = submitDevAccountDeletion(OWNER);
  while (!(bridge.signOut as jest.Mock).mock.calls.length)
    await new Promise((resolve) => setTimeout(resolve, 1));
  activeOwner = OTHER;
  shellOwner(OTHER);
  release();
  await completion;
  expect(activeOwner).toBe(OTHER);
  expect(useAppShellStore.getState().session?.userId).toBe(OTHER);
  expect(deletionNative.files.has(oldFile)).toBe(false);
  expect(deletionNative.files.has(otherFile)).toBe(true);
});

test('resumes explicit recent-auth rejection with the same operation and token after fresh verification', async () => {
  http.mockResolvedValueOnce(response({ code: 'RECENT_AUTH_REQUIRED' }, 403));
  await submitDevAccountDeletion(OWNER);
  expect(snapshot()?.phase).toBe('verification_required');
  const before = await loadDeletionCompletion(OWNER);
  http.mockResolvedValueOnce(response(fullRequest, 202));
  await submitDevAccountDeletion(OWNER);
  const secondBody = JSON.parse(http.mock.calls[1][1].body);
  expect(secondBody.completionToken).toBe(before?.completionToken);
  expect(http.mock.calls[1][1].headers['Idempotency-Key']).toBe(
    before?.operationId
  );
  expect(snapshot()?.phase).toBe('completed');
});

test('fences a deleted owner against stale SDK restoration without blocking another owner', async () => {
  http.mockResolvedValueOnce(response(fullRequest, 202));
  await submitDevAccountDeletion(OWNER);
  activeOwner = OWNER;
  expect((await createLiveAuthService(bridge).restoreSession()).status).toBe(
    'signed_out'
  );
  await expect(configureDatabaseOwner(OWNER)).rejects.toThrow(
    'deleted database owner'
  );
  shellOwner(OTHER);
  await expect(prepareDevDeletionBootstrap()).resolves.toBe(false);
  expect(useAppShellStore.getState().session?.userId).toBe(OTHER);
  activeOwner = OTHER;
  expect((await createLiveAuthService(bridge).restoreSession()).userId).toBe(
    OTHER
  );
});

test('refuses to send an authenticated deletion for a different actor or ordinary runtime', async () => {
  activeOwner = OTHER;
  await expect(submitDevAccountDeletion(OWNER)).rejects.toMatchObject({
    code: 'session_expired'
  });
  expect(http).not.toHaveBeenCalled();
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
  await expect(submitDevAccountDeletion(OTHER)).rejects.toThrow();
  expect(http).not.toHaveBeenCalled();
});

test('preserves a prepared operation when the actor switches during persistence before HTTP', async () => {
  const originalSet =
    deletionNative.secureStore.setItemAsync.getMockImplementation()!;
  const write = jest
    .spyOn(deletionNative.secureStore, 'setItemAsync')
    .mockImplementation(async (key, secret) => {
      await originalSet(key, secret);
      if (
        key.includes('.capability.') &&
        JSON.parse(secret).phase === 'submitted'
      ) {
        activeOwner = OTHER;
        shellOwner(OTHER);
      }
    });
  await submitDevAccountDeletion(OWNER);
  const prepared = await loadDeletionCompletion(OWNER);
  expect(prepared?.phase).toBe('prepared');
  expect(http).not.toHaveBeenCalled();
  await reconcileDevAccountDeletions({ force: true });
  expect(http).not.toHaveBeenCalled();
  expect(useAppShellStore.getState().session?.userId).toBe(OTHER);
  write.mockRestore();
  deletionNative.secureStore.setItemAsync.mockImplementation(originalSet);
  activeOwner = OWNER;
  shellOwner(OWNER);
  http.mockResolvedValueOnce(response(fullRequest, 202));
  await submitDevAccountDeletion(OWNER);
  expect(http.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    prepared?.operationId
  );
  expect(JSON.parse(http.mock.calls[0][1].body).completionToken).toBe(
    prepared?.completionToken
  );
});

test.each(['owner-index', 'capability-record'])(
  'retains discoverable secret-free completion when %s terminal cleanup fails',
  async (boundary) => {
    seedDeletedOwner(OWNER);
    const indexRemove = jest.spyOn(AsyncStorage, 'removeItem');
    const secureRemove = jest.spyOn(
      deletionNative.secureStore,
      'deleteItemAsync'
    );
    const originalIndex = indexRemove.getMockImplementation()!;
    const originalSecure = secureRemove.getMockImplementation()!;
    if (boundary === 'owner-index')
      indexRemove.mockImplementation(async (key) => {
        if (key === 'masarifi.deletionCompletion.owners')
          throw new Error('index deletion unavailable');
        return originalIndex(key);
      });
    else
      secureRemove.mockImplementation(async (key) => {
        if (key.includes('.capability.'))
          throw new Error('capability metadata deletion unavailable');
        return originalSecure(key);
      });
    http.mockResolvedValueOnce(response(fullRequest, 202));
    await submitDevAccountDeletion(OWNER);
    expect((await loadDeletionCompletion(OWNER))?.phase).toBe(
      'local_completed'
    );
    expect((await loadDeletionCompletion(OWNER))?.completionToken).toBeNull();
    expect(await pendingDeletionOwners()).toContain(OWNER);
    expect(snapshot()?.phase).toBe('local_retry');
    indexRemove.mockRestore();
    AsyncStorage.removeItem = originalIndex as typeof AsyncStorage.removeItem;
    secureRemove.mockRestore();
    deletionNative.secureStore.deleteItemAsync.mockImplementation(
      originalSecure
    );
    shellOwner(null);
    await reconcileDevAccountDeletions({ force: true });
    expect(await pendingDeletionOwners()).toEqual([]);
    expect(await loadDeletionCompletion(OWNER)).toBeNull();
    expect(snapshot()?.phase).toBe('completed');
    expect(http).toHaveBeenCalledTimes(1);
  }
);

test('does not erase local payload for a malformed completion without a server completion timestamp', async () => {
  const ownerFile = seedDeletedOwner(OWNER);
  http.mockResolvedValueOnce(
    response({ ...fullRequest, completedAt: null }, 202)
  );
  await submitDevAccountDeletion(OWNER);
  expect(snapshot()?.phase).toBe('unavailable');
  expect((await loadDeletionCompletion(OWNER))?.phase).toBe('submitted');
  expect(deletionNative.files.has(ownerFile)).toBe(true);
});

test('a corrupt foreign journal cannot block valid owner bootstrap or clear either owner payload', async () => {
  const oldFile = seedDeletedOwner(OWNER);
  const otherFile = seedDeletedOwner(OTHER);
  await prepareDeletionCompletion(OWNER);
  const key = [...deletionNative.secrets.keys()].find((key) =>
    key.includes('.capability.')
  )!;
  deletionNative.secrets.set(key, '{corrupt');
  activeOwner = OTHER;
  shellOwner(OTHER);
  await expect(prepareDevDeletionBootstrap()).resolves.toBe(true);
  await expect(reconcileDevAccountDeletions()).resolves.toBeUndefined();
  expect(useAppShellStore.getState().session?.userId).toBe(OTHER);
  expect((await createLiveAuthService(bridge).restoreSession()).userId).toBe(
    OTHER
  );
  expect(deletionNative.files.has(oldFile)).toBe(true);
  expect(deletionNative.files.has(otherFile)).toBe(true);
  expect(http).not.toHaveBeenCalled();
});

test('offline reconciliation preserves the operation without HTTP and network return uses its capability', async () => {
  http.mockResolvedValueOnce(
    response({ ...fullRequest, status: 'processing', completedAt: null }, 202)
  );
  await submitDevAccountDeletion(OWNER);
  const original = await loadDeletionCompletion(OWNER);
  await reconcileDevAccountDeletions({ force: true, online: false });
  expect(http).toHaveBeenCalledTimes(1);
  expect((await loadDeletionCompletion(OWNER))?.operationId).toBe(
    original?.operationId
  );
  http.mockResolvedValueOnce(response(completedReceipt));
  await reconcileDevAccountDeletions({ force: true, online: true });
  expect(http.mock.calls[1][1].method).toBe('GET');
  expect(http.mock.calls[1][1].headers.Authorization).toBe(
    `Bearer ${original?.completionToken}`
  );
  expect(snapshot()?.phase).toBe('completed');
});

test('exhausted persisted automatic attempts stop polling while explicit status retry remains available', async () => {
  const prepared = await prepareDeletionCompletion(OWNER);
  await saveDeletionCompletion({
    ...prepared,
    phase: 'submitted',
    attempts: 6,
    nextAttemptAt: 0
  });
  await reconcileDevAccountDeletions();
  expect(http).not.toHaveBeenCalled();
  http.mockResolvedValueOnce(response(completedReceipt));
  await reconcileDevAccountDeletions({ force: true });
  expect(http.mock.calls.map(([, init]) => init.method)).toEqual(['GET']);
  expect(snapshot()?.phase).toBe('completed');
});

test('bootstrap repairs a prepared secure journal whose public owner index write was interrupted', async () => {
  const journal = await prepareDeletionCompletion(OWNER);
  await AsyncStorage.removeItem('masarifi.deletionCompletion.owners');
  await expect(prepareDevDeletionBootstrap()).resolves.toBe(false);
  expect(await pendingDeletionOwners()).toEqual([OWNER]);
  expect((await loadDeletionCompletion(OWNER))?.operationId).toBe(
    journal.operationId
  );
  expect((await loadDeletionCompletion(OWNER))?.completionToken).toBe(
    journal.completionToken
  );
  expect(http).not.toHaveBeenCalled();
});
