import {
  draftInputSchema,
  manualSubmissionSchema
} from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { createLiveLedgerService } from './core-finance-service';
import { registerLiveClerkBridge } from './auth-service';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';

const mockSql: string[] = [];
const mockDatabases = new Map<string, ReturnType<typeof mockDatabase>>();
let mockBeforeRead: (() => void) | undefined;
let mockAfterWrite: (() => void) | undefined;
let mockFailOpen = false;
let mockQueue: Promise<unknown> = Promise.resolve();
function mockDatabase() {
  const { DatabaseSync } = jest.requireActual('node:sqlite');
  const native = new DatabaseSync(':memory:');
  for (const table of [
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_drafts'
  ])
    native.exec(
      `CREATE TABLE ${table}(id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT,updated_at INTEGER)`
    );
  native.exec(
    'ALTER TABLE finance_categories ADD COLUMN parent_id TEXT; ALTER TABLE finance_categories ADD COLUMN merged_into_id TEXT'
  );
  native.exec(
    'CREATE TABLE finance_sync_conflicts(transaction_id TEXT,payload TEXT); CREATE TABLE finance_corrections(transaction_id TEXT,payload TEXT,status TEXT); CREATE TABLE finance_operations(operation_id TEXT,transaction_id TEXT,payload TEXT,status TEXT)'
  );
  return {
    native,
    getAllAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      mockBeforeRead?.();
      return native.prepare(sql).all(...args);
    },
    getFirstAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      mockBeforeRead?.();
      return native.prepare(sql).get(...args) ?? null;
    },
    runAsync: async (sql: string, ...args: (string | number)[]) => {
      mockSql.push(sql);
      const result = native.prepare(sql).run(...args);
      mockAfterWrite?.();
      return result;
    },
    execAsync: async (sql: string) => {
      mockSql.push(sql);
      native.exec(sql);
    }
  };
}
jest.mock('@/storage/database', () => ({
  openDatabase: async (owner: string) => {
    if (mockFailOpen) {
      mockFailOpen = false;
      throw new Error('temporary open failure');
    }
    if (!mockDatabases.has(owner)) mockDatabases.set(owner, mockDatabase());
    return mockDatabases.get(owner);
  },
  runExclusiveDatabaseTransaction: (
    db: ReturnType<typeof mockDatabase>,
    action: (tx: unknown) => Promise<void>
  ) => {
    const operation = mockQueue
      .catch(() => undefined)
      .then(async () => {
        db.native.exec('BEGIN');
        try {
          await action(db);
          db.native.exec('COMMIT');
        } catch (error) {
          db.native.exec('ROLLBACK');
          throw error;
        }
      });
    mockQueue = operation;
    return operation;
  }
}));

