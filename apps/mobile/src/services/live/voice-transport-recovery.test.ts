// Node 24 test runner provides SQLite; Mobile's runtime typings intentionally omit it.
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      get(...args: string[]): unknown;
      run(...args: (string | number)[]): { changes: number };
    };
  };
};
import { createLiveVoiceApiService } from './voice-api-service';
import { loadVoiceOperation } from '@/storage/voice-pending-session';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID()
}));

let mockNative: InstanceType<typeof DatabaseSync>;
let mockOwner = 'owner-a';
const mockDatabase = {
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
});
afterEach(() => mockNative.close());

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
