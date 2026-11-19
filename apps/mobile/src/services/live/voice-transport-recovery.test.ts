// Node 24 test runner provides SQLite; Mobile's runtime typings intentionally omit it.
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      get(...args: string[]): unknown;
      all(): unknown[];
      run(...args: (string | number)[]): { changes: number };
    };
  };
};
import { createLiveVoiceApiService } from './voice-api-service';
import { loadVoiceOperation } from '@/storage/voice-pending-session';
import { loadVoiceBatches } from '@/storage/voice-batch-journal';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID()
}));

let mockNative: InstanceType<typeof DatabaseSync>;
let mockOwner = 'owner-a';
const mockDatabase = {
  getAllAsync: async (sql: string) => mockNative.prepare(sql).all(),
  getFirstAsync: async (sql: string, ...args: string[]) =>
    mockNative.prepare(sql).get(...args) ?? null,
  runAsync: async (sql: string, ...args: (string | number)[]) =>
    mockNative.prepare(sql).run(...args)
};
jest.mock('@/storage/database', () => ({
  openDatabase: async (ownerId: string) => {
    if (ownerId !== mockOwner) throw new Error('stale database owner');
    return mockDatabase;
  },
  runExclusiveDatabaseTransaction: async (
    _db: unknown,
    operation: (db: unknown) => Promise<void>
  ) => {
    mockNative.exec('BEGIN IMMEDIATE');
    try {
      await operation(mockDatabase);
      mockNative.exec('COMMIT');
    } catch (error) {
      mockNative.exec('ROLLBACK');
      throw error;
    }
  }
}));
beforeEach(() => {
  mockOwner = 'owner-a';
  mockNative = new DatabaseSync(':memory:');
  mockNative.exec(
    'CREATE TABLE voice_operation_journal(id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL)'
  );
  mockNative.exec('CREATE TABLE voice_batch_operations(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL)');
});
afterEach(() => mockNative.close());

it('automatically resumes the same one-minute capture after upload interruption and a lost posting response', async () => {
  const previous = process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING;
  process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING = 'true';
  const bytes = new Uint8Array(960_000);
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const transactionId = '22222222-2222-4222-8222-222222222222';
  const batchId = '33333333-3333-4333-8333-333333333333';
  const uri = 'file:///minute.m4a';
  let digest = '';
  let uploads = 0;
  let postings = 0;
  const complete = { sessionId, batchId, transactionIds: [transactionId], status: 'completed', addedCount: 1, ledgerVersion: 1 };
  const json = (value: unknown) => new Response(JSON.stringify(value));
  const request = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    if (path === uri) return new Response(bytes);
    if (path.endsWith('/sessions')) {
      expect(init?.headers).toMatchObject({ 'X-Voice-Contract': '3' });
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ durationMs: 60_000, sizeBytes: bytes.byteLength });
      digest = body.contentHash;
      return json({ session: { id: sessionId, version: 1 }, upload: { path: '/api/v1/voice/sessions/' + sessionId + '/audio' } });
    }
    if (path.endsWith('/batch')) return json(postings ? complete : {
      sessionId, batchId: null, transactionIds: [], status: 'uploading', addedCount: 0, ledgerVersion: 0
    });
    if (path.endsWith('/audio')) {
      uploads++;
      if (uploads === 1) throw new TypeError('upload connection lost');
      expect(new Uint8Array(init?.body as ArrayBuffer).byteLength).toBe(bytes.byteLength);
      return json({ id: sessionId, version: 2, contentHash: digest });
    }
    if (path.endsWith('/process')) {
      postings++;
      throw new TypeError('response lost after posting');
    }
    if (path.endsWith('/recovery')) return json({ items: [] });
    throw Error('Unexpected request: ' + path);
  });
  const options = { baseUrl: 'https://api.masarifiratibi.com', owner: async () => mockOwner,
    token: async () => 'token', request, sleep: async () => {} };
  const first = createLiveVoiceApiService(options);
  try {
    const captureId = await first.queueBatch!({ uri, durationMs: 60_000, contentType: 'audio/m4a', recordedAt: Date.now() }, 'ar', -180);
    await expect(first.runBatch!(captureId)).rejects.toThrow('upload connection lost');
    expect(await loadVoiceBatches(mockOwner)).toMatchObject([{ id: captureId, audioReference: uri, phase: 'created' }]);
    first.pauseBatches!();
    const second = createLiveVoiceApiService(options);
    await second.recoverBatches!();
    await expect(second.runBatch!(captureId)).rejects.toThrow('response lost after posting');
    second.pauseBatches!();
    const third = createLiveVoiceApiService(options);
    await third.recoverBatches!();
    await expect(third.runBatch!(captureId)).resolves.toEqual(complete);
    expect((await loadVoiceBatches(mockOwner))[0].phase).toBe('completed');
    expect(uploads).toBe(2);
    expect(postings).toBe(1);
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('/sessions'))).toHaveLength(1);
    expect(request.mock.calls.find(([url]) => String(url).endsWith('/process'))?.[1]?.headers)
      .toMatchObject({ 'idempotency-key': 'voice-process:' + captureId });
    third.pauseBatches!();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING;
    else process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING = previous;
  }
});

it('journals stable create identity before dispatch and retains it after response loss', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
    .mockImplementationOnce(async () => {
      expect(await loadVoiceOperation(mockOwner)).toMatchObject({
        phase: 'creating',
        createBody: { contentType: 'audio/m4a' }
      });
      throw new Error('response lost');
    });
  const service = createLiveVoiceApiService({
    baseUrl: 'https://api.test',
    owner: async () => mockOwner,
    token: async () => 'token',
    request
  });
  await expect(
    service.transcribe('file:///voice.m4a', 'clear_en', 3000, 'en')
  ).rejects.toMatchObject({ code: 'offline' });
  const pending = await loadVoiceOperation(mockOwner);
  expect(pending?.createKey).toBe(
    request.mock.calls[1]?.[1]?.headers['Idempotency-Key']
  );
  expect(pending?.audioReference).toBe('file:///voice.m4a');
});

it('does not dispatch old-owner work after delayed token acquisition', async () => {
  let release!: (token: string) => void;
  const token = jest.fn(
    () =>
      new Promise<string>((resolve) => {
        release = resolve;
      })
  );
  const request = jest
    .fn()
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  const service = createLiveVoiceApiService({
    baseUrl: 'https://api.test',
    owner: async () => mockOwner,
    token,
    request
  });
  const result = service.transcribe(
    'file:///voice.m4a',
    'clear_en',
    3000,
    'en'
  );
  while (!token.mock.calls.length)
    await new Promise((resolve) => setTimeout(resolve, 1));
  mockOwner = 'owner-b';
  release('new-owner-token');
  await expect(result).rejects.toMatchObject({ code: 'operation_cancelled' });
  expect(request).toHaveBeenCalledTimes(1);
});

it('bounds stalled identity acquisition without reading or submitting audio', async () => {
  jest.useFakeTimers();
  try {
    const request = jest.fn();
    const service = createLiveVoiceApiService({
      baseUrl: 'https://api.test',
      owner: () => new Promise(() => undefined),
      token: async () => 'token',
      request
    });
    const result = expect(
      service.transcribe('file:///voice.m4a', 'clear_en', 3000, 'en')
    ).rejects.toMatchObject({ code: 'offline' });
    await jest.advanceTimersByTimeAsync(10_001);
    await result;
    expect(request).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