let owner = 'user_manual-a';
let sessionGeneration = 0;
const getToken = jest.fn(async () => 'isolated-token');
beforeEach(() => {
  mockSql.length = 0;
  mockBeforeRead = undefined;
  mockAfterWrite = undefined;
  mockFailOpen = false;
  owner = 'user_manual-a';
  sessionGeneration++;
  getToken.mockClear();
  for (const db of mockDatabases.values())
    db.native.exec('DELETE FROM finance_drafts');
  registerLiveClerkBridge({
    getSession: async () => ({
      id: `${owner}:${sessionGeneration}`,
      userId: owner,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
});
afterAll(() => {
  for (const db of mockDatabases.values()) db.native.close();
});
const draft = () =>
  draftInputSchema.parse({
    id: 'manual-entry',
    transactionType: 'expense',
    amountText: '٢٥٫٥٠',
    accountId: null,
    destinationAccountId: null,
    categoryId: 'shopping',
    merchant: null,
    notes: null,
    occurredAt: 100,
    status: 'editing',
    updatedAt: 100
  });
const submitted = () => ({
  ...draft(),
  submission: manualSubmissionSchema.parse({
    version: 1 as const,
    operationId: '90000000-0000-4000-8000-000000000001',
    input: {
      type: 'expense' as const,
      amountMinor: 2550,
      currencyCode: 'SAR',
      accountId: 'account-a',
      categoryId: 'shopping',
      title: 'Isolated fixture',
      occurredAt: 100
    },
    firstAttemptAt: 100,
    phase: 'unknown' as const
  })
});

it('loads and persists only the requested draft without hydrating financial tables or looking up tokens', async () => {
  const service = createLiveLedgerService();
  await service.saveDraft(draft());
  await expect(service.loadDraft('manual-entry')).resolves.toMatchObject({
    amountText: '٢٥٫٥٠'
  });
  await expect(service.loadDraft('missing')).resolves.toBeNull();
  expect(mockSql.every((sql) => /finance_drafts/.test(sql))).toBe(true);
  expect(
    mockSql
      .filter((sql) => /^SELECT/.test(sql))
      .every((sql) => /WHERE id\s*=\s*\?/i.test(sql))
  ).toBe(true);
  expect(getToken).not.toHaveBeenCalled();
});

it('checks persisted submission ownership across independent services and serializes competing operation IDs', async () => {
  const first = createLiveLedgerService(),
    second = createLiveLedgerService();
  await second.loadDraft('manual-entry');
  await first.saveDraft(submitted());
  await second.saveDraft({ ...draft(), amountText: '99' });
  await expect(first.loadDraft('manual-entry')).resolves.toMatchObject({
    amountText: '٢٥٫٥٠',
    submission: { phase: 'unknown' }
  });
  const other = {
    ...submitted(),
    submission: {
      ...submitted().submission,
      operationId: '90000000-0000-4000-8000-000000000002'
    }
  };
  await expect(second.saveDraft(other)).rejects.toMatchObject({
    code: 'conflict',
    metadata: { domainCode: 'MANUAL_SUBMISSION_CONFLICT' }
  });
  await second.saveDraft({ ...draft(), submission: null });
  const results = await Promise.allSettled([
    first.saveDraft(submitted()),
    second.saveDraft(other)
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([
    'fulfilled',
    'rejected'
  ]);
});

it('keeps explicit definitive-failure clearing and row-specific discard compatible', async () => {
  const service = createLiveLedgerService();
  await service.saveDraft(submitted());
  await service.saveDraft({ ...draft(), submission: null });
  await expect(service.loadDraft('manual-entry')).resolves.toMatchObject({
    submission: null
  });
  await service.saveDraft({ ...draft(), id: 'other-draft' });
  await service.discardDraft('manual-entry');
  await expect(service.loadDraft('manual-entry')).resolves.toBeNull();
  await expect(service.loadDraft('other-draft')).resolves.toMatchObject({
    id: 'other-draft'
  });
});

it('retries failed opening and returns to the same owners durable draft without relying on an old in-memory snapshot', async () => {
  const service = createLiveLedgerService();
  mockFailOpen = true;
  await expect(service.loadDraft('manual-entry')).rejects.toThrow(
    'temporary open failure'
  );
  await service.saveDraft(draft());
  owner = 'user_manual-b';
  await expect(service.loadDraft('manual-entry')).resolves.toBeNull();
  await service.saveDraft({ ...draft(), amountText: '10' });
  owner = 'user_manual-a';
  await expect(
    createLiveLedgerService().loadDraft('manual-entry')
  ).resolves.toMatchObject({ amountText: '٢٥٫٥٠' });
});

it('rejects an owner change during a read and rolls back a write if the owner changes before commit', async () => {
  const service = createLiveLedgerService();
  await service.saveDraft(draft());
  mockBeforeRead = () => {
    owner = 'user_manual-b';
  };
  await expect(service.loadDraft('manual-entry')).rejects.toMatchObject({
    code: 'session_expired'
  });
  mockBeforeRead = undefined;
  owner = 'user_manual-a';
  mockAfterWrite = () => {
    owner = 'user_manual-b';
  };
  await expect(
    service.saveDraft({ ...draft(), amountText: '99' })
  ).rejects.toMatchObject({ code: 'session_expired' });
  mockAfterWrite = undefined;
  owner = 'user_manual-a';
  await expect(service.loadDraft('manual-entry')).resolves.toMatchObject({
    amountText: '٢٥٫٥٠'
  });
});

it('preserves a separately persisted draft through later live repository hydration and full persistence', async () => {
  const repository = new CoreFinanceRepository();
  repository.bindOwner(owner);
  const service = createLiveLedgerService();
  await repository.hydrate({ preserveDrafts: true });
  await service.saveDraft(submitted());
  await repository.persistAll({ preserveDrafts: true });
  await expect(
    createLiveLedgerService().loadDraft('manual-entry')
  ).resolves.toMatchObject({ submission: { phase: 'unknown' } });
});

it('rejects malformed draft rows without replacing them and retains invalid submission metadata for blocked recovery', async () => {
  const service = createLiveLedgerService();
  await service.loadDraft('initialize-database');
  const native = mockDatabases.get(owner)!.native;
  for (const payload of [
    '{broken',
    JSON.stringify({ ...draft(), id: 'different-id' })
  ]) {
    native
      .prepare(
        'INSERT OR REPLACE INTO finance_drafts(id,payload,status,updated_at) VALUES(?,?,?,?)'
      )
      .run('manual-entry', payload, 'editing', 100);
    await expect(service.loadDraft('manual-entry')).rejects.toThrow();
    expect(
      native
        .prepare('SELECT payload FROM finance_drafts WHERE id=?')
        .get('manual-entry').payload
    ).toBe(payload);
  }
  const blocked = { ...draft(), submission: { phase: 'invalid-legacy-phase' } };
  native
    .prepare('UPDATE finance_drafts SET payload=? WHERE id=?')
    .run(JSON.stringify(blocked), 'manual-entry');
  await expect(service.loadDraft('manual-entry')).resolves.toEqual(blocked);
});

it('reuses a checked draft snapshot without reopening SQLite and returns independent values', async () => {
  const service = createLiveLedgerService();
  await service.saveDraft(draft());
  const first = await service.loadDraft('manual-entry');
  const reads = mockSql.length;
  mockFailOpen = true;
  const second = await service.loadDraft('manual-entry');
  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  expect(mockSql).toHaveLength(reads);
  // Confirm this really bypassed openDatabase, rather than consuming its failure.
  await expect(service.loadDraft('uncached')).rejects.toThrow(
    'temporary open failure'
  );
});

it('invalidates present and missing snapshots on session change and identity reset', async () => {
  const service = createLiveLedgerService();
  await service.saveDraft(draft());
  await service.loadDraft('manual-entry');
  await service.loadDraft('missing');
  sessionGeneration++;
  mockFailOpen = true;
  await expect(service.loadDraft('manual-entry')).rejects.toThrow(
    'temporary open failure'
  );
  await resetRuntimeIdentityData();
  mockFailOpen = true;
  await expect(service.loadDraft('missing')).rejects.toThrow(
    'temporary open failure'
  );
});

it('invalidates snapshots for repository writers and failed writes', async () => {
  const service = createLiveLedgerService();
  const repository = new CoreFinanceRepository();
  repository.bindOwner(owner);
  await service.loadDraft('manual-entry');
  await repository.persistDraft({ ...draft(), amountText: '17' });
  await expect(service.loadDraft('manual-entry')).resolves.toMatchObject({
    amountText: '17'
  });
  await repository.removePersistedDraft('manual-entry');
  await expect(service.loadDraft('manual-entry')).resolves.toBeNull();
  repository.saveDraft(draft());
  await repository.persistAll();
  await expect(service.loadDraft('manual-entry')).resolves.toMatchObject({
    amountText: '٢٥٫٥٠'
  });
  mockFailOpen = true;
  await expect(service.saveDraft(draft())).rejects.toThrow(
    'temporary open failure'
  );
  mockFailOpen = true;
  await expect(service.loadDraft('manual-entry')).rejects.toThrow(
    'temporary open failure'
  );
});
