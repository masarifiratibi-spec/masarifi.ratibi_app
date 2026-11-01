import { SecurityWorkerService } from '../../../src/security/security.worker';
import { Readable } from 'node:stream';

describe('SecurityWorkerService', () => {
  async function exportFailure(failure: 'upload' | 'head') {
    const manifest = ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'];
    const requestId = '00000000-0000-4000-8000-000000000001';
    const query = jest.fn((sql: string) =>
      Promise.resolve({
        rows: sql.includes('with selected as')
          ? [{ id: requestId, user_id: 'owner', scope: manifest }]
          : [],
        rowCount: 1,
      }),
    );
    const storage = {
      upload: jest.fn(async (_key: string, stream: Readable) => {
        for await (const chunk of stream) void chunk;
        if (failure === 'upload') throw new Error('upload rejected or outcome unknown');
      }),
      head: jest.fn().mockRejectedValue(new Error('metadata failed')),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const handler = (resourceType: string) => ({
      resourceType,
      schemaVersion: 1,
      export: function* () {
        yield {
          path: resourceType + '/data.json',
          mediaType: 'application/json',
          stream: Readable.from([Buffer.from('{}')]),
        };
      },
    });
    const settings: Record<string, unknown> = {
      MASARIFI_EXPORT_MAX_BYTES: 1_048_576,
      MASARIFI_EXPORT_MAX_ENTRIES: 10,
      MASARIFI_EXPORT_RETENTION_HOURS: 24,
    };
    const worker = new SecurityWorkerService(
      {
        withWorkerTransaction: (action: (client: unknown) => unknown) => action({ query }),
      } as never,
      storage as never,
      handler('identity') as never,
      handler('tracking') as never,
      handler('ai') as never,
      handler('engagement') as never,
      { get: () => manifest, getRequired: (key: string) => settings[key] } as never,
      {} as never,
    );
    await worker.runJob('privacy.export-generate');
    return { storage, query, key: `exports/${requestId}/privacy.zip` };
  }

  it('preserves a pre-existing or uncertain object when the upload did not succeed', async () => {
    const { storage, query } = await exportFailure('upload');
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.head).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='failed'"), [
      expect.any(String),
    ]);
  });

  it('can compensate its newly uploaded object when later integrity verification fails', async () => {
    const { storage, key } = await exportFailure('head');
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.head).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(key);
  });
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
