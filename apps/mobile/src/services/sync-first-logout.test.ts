import { syncFirstLogout } from './sync-first-logout';
import { useAppShellStore } from '@/state/app-shell';
const mockSecureValues = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecureValues.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockSecureValues.set(key, value); },
  deleteItemAsync: async (key: string) => { mockSecureValues.delete(key); }
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) => jest.requireActual('node:crypto').createHash('sha256').update(value).digest('hex'),
  randomUUID: () => jest.requireActual('node:crypto').randomUUID()
}));
const logout = { ownerId: 'user_logout_fixture', sessionId: 'session-original', scope: 'local' as const };
beforeEach(() => { mockSecureValues.clear(); useAppShellStore.getState().reset(); });

it('retains unsynced work when removal is declined and purges only after explicit acceptance', async () => {
  const events: string[] = [];
  let accept = false;
  const dependencies = {
    logout,
    synchronize: async () => {
      events.push('sync');
      throw new Error('offline');
    },
    pending: async () => 2,
    confirmRemoval: async () => accept,
    signOut: async () => {
      events.push('sign-out');
    },
    purge: async () => {
      events.push('purge');
    },
    assertCurrent: () => undefined
  };
  await expect(syncFirstLogout(dependencies)).resolves.toBe(false);
  expect(events).toEqual(['sync']);
  accept = true;
  await expect(syncFirstLogout(dependencies)).resolves.toBe(true);
  expect(events).toEqual(['sync', 'sync', 'sign-out', 'purge']);
});

it('does not purge if session termination fails or ownership changes', async () => {
  const purge = jest.fn();
  await expect(
    syncFirstLogout({
      logout,
      synchronize: async () => undefined,
      pending: async () => 0,
      confirmRemoval: async () => true,
      assertCurrent: () => undefined,
      signOut: async () => {
        throw new Error('provider unavailable');
      },
      purge
    })
  ).rejects.toThrow('provider unavailable');
  expect(purge).not.toHaveBeenCalled();
});

it('pauses intake before inspection and resumes when logout is cancelled', async () => {
  const events: string[] = [];
  await expect(
    syncFirstLogout({
      logout,
      synchronize: async () => {
        events.push('sync');
      },
      quiesce: async () => {
        events.push('pause');
      },
      pending: async () => {
        events.push('inspect');
        return 1;
      },
      confirmRemoval: async () => false,
      resume: async () => {
        events.push('resume');
      },
      assertCurrent: () => undefined,
      signOut: async () => {
        throw new Error('must retain');
      },
      purge: jest.fn()
    })
  ).resolves.toBe(false);
  expect(events).toEqual(['sync', 'pause', 'inspect', 'resume']);
});

it('resumes the same owner after quiescing fails before disposition', async () => {
  const resume = jest.fn(); const signOut = jest.fn();
  await expect(syncFirstLogout({
    logout, synchronize: async () => undefined,
    quiesce: async () => { throw new Error('DRAIN_FAILED'); },
    resume, pending: async () => 0, confirmRemoval: async () => true,
    assertCurrent: () => undefined, signOut, purge: jest.fn()
  })).rejects.toThrow('DRAIN_FAILED');
  expect(resume).toHaveBeenCalledTimes(1); expect(signOut).not.toHaveBeenCalled();
});
