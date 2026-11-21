import { financialGeneration } from '../../../src/platform/http/financial-generation';
import { TrackingService } from '../../../src/tracking/tracking.service';

describe('tracking unsupported import handling', () => {
  it('persists only a safe hash summary and never stores hostile unsupported bytes', async () => {
    const unsupported = { id: '86000000-0000-4000-8000-000000000001' };
    const repository = {
      recordUnsupported: jest.fn(() => Promise.resolve(unsupported)),
    };
    const storage = { upload: jest.fn() };
    const service = new TrackingService(repository as never, {} as never, storage as never);
    const bytes = Buffer.from('%PDF-fictional');

    await expect(
      service.createImport(
        {
          principal: {
            userId: 'owner',
            sessionId: 'session',
            factorAgeSeconds: 0,
          },
          body: bytes,
          idempotencyKey: 'unsupported-import-key',
          requestId: 'request-1',
        },
        'application/pdf',
        bytes,
        'statement.pdf',
      ),
    ).rejects.toMatchObject({ status: 415 });
    expect(repository.recordUnsupported).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner' }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
      'statement.pdf',
      'UNSUPPORTED_FORMAT',
    );
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.recordUnsupported.mock.calls[0]).not.toContain(bytes);
  });

  const validImport = {
    principal: { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 },
    body: {
      schemaVersion: 1,
      sourceType: 'manual',
      events: [
        {
          sourceItemKey: 'source-1',
          receivedAt: '2026-09-03T10:00:00.000Z',
          body: 'Paid SAR 12',
        },
      ],
    },
    idempotencyKey: 'import-key-1234',
    requestId: 'request-2',
  };

  it.each([false, true])(
    'returns a notification import receipt after intake metrics (replayed=%s)',
    async (replayed) => {
      const receipt = { replayed, resource: { id: '86000000-0000-4000-8000-000000000002' } };
      const repository = {
        reserveRawUpload: jest.fn(() => Promise.resolve()),
        getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
        createImport: jest.fn(() => Promise.resolve(receipt)),
      };
      const storage = {
        upload: jest.fn(() => Promise.resolve(!replayed)),
        delete: jest.fn(),
      };
      const service = new TrackingService(repository as never, {} as never, storage as never);
      const notification = {
        ...validImport,
        body: {
          ...validImport.body,
          sourceType: 'provider',
          sourceChannel: 'android_notification',
        },
      };

      await expect(service.createImport(notification, 'application/json')).resolves.toEqual(
        receipt,
      );
      expect(repository.createImport).toHaveBeenCalledTimes(1);
      expect(repository.createImport).toHaveBeenCalledWith(
        validImport.principal,
        expect.objectContaining({
          sourceType: 'provider',
          sourceChannel: 'android_notification',
        }),
        expect.objectContaining({ key: validImport.idempotencyKey }),
      );
      expect(storage.delete).not.toHaveBeenCalled();
    },
  );

  it('uploads the raw object before atomically registering it with the import', async () => {
    const repository = {
      reserveRawUpload: jest.fn(() => Promise.resolve()),
      getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
      createImport: jest.fn<Promise<{ resource: { id: string } }>, [unknown, unknown, unknown]>(
        () => Promise.resolve({ resource: { id: '86000000-0000-4000-8000-000000000002' } }),
      ),
    };
    const storage = { upload: jest.fn(() => Promise.resolve(true)), delete: jest.fn() };
    const service = new TrackingService(repository as never, {} as never, storage as never);

    await service.createImport(validImport, 'application/json');

    expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createImport.mock.invocationCallOrder[0] as number,
    );
    const request = repository.createImport.mock.calls[0]?.[2] as
      | {
          sourceName: null;
          key: string;
          requestId: string;
          raw: {
            storageRef: string;
            payloadHash: string;
            contentType: string;
            sizeBytes: number;
            expiresAt: Date;
          };
        }
      | undefined;
    expect(request).toMatchObject({
      sourceName: null,
      key: 'import-key-1234',
      requestId: 'request-2',
    });
    const raw = request?.raw;
    expect(raw?.storageRef).toMatch(/^tracking\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
    expect(raw?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw?.contentType).toBe('application/json');
    expect(raw?.sizeBytes).toBeGreaterThan(0);
    expect(raw?.expiresAt).toBeInstanceOf(Date);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('keeps the durable reservation when import acknowledgement is lost', async () => {
    const repository = {
      reserveRawUpload: jest.fn(() => Promise.resolve()),
      getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
      createImport: jest.fn(() => Promise.reject(new Error('database unavailable'))),
    };
    const storage = { upload: jest.fn(() => Promise.resolve(true)), delete: jest.fn() };
    const service = new TrackingService(repository as never, {} as never, storage as never);
    await expect(service.createImport(validImport, 'application/json')).rejects.toThrow(
      'database unavailable',
    );
    expect(repository.reserveRawUpload.mock.invocationCallOrder[0]).toBeLessThan(
      Number(storage.upload.mock.invocationCallOrder[0]),
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('uses separate immutable keys across generations and never uploads a rejected reservation', async () => {
    const repository = {
      getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
      reserveRawUpload: jest.fn<Promise<void>, [unknown, unknown]>().mockResolvedValue(undefined),
      createImport: jest.fn(() => Promise.resolve({ replayed: false })),
    };
    const storage = {
      upload: jest.fn<Promise<boolean>, [string, Buffer, string]>().mockResolvedValue(true),
    };
    const service = new TrackingService(repository as never, {} as never, storage as never);
    await service.createImport(validImport, 'application/json');
    await financialGeneration.run('2', () => service.createImport(validImport, 'application/json'));
    expect(storage.upload.mock.calls[0]?.[0]).not.toBe(storage.upload.mock.calls[1]?.[0]);
    repository.reserveRawUpload.mockRejectedValueOnce(new Error('FINANCIAL_GENERATION_STALE'));
    await expect(service.createImport(validImport, 'application/json')).rejects.toThrow(
      'FINANCIAL_GENERATION_STALE',
    );
    expect(storage.upload).toHaveBeenCalledTimes(2);
  });

  it('scopes a missing CSV source item key to the file content', async () => {
    const repository = {
      reserveRawUpload: jest.fn(() => Promise.resolve()),
      getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
      createImport: jest.fn<Promise<{ resource: { id: string } }>, [unknown, unknown, unknown]>(
        () => Promise.resolve({ resource: { id: 'session' } }),
      ),
    };
    const storage = {
      upload: jest.fn(() => Promise.resolve(true)),
      delete: jest.fn(() => Promise.resolve()),
    };
    const service = new TrackingService(repository as never, {} as never, storage as never);
    const first = Buffer.from(
      'sourceItemKey,receivedAt,body\n,2026-09-03T10:00:00.000Z,Paid SAR 12\n',
    );
    const second = Buffer.from(
      'sourceItemKey,receivedAt,body\n,2026-09-03T10:00:00.000Z,Paid SAR 13\n',
    );

    await service.createImport(
      { ...validImport, idempotencyKey: 'csv-import-key-1' },
      'text/csv',
      first,
    );
    await service.createImport(
      { ...validImport, idempotencyKey: 'csv-import-key-2' },
      'text/csv',
      second,
    );

    const sourceKeys = repository.createImport.mock.calls.map(
      ([, normalized]) =>
        (normalized as { events: Array<{ sourceItemKey: string }> }).events[0]?.sourceItemKey,
    );
    expect(sourceKeys[0]).toMatch(/^[0-9a-f]{64}:row:1$/);
    expect(sourceKeys[1]).toMatch(/^[0-9a-f]{64}:row:1$/);
    expect(sourceKeys[0]).not.toBe(sourceKeys[1]);
  });

  it('uses separate raw objects for identical payloads submitted as distinct commands', async () => {
    const repository = {
      reserveRawUpload: jest.fn(() => Promise.resolve()),
      getPreferences: jest.fn(() => Promise.resolve({ sourceRetentionDays: 7 })),
      createImport: jest.fn(() => Promise.resolve({ resource: { id: 'session' } })),
    };
    const storage = {
      upload: jest.fn<Promise<boolean>, [string, Buffer, string]>(() => Promise.resolve(true)),
      delete: jest.fn(() => Promise.resolve()),
    };
    const service = new TrackingService(repository as never, {} as never, storage as never);

    await service.createImport(validImport, 'application/json');
    await service.createImport(
      { ...validImport, idempotencyKey: 'different-import-key' },
      'application/json',
    );

    expect(storage.upload.mock.calls[0]?.[0]).not.toBe(storage.upload.mock.calls[1]?.[0]);
  });
});
