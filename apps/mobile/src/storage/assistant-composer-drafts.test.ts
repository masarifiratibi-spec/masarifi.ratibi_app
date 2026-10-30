import * as SecureStore from 'expo-secure-store';
import {
  clearAppShellStorageOwner,
  configureAppShellStorageOwner,
  loadAssistantDraft,
  saveAssistantDraft,
  discardAssistantDraft,
  prepareLogoutDisposition,
  purgeAppShellOwnerData
} from './app-shell-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex')
}));

const values = new Map<string, string>();
const first = { text: ' مسودة محلية آمنة ', revision: 'first' };
const second = { text: 'A newer unsent question', revision: 'second' };

beforeEach(async () => {
  values.clear();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (key) => values.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      values.set(key, value);
    });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    values.delete(key);
  });
  await configureAppShellStorageOwner('owner-a');
});
afterEach(() => {
  clearAppShellStorageOwner();
  jest.restoreAllMocks();
});

it('restores exact text in its own landing and conversation scopes', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  await saveAssistantDraft('owner-a', 'conversation:one', second);
  expect(await loadAssistantDraft('owner-a', 'landing')).toEqual(first);
  expect(await loadAssistantDraft('owner-a', 'conversation:one')).toEqual(
    second
  );
  expect(await loadAssistantDraft('owner-a', 'conversation:two')).toBeNull();
});

it('keeps owner stores separate and rejects access after the active owner changes', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  await configureAppShellStorageOwner('owner-b');
  await expect(loadAssistantDraft('owner-a', 'landing')).rejects.toThrow(
    'OWNER_CHANGED'
  );
  expect(await loadAssistantDraft('owner-b', 'landing')).toBeNull();
  await saveAssistantDraft('owner-b', 'landing', second);
  await configureAppShellStorageOwner('owner-a');
  expect(await loadAssistantDraft('owner-a', 'landing')).toEqual(first);
});

it('does not erase a newer edit when an older send is acknowledged', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  await saveAssistantDraft('owner-a', 'landing', second);
  await discardAssistantDraft('owner-a', 'landing', first.revision);
  expect(await loadAssistantDraft('owner-a', 'landing')).toEqual(second);
  await discardAssistantDraft('owner-a', 'landing', second.revision);
  expect(await loadAssistantDraft('owner-a', 'landing')).toBeNull();
});

it('rejects a delayed restore from an obsolete owner generation', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  const read = jest.mocked(SecureStore.getItemAsync);
  let release!: (value: string | null) => void;
  let announce!: () => void;
  const entered = new Promise<void>((resolve) => {
    announce = resolve;
  });
  read.mockImplementation(async (key) => {
    if (key.includes('assistantDrafts')) {
      announce();
      return new Promise((resolve) => {
        release = resolve;
      });
    }
    return values.get(key) ?? null;
  });
  const restoring = loadAssistantDraft('owner-a', 'landing');
  const rejected = expect(restoring).rejects.toThrow('OWNER_CHANGED');
  await entered;
  await configureAppShellStorageOwner('owner-b');
  release(JSON.stringify({ landing: first }));
  await rejected;
});

it('keeps the original stored draft intact on write failure and can retry the new text', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValueOnce(new Error('storage full'));
  await expect(
    saveAssistantDraft('owner-a', 'landing', second)
  ).rejects.toThrow('storage full');
  expect(await loadAssistantDraft('owner-a', 'landing')).toEqual(first);
  await saveAssistantDraft('owner-a', 'landing', second);
  expect(await loadAssistantDraft('owner-a', 'landing')).toEqual(second);
});

it('fails closed on corrupt protected data without deleting or replacing it', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  const key = [...values.keys()].find((value) =>
    value.includes('assistantDrafts')
  )!;
  values.set(key, '{invalid');
  await expect(loadAssistantDraft('owner-a', 'landing')).rejects.toThrow();
  await expect(
    saveAssistantDraft('owner-a', 'landing', second)
  ).rejects.toThrow();
  await expect(discardAssistantDraft('owner-a', 'landing')).rejects.toThrow();
  expect(values.get(key)).toBe('{invalid');
});

it('blocks draft reads and writes after durable logout admission', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  await prepareLogoutDisposition({
    ownerId: 'owner-a',
    sessionId: 'session-a',
    scope: 'local'
  });
  await expect(loadAssistantDraft('owner-a', 'landing')).rejects.toThrow(
    'LOGOUT_PENDING'
  );
  await expect(
    saveAssistantDraft('owner-a', 'landing', second)
  ).rejects.toThrow('LOGOUT_PENDING');
  await expect(discardAssistantDraft('owner-a', 'landing')).rejects.toThrow(
    'LOGOUT_PENDING'
  );
});

it('purges only the requested owner drafts through the existing owner erasure', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  await configureAppShellStorageOwner('owner-b');
  await saveAssistantDraft('owner-b', 'landing', second);
  await purgeAppShellOwnerData('owner-a');
  expect(await loadAssistantDraft('owner-b', 'landing')).toEqual(second);
  await configureAppShellStorageOwner('owner-a');
  expect(await loadAssistantDraft('owner-a', 'landing')).toBeNull();
});

it('finishes a pending protected write before erasure so the draft cannot reappear', async () => {
  await saveAssistantDraft('owner-a', 'landing', first);
  let release!: () => void;
  let announce!: () => void;
  const entered = new Promise<void>((resolve) => {
    announce = resolve;
  });
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementationOnce(async (key, value) => {
      announce();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      values.set(key, value);
    });
  const writing = saveAssistantDraft('owner-a', 'landing', second);
  await entered;
  const purging = purgeAppShellOwnerData('owner-a');
  const purgedBeforePendingWrite = await Promise.race([
    purging.then(() => true),
    new Promise<false>((resolve) => setImmediate(() => resolve(false)))
  ]);
  release();
  await Promise.all([writing, purging]);
  expect(purgedBeforePendingWrite).toBe(false);
  expect(await loadAssistantDraft('owner-a', 'landing')).toBeNull();
});
