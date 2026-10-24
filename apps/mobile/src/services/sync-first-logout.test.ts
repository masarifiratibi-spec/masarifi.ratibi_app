import { syncFirstLogout } from './sync-first-logout';

it('retains unsynced work when removal is declined and purges only after explicit acceptance', async () => {
  const events: string[] = [];
  let accept = false;
  const dependencies = {
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
