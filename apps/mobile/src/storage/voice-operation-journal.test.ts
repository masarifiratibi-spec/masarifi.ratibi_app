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
import { openDatabase } from './database';
import {
  loadVoiceOperation,
  saveVoiceOperation,
  clearVoiceOperation,
  type VoiceOperation
} from './voice-pending-session';

let mockNative: InstanceType<typeof DatabaseSync>;
let mockActiveOwner = 'owner-a';
const mockDatabase = {
  getFirstAsync: async (sql: string, ...args: string[]) =>
    mockNative.prepare(sql).get(...args) ?? null,
  runAsync: async (sql: string, ...args: (string | number)[]) =>
    mockNative.prepare(sql).run(...args)
};
jest.mock('./database', () => ({
  openDatabase: jest.fn(async (ownerId: string) => {
    if (ownerId !== mockActiveOwner) throw new Error('stale database owner');
    return mockDatabase;
  }),
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

const id = (n: number) =>
  '99000000-0000-4000-8000-' + String(n).padStart(12, '0');
const operation: VoiceOperation = {
  attemptId: id(1),
  revision: 0,
  phase: 'captured',
  createKey: id(2),
  processKey: id(3),
  cancelKey: id(4),
  createBody: {
    locale: 'en',
    durationMs: 2832,
    contentType: 'audio/m4a',
    sizeBytes: 44,
    contentHash: 'a'.repeat(64),
    recordedAt: new Date().toISOString(),
    timezoneOffsetMinutes: -180
  },
  sessionId: null,
  sessionVersion: null,
  processBody: null,
  proposalId: null,
  proposalVersion: null,
  confirmationKey: null,
  confirmationBody: null,
  transactionId: null,
  audioReference: 'file:///voice.m4a',
  createdAt: 1
};
beforeEach(() => {
  mockActiveOwner = 'owner-a';
  mockNative = new DatabaseSync(':memory:');
  mockNative.exec(
    "CREATE TABLE voice_operation_journal(id TEXT PRIMARY KEY CHECK(id='singleton'),attempt_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL)"
  );
});
afterEach(() => mockNative.close());

it('persists operation identity and exact capture metadata before transport', async () => {
  await saveVoiceOperation('owner-a', operation, true);
  expect(await loadVoiceOperation('owner-a')).toEqual(operation);
  expect(openDatabase).toHaveBeenCalledWith('owner-a');
});
it('rejects stale writes and cleanup from a superseded attempt', async () => {
  await saveVoiceOperation('owner-a', operation, true);
  await saveVoiceOperation('owner-a', {
    ...operation,
    revision: 1,
    phase: 'created',
    sessionId: id(5)
  });
  await expect(
    saveVoiceOperation('owner-a', {
      ...operation,
      revision: 1,
      phase: 'uploaded'
    })
  ).rejects.toThrow('stale voice operation');
  await clearVoiceOperation('owner-a', id(6));
  expect(await loadVoiceOperation('owner-a')).toMatchObject({
    phase: 'created',
    revision: 1
  });
});
it('does not overwrite an unresolved explicitly authorized confirmation', async () => {
  await saveVoiceOperation(
    'owner-a',
    {
      ...operation,
      phase: 'confirmation_unknown',
      confirmationKey: id(7),
      confirmationBody: { expectedVersion: 4 }
    },
    true
  );
  await expect(
    saveVoiceOperation('owner-a', { ...operation, attemptId: id(8) }, true)
  ).rejects.toThrow('pending voice operation');
});
it('fences an owner change through the existing database helper', async () => {
  mockActiveOwner = 'owner-b';
  await expect(saveVoiceOperation('owner-a', operation, true)).rejects.toThrow(
    'stale database owner'
  );
});
