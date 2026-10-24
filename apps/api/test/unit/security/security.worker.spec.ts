import { SecurityWorkerService } from '../../../src/security/security.worker';

describe('SecurityWorkerService', () => {
  it.each([0, 24])('erases an eligible owner before identity at cooldown %s', async (hours) => {
    const events: string[] = [];
    const query = jest.fn((sql: string) => {
      if (sql.includes('with selected as'))
        return Promise.resolve({ rows: [{ id: 'request', user_id: 'owner' }] });
      if (sql.includes('freeze_account')) events.push('freeze');
      return Promise.resolve({ rows: [{ held: false }], rowCount: 1 });
    });
    const handler = (resourceType: string) => ({
      resourceType,
      schemaVersion: 1,
      deleteAccount: () => {
        events.push(resourceType);
        return Promise.resolve({});
      },
    });
    const worker = new SecurityWorkerService(
      {
        withWorkerTransaction: (action: (client: unknown) => unknown) => action({ query }),
      } as never,
      {} as never,
      handler('identity') as never,
      handler('tracking') as never,
      handler('ai') as never,
      handler('engagement') as never,
      {
        get: (key: string) =>
          key === 'MASARIFI_DELETION_COOLING_OFF_HOURS'
            ? hours
            : ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'],
      } as never,
      {
        purgeDueUploads: () => Promise.resolve(),
        prepare: () => {
          events.push('prepare');
          return Promise.resolve();
        },
        erase: () => {
          events.push('erase');
          return Promise.resolve({});
        },
      } as never,
    );
    await worker.runJob('privacy.account-delete');
    expect(events).toEqual([
      'freeze',
      'prepare',
      'ai',
      'engagement',
      'tracking',
      'erase',
      'identity',
    ]);
  });
  it('isolates each bounded job so one failure cannot starve the others', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('support expiry unavailable'))
      .mockResolvedValue({ rows: [] });
    const repository = {
      withWorkerTransaction: jest.fn((action: (client: { query: typeof query }) => unknown) =>
        action({ query }),
      ),
    };
    const config = {
      get: jest.fn(() => ['ai@1', 'engagement@1', 'identity@1', 'tracking@1']),
      getRequired: jest.fn(() => 25),
    };
    const identity = {
      resourceType: 'identity',
      schemaVersion: 1,
      export: jest.fn(),
      deleteAccount: jest.fn(),
      listRetentionCandidates: jest.fn(),
      applyRetention: jest.fn(),
    };
    const tracking = { ...identity, resourceType: 'tracking' };
    const ai = { ...identity, resourceType: 'ai' };
    const engagement = { ...identity, resourceType: 'engagement' };
    const worker = new SecurityWorkerService(
      repository as never,
      { delete: jest.fn() } as never,
      identity as never,
      tracking as never,
      ai as never,
      engagement as never,
      config as never,
      {} as never,
    );

    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(repository.withWorkerTransaction).toHaveBeenCalledTimes(6);
    expect(query).toHaveBeenCalledWith('select private.dispatch_security_alerts($1)', [25]);
  });

  it('propagates a governed job failure to the central scheduler', async () => {
    const repository = {
      withWorkerTransaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const handler = {
      resourceType: 'identity',
      schemaVersion: 1,
      export: jest.fn(),
      deleteAccount: jest.fn(),
      listRetentionCandidates: jest.fn(),
      applyRetention: jest.fn(),
    };
    const worker = new SecurityWorkerService(
      repository as never,
      { delete: jest.fn() } as never,
      handler as never,
      { ...handler, resourceType: 'tracking' } as never,
      { ...handler, resourceType: 'ai' } as never,
      { ...handler, resourceType: 'engagement' } as never,
      { get: jest.fn(() => ['ai@1', 'engagement@1', 'identity@1', 'tracking@1']) } as never,
      {} as never,
    );

    await expect(worker.runJob('security.support-expire')).rejects.toThrow('database unavailable');
  });
});
