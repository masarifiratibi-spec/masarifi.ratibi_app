import { readFileSync } from 'node:fs';
import { listPlanningDrafts } from './planning-draft-storage';
import { createLiveFinancialPlanningService } from '@/services/live/financial-planning-service';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { CoreFinanceRepository } from './core-finance-repository';
import { createLiveCoreFinanceService } from '@/services/core-finance-runtime';
import { registerLiveClerkBridge } from '@/services/live/auth-service';
import { useAppShellStore } from '@/state/app-shell';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { transactionInputSchema } from '@/domain/core-finance';
import { SyncRepository } from './sync-repository';
import { createLiveCoreFinanceSync } from '@/services/live/core-finance-service';
import { CoreFinanceSyncAdapter } from './core-finance-sync-adapter';
import { normalizeMutationBatch } from '../../../api/src/sync/sync.dto';
import { syncFirstLogout } from '@/services/sync-first-logout';
import { settleTransactionDraftWrites } from './transaction-draft-snapshots';
import { pendingOwnerWork } from './pending-owner-work';

jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

type NativeDatabase = {
  close(): void;
  exec(sql: string): void;
  function(name: string, callback: () => number): void;
  prepare(sql: string): {
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
    run(...values: unknown[]): unknown;
  };
};
const { DatabaseSync } = jest.requireActual('node:sqlite') as {
  DatabaseSync: new (path: string) => NativeDatabase;
};
let mockDatabase: SQLiteDatabase;
let mockExclusive = false;
let mockOwner = 'user_offline';
jest.mock('./database', () => ({
  hasQuarantinedOwnerDatabase: async () => false,
  openDatabase: async (owner?: string) => {
    if (mockExclusive) throw new Error('nested database lifecycle');
    if (owner && owner !== mockOwner) throw new Error('stale database owner');
    return mockDatabase;
  },
  runExclusiveDatabaseTransaction: async (
    _database: unknown,
    action: (db: unknown) => Promise<void>
  ) => {
    mockExclusive = true;
    await mockDatabase.execAsync('BEGIN IMMEDIATE');
    try {
      await action(mockDatabase);
      await mockDatabase.execAsync('COMMIT');
    } catch (error) {
      await mockDatabase.execAsync('ROLLBACK');
      throw error;
    } finally {
      mockExclusive = false;
    }
  }
}));
jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: true, isOnline: jest.fn(async () => false) }
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

let native: InstanceType<typeof DatabaseSync>;
const account = {
  ...fixtureAccounts[0]!,
  id: '21000000-0000-4000-8000-000000000001',
  currencyCode: 'SAR',
  status: 'active' as const
};
const expenseCategory = {
  ...fixtureCategories.find((row) => row.financialType === 'expense')!,
  id: 'food',
  parentId: null
};
const incomeCategory = {
  ...fixtureCategories.find((row) => row.financialType === 'income')!,
  id: 'other-income',
  parentId: null
};
const operationId = '21000000-0000-4000-8000-000000000002';
const serverCategoryId = '21000000-0000-4000-8000-000000000003';
const input = (type: 'expense' | 'income' = 'expense') =>
  transactionInputSchema.parse({
    type,
    amountMinor: 100,
    currencyCode: 'SAR',
    accountId: account.id,
    categoryId: type === 'expense' ? expenseCategory.id : incomeCategory.id,
    title: 'T03 offline creation',
    occurredAt: 1793000000000
  });
const session = (restoration: 'restored' | 'local') => ({
  status: 'authenticated' as const,
  userId: 'user_offline',
  method: 'google' as const,
  issuedAt: 1,
  expiresAt: 9999999999999,
  restoration
});
const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const service = () =>
  createLiveCoreFinanceService({ baseUrl: 'https://inert.invalid', request });

beforeEach(async () => {
  native = new DatabaseSync(':memory:');
  mockDatabase = {
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    runAsync: async (sql: string, ...params: never[]) =>
      native.prepare(sql).run(...params),
    getFirstAsync: async (sql: string, ...params: never[]) =>
      native.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, ...params: never[]) =>
      native.prepare(sql).all(...params)
  } as unknown as SQLiteDatabase;
  const source = readFileSync(join(__dirname, 'database.ts'), 'utf8');
  const start = source.indexOf('const migrations = parseMigrations(`');
  const end = source.indexOf('`);', start);
  const parts = source
    .slice(start + 'const migrations = parseMigrations(`'.length, end)
    .split(/-- migration:(\d+)/);
  const migrations = new Map<number, string>();
  for (let index = 1; index < parts.length; index += 2)
    migrations.set(Number(parts[index]), parts[index + 1]!);
  const schema = [...migrations]
    .sort(([a], [b]) => a - b)
    .map(([, sql]) => sql)
    .join('\n');
  native.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);' +
      schema
  );
  mockOwner = 'user_offline';
  request.mockReset().mockRejectedValue(new TypeError('offline'));
  jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
  useAppShellStore.setState({
    session: session('restored'),
    privacyLock: {
      ...useAppShellStore.getState().privacyLock!,
      appLockStatus: 'unlocked'
    }
  });
  registerLiveClerkBridge({
    getSession: async () => ({
      ...session('restored'),
      id: 'session',
      userId: mockOwner
    }),
    getToken: async () => 'boundary-token',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
  const repository = new CoreFinanceRepository({
    accounts: [account],
    categories: [expenseCategory, incomeCategory]
  });
  await repository.persistAll();
  for (const category of [expenseCategory, incomeCategory])
    await mockDatabase.runAsync(
      'INSERT INTO sync_id_mappings(domain,local_id,server_id,updated_at) VALUES(?,?,?,?)',
      'categories',
      category.id,
      category.id === expenseCategory.id
        ? serverCategoryId
        : serverCategoryId.replace(/3$/, '4'),
      1
    );
});
afterEach(() => {
  native.close();
  useAppShellStore.setState({ session: null });
});

it('counts an editing planning draft as pending logout work without counting already saved drafts', async () => {
  native.prepare("INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES(?,?,?,?,?)").run('2026-13','{}','budget','editing',1);
  native.prepare("INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES(?,?,?,?,?)").run('saved','{}','budget','saved',1);
  await expect(pendingOwnerWork(mockOwner)).resolves.toBe(1);
  expect(native.prepare('SELECT id FROM planning_drafts ORDER BY id').all()).toEqual([{id:'2026-13'},{id:'saved'}]);
});

it('T04 logout settles an admitted draft write before disposition and cancels without losing that draft', async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const run = mockDatabase.runAsync.bind(mockDatabase);
  const intercept = jest.spyOn(mockDatabase, 'runAsync').mockImplementation(async (sql, ...args) => {
    if (sql.includes('INSERT INTO finance_drafts')) { entered(); await gate; }
    return run(sql, ...args);
  });
  const draft = { id: 't04-inflight-draft', transactionType: 'expense' as const, amountText: '1', accountId: account.id, destinationAccountId: null, categoryId: expenseCategory.id, merchant: null, notes: 'Preserve pending input', occurredAt: input().occurredAt, status: 'editing' as const, updatedAt: Date.now() };
  const saving = service().saveDraft(draft);
  await started;
  let inspected = false;
  let paused!: () => void;
  const quiesced = new Promise<void>(resolve => { paused = resolve; });
  const terminate = jest.fn();
  const loggingOut = syncFirstLogout({
    logout: { ownerId: mockOwner, sessionId: 'session', scope: 'local' },
    synchronize: async () => undefined,
    quiesce: async () => { useAppShellStore.setState({ logoutQuiescingOwnerId: mockOwner }); paused(); await settleTransactionDraftWrites(); },
    pending: async () => { inspected = true; return (await mockDatabase.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM finance_drafts'))!.count; },
    confirmRemoval: async count => { expect(count).toBe(1); return false; },
    signOut: terminate, purge: jest.fn(), assertCurrent: () => undefined,
    resume: async () => { useAppShellStore.setState({ logoutQuiescingOwnerId: null }); }
  });
  await quiesced;
  expect(inspected).toBe(false);
  await expect(service().saveDraft({ ...draft, id: 't04-new-draft-denied' })).rejects.toMatchObject({ metadata: { domainCode: 'LOGOUT_PENDING' } });
  release();
  await saving;
  await expect(loggingOut).resolves.toBe(false);
  intercept.mockRestore();
  expect(terminate).not.toHaveBeenCalled();
  expect(await service().loadDraft(draft.id)).toMatchObject({ id: draft.id, notes: draft.notes });
});

it.each([false, true])('T04 real HTTP cursor recovery preserves durable pending work; owner changes=%s', async (ownerChanges) => {
  const saved = await service().createTransaction(input(), operationId);
  const queue = new SyncRepository(mockDatabase);
  await queue.retry(operationId, Date.now() + 60_000, 'WAIT_FOR_RETRY');
  const oldCursor = `cursor.${'a'.repeat(43)}`;
  const newCursor = `cursor.${'b'.repeat(43)}`;
  await queue.saveCursor(mockDatabase, 'accounts', oldCursor, null);
  await queue.saveCursor(mockDatabase, 'transactions', oldCursor, null);
  const before = await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId);
  const owner = mockOwner;
  const http = jest.fn(async (url: string | URL | Request) => {
    const path = String(url);
    let body: unknown;
    let status = 200;
    if (path.includes('/me/devices')) body = { items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null };
    else if (path.includes('/sync/delta')) {
      if (ownerChanges) mockOwner = 'different-owner';
      body = { error: { code: 'SYNC_CURSOR_EXPIRED' } }; status = 409;
    } else if (path.includes('/sync/bootstrap')) body = { data: { domains: [{ domain: new URL(path).searchParams.get('domains'), cursor: newCursor, items: [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } };
    else if (path.includes('/conflicts')) body = { data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } };
    else throw new Error('UNEXPECTED_TEST_REQUEST');
    return { ok: status === 200, status, json: async () => body } as Response;
  });
  const sync = createLiveCoreFinanceSync({ database: mockDatabase, baseUrl: 'https://inert.invalid', request: http,
    identity: async () => ({ userId: owner, token: 'boundary-token', assertCurrent: async () => { if (mockOwner !== owner) throw new Error('OWNER_CHANGED'); } }) });
  if (ownerChanges) await expect(sync.synchronize()).rejects.toThrow('OWNER_CHANGED');
  else {
    await expect(sync.synchronize()).resolves.toMatchObject({ uploaded: 0, bootstrapped: 2 });
    expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, syncStatus: 'pending' });
  }
  expect(await queue.cursor('accounts')).toBe(ownerChanges ? oldCursor : newCursor);
  expect(await queue.cursor('transactions')).toBe(oldCursor);
  expect(await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId)).toEqual(before);
  expect(http.mock.calls.some(([url]) => String(url).includes('/sync/mutations'))).toBe(false);
});

it.each([
  ['expense', 'restored'],
  ['income', 'restored'],
  ['expense', 'local'],
  ['income', 'local']
] as const)(
  'T03 %s CREATE saves atomically while %s offline without HTTP',
  async (type, restoration) => {
    useAppShellStore.setState({ session: session(restoration) });
    const saved = await service().createTransaction(input(type), operationId);
    expect(saved.value).toMatchObject({
      ...input(type),
      syncStatus: 'pending'
    });
    expect(saved.value.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(
      await mockDatabase.getAllAsync('SELECT id FROM finance_transactions')
    ).toHaveLength(1);
    const queued = await mockDatabase.getFirstAsync<{
      operation_id: string;
      resource_id: string;
      payload: string;
    }>('SELECT * FROM sync_mutation_queue');
    expect(queued).toMatchObject({
      operation_id: operationId,
      resource_id: saved.value.id
    });
    expect(JSON.parse(queued!.payload)).toMatchObject({
      kind: type,
      currency: 'SAR',
      categoryId:
        type === 'expense'
          ? serverCategoryId
          : serverCategoryId.replace(/3$/, '4'),
      source: 'manual'
    });
    expect((await service().getTransaction(saved.value.id)).title).toBe(
      input(type).title
    );
    expect(request).not.toHaveBeenCalled();
  }
);

it('replays the same durable CREATE after restart and rejects changed input for its operation', async () => {
  const saved = await service().createTransaction(input(), operationId);
  expect(
    (await service().createTransaction(input(), operationId)).value
  ).toEqual(saved.value);
  await expect(
    service().createTransaction({ ...input(), amountMinor: 200 }, operationId)
  ).rejects.toMatchObject({ code: 'conflict', metadata: { uncertain: false } });
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM sync_mutation_queue')
  ).toHaveLength(1);
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_operations')
  ).toHaveLength(1);
});

it('rolls back CREATE row and operation identity when queue storage fails, then retries without a ghost row', async () => {
  native.exec(
    "CREATE TRIGGER reject_queue BEFORE INSERT ON sync_mutation_queue BEGIN SELECT RAISE(ABORT,'disk full'); END;"
  );
  const live = service();
  await expect(
    live.createTransaction(input(), operationId)
  ).rejects.toMatchObject({
    metadata: { domainCode: 'LOCAL_PERSISTENCE_FAILED', uncertain: false }
  });
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_transactions')
  ).toHaveLength(0);
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_operations')
  ).toHaveLength(0);
  native.exec('DROP TRIGGER reject_queue');
  expect(
    (await live.createTransaction(input(), operationId)).value.syncStatus
  ).toBe('pending');
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_transactions')
  ).toHaveLength(1);
});

it('fences a CREATE when its owner changes inside the exclusive transaction', async () => {
  native.function('change_owner', () => {
    mockOwner = 'user_changed';
    return 1;
  });
  native.exec(
    'CREATE TRIGGER owner_change AFTER INSERT ON finance_transactions BEGIN SELECT change_owner(); END;'
  );
  await expect(
    service().createTransaction(input(), operationId)
  ).rejects.toBeDefined();
  expect(mockOwner).toBe('user_changed');
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_transactions')
  ).toHaveLength(0);
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM sync_mutation_queue')
  ).toHaveLength(0);
});

it('refuses a colliding queue identity rather than reporting an unqueued CREATE as saved', async () => {
  await mockDatabase.runAsync(
    "INSERT INTO sync_mutation_queue(operation_id,domain,resource_type,operation,payload,status,created_at,updated_at) VALUES(?,'transactions','transaction','update','{}','pending',1,1)",
    operationId
  );
  await expect(
    service().createTransaction(input(), operationId)
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(
    await mockDatabase.getAllAsync('SELECT * FROM finance_transactions')
  ).toHaveLength(0);
});

it('queues an edit behind its pending CREATE and freezes the canonical target before first transport', async () => {
  const live = service();
  const saved = await live.createTransaction(input(), operationId);
  const edited = await live.updateTransaction(saved.value.id, { ...input(), notes: 'edit' });
  expect(edited.value).toMatchObject({ id: saved.value.id, notes: 'edit', version: 2, syncStatus: 'pending' });
  const queue = new SyncRepository(mockDatabase);
  const child = await mockDatabase.getFirstAsync<{ operation_id: string; payload: string }>("SELECT * FROM sync_mutation_queue WHERE operation='update'");
  expect((await queue.ready()).map(row => row.operationId)).toEqual([operationId]);
  const serverId = '31000000-0000-4000-8000-000000000001';
  const envelopes: unknown[] = [];
  const cursor = `cursor.${'a'.repeat(43)}`;
  const sync = {
    mutations: async (mutations: { operationId: string; resourceId: string }[]) => {
      envelopes.push(...mutations);
      return { data: { receipts: mutations.map(row => ({ operationId: row.operationId, status: 'applied', result: ledgerCreateReceipt(serverId) })) }, meta: { requestId: 'receipt' } };
    },
    bootstrap: async ([domain]: string[]) => ({ data: { domains: [{ domain, cursor, items: [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } }),
    conflicts: async () => ({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } })
  };
  await createLiveCoreFinanceSync({ database: mockDatabase, sync: sync as never, identity: async () => ({ userId: mockOwner, token: 'boundary-token', assertCurrent: async () => undefined }) }).synchronize();
  expect(envelopes).toMatchObject([
    { operationId, resourceId: saved.value.id, operation: 'create' },
    { operationId, resourceId: saved.value.id, operation: 'create' },
    { operationId: child!.operation_id, resourceId: serverId, baseVersion: 1, dependsOn: [operationId], operation: 'update' }
  ]);
  const frozen = await mockDatabase.getFirstAsync<{ resource_id: string; payload: string }>('SELECT resource_id,payload FROM sync_mutation_queue WHERE operation_id=?', child!.operation_id);
  expect(frozen).toEqual({ resource_id: serverId, payload: child!.payload });
  await queue.retry(child!.operation_id, Date.now(), 'NETWORK_UNCERTAIN');
  await queue.markSending([child!.operation_id]);
  expect(await mockDatabase.getFirstAsync('SELECT resource_id,payload FROM sync_mutation_queue WHERE operation_id=?', child!.operation_id)).toEqual(frozen);
});

function ledgerCreateReceipt(serverId: string) {
  const occurredAt = new Date(input().occurredAt).toISOString();
  return {
    transaction: {
      transaction: { id: serverId, kind: 'expense', status: 'confirmed', amountMinor: 100, currency: 'SAR', accountIds: [account.id], sourceAccountId: account.id, destinationAccountId: null, feeMinor: 0, categoryId: serverCategoryId, title: input().title, merchant: null, paymentMethod: null, note: null, occurredAt, source: 'manual', originalTransactionId: null, version: 1, deletedAt: null, undoExpiresAt: null },
      postings: [{ id: '41000000-0000-4000-8000-000000000001', accountId: account.id, amountMinor: -100, clearingState: 'confirmed', postingRole: 'source', occurredAt }],
      revisions: [], ledgerVersion: 1, requestId: 'ledger-detail'
    },
    balances: [{ accountId: account.id, currency: 'SAR', confirmedMinor: 0, pendingMinor: 0, ledgerVersion: 1, reconciledAt: occurredAt }], ledgerVersion: 1, requestId: 'ledger-create'
  };
}

it.each(['base', 'own-result'] as const)('retains a received child edit across its %s snapshot and later acknowledges that exact child', async (projection) => {
  const saved = await service().createTransaction(input(), operationId);
  await service().updateTransaction(saved.value.id, { ...input(), notes: 'Dependent edit' });
  jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
  const queue = new SyncRepository(mockDatabase);
  const child = (await mockDatabase.getAllAsync<{ operation_id: string; payload: string }>("SELECT operation_id,payload FROM sync_mutation_queue WHERE operation='update'"))[0]!;
  const serverId = '31000000-0000-4000-8000-000000000001';
  const cursor = `cursor.${'a'.repeat(43)}`;
  const parent = { ...ledgerCreateReceipt(serverId).transaction.transaction, currencyCode: 'SAR', accountId: account.id, createdAt: new Date(input().occurredAt).toISOString(), updatedAt: new Date(input().occurredAt).toISOString() };
  let childApplied = false;
  let parentBeforeLookups: unknown;
  const sentChildren: { operationId: string; resourceId: string; payload: unknown }[] = [];
  const sync = {
    mutations: async (mutations: { operationId: string; resourceId: string; payload: unknown }[]) => {
      normalizeMutationBatch({ mutations });
      if (mutations.some(row => row.operationId === child.operation_id)) {
        expect(() => normalizeMutationBatch({ mutations: mutations.filter(row => row.operationId === child.operation_id) })).toThrow('VALIDATION_FAILED');
        const stored = await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId);
        parentBeforeLookups ??= stored;
        expect(stored).toEqual(parentBeforeLookups);
        expect(mutations.find(row => row.operationId === operationId)?.resourceId).toBe(saved.value.id);
      }
      return ({ data: { receipts: mutations.map(row => {
      if (row.operationId === operationId) return { operationId, status: 'applied', result: ledgerCreateReceipt(serverId) };
      sentChildren.push(row);
      return { operationId: row.operationId, status: childApplied ? 'applied' : 'received', ...(childApplied ? { result: {} } : {}) };
    }) }, meta: { requestId: 'receipt' } }); },
    bootstrap: jest.fn(async ([domain]: string[]) => ({ data: { domains: [{ domain, cursor, items: domain === 'transactions' ? [{ ...parent, ...(childApplied || projection === 'own-result' ? { version: 2, note: 'Dependent edit' } : {}) }] : [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } })),
    delta: async (domain: string) => ({ data: { domain, changes: domain === 'transactions' ? [{ resourceId: serverId, resourceType: 'transaction', operation: 'upsert', version: 2, snapshot: { ...parent, version: 2, note: 'Dependent edit' }, deletedAt: null }] : [], nextCursor: `later.${'b'.repeat(43)}`, hasMore: false }, meta: { requestId: 'delta' } }),
    acknowledge: async () => ({}),
    conflicts: async () => ({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } })
  };
  const runtime = () => createLiveCoreFinanceSync({ database: mockDatabase, sync: sync as never, identity: async () => ({ userId: mockOwner, token: 'boundary-token', assertCurrent: async () => undefined }) });
  jest.useFakeTimers();
  try {
    const first = runtime().synchronize();
    await jest.runAllTimersAsync();
    await first;
    expect(sentChildren).toHaveLength(4);
    expect(await mockDatabase.getFirstAsync('SELECT status,payload FROM sync_mutation_queue WHERE operation_id=?', child.operation_id)).toEqual({ status: 'pending', payload: child.payload });
    expect(await mockDatabase.getAllAsync('SELECT * FROM finance_sync_conflicts')).toEqual([]);
    expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, notes: 'Dependent edit', syncStatus: 'pending' });
    expect(sync.bootstrap.mock.calls.some(([domains]) => domains[0] === 'transactions')).toBe(false);
    if (projection === 'own-result') {
      await jest.advanceTimersByTimeAsync(1000);
      const receiptStillPending = runtime().synchronize();
      await jest.runAllTimersAsync();
      await receiptStillPending;
      expect(await mockDatabase.getFirstAsync('SELECT status,payload FROM sync_mutation_queue WHERE operation_id=?', child.operation_id)).toEqual({ status: 'pending', payload: child.payload });
      expect(await queue.cursor('transactions')).toBe(null);
      expect(await mockDatabase.getAllAsync('SELECT * FROM finance_sync_conflicts')).toEqual([]);
    }
    childApplied = true;
    await jest.advanceTimersByTimeAsync(1000);
    await runtime().synchronize();
    expect(sentChildren).toHaveLength(projection === 'own-result' ? 9 : 5);
    expect(sentChildren.every(row => row.operationId === child.operation_id && row.resourceId === serverId && JSON.stringify(row.payload) === child.payload)).toBe(true);
    expect(await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId)).toEqual(parentBeforeLookups);
    jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
    expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, notes: 'Dependent edit', syncStatus: 'synced', version: 2 });
  } finally { jest.useRealTimers(); }
});

it('rolls back an applied CREATE acknowledgement if its canonical mapping cannot be persisted', async () => {
  await service().createTransaction(input(), operationId);
  const queue = new SyncRepository(mockDatabase);
  native.exec("CREATE TRIGGER reject_mapping BEFORE INSERT ON sync_id_mappings BEGIN SELECT RAISE(ABORT,'disk full'); END;");
  await expect(queue.complete(operationId, 'applied', null, { domain: 'transactions', localId: operationId, serverId: '31000000-0000-4000-8000-000000000001' })).rejects.toThrow('disk full');
  expect(await mockDatabase.getFirstAsync('SELECT status FROM sync_mutation_queue WHERE operation_id=?', operationId)).toEqual({ status: 'pending' });
  expect(await mockDatabase.getAllAsync('SELECT * FROM sync_resource_state')).toEqual([]);
});

it.each(['received-before-alias', 'standalone-applied'] as const)('keeps one stable local CREATE row through %s and canonical projection', async phase => {
  const saved = await service().createTransaction(input(), operationId);
  jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
  const serverId = '31000000-0000-4000-8000-000000000001';
  const queue = new SyncRepository(mockDatabase);
  const cursor = `cursor.${'a'.repeat(43)}`;
  const canonical = { ...ledgerCreateReceipt(serverId).transaction.transaction, currencyCode: 'SAR', accountId: account.id, createdAt: new Date(input().occurredAt).toISOString(), updatedAt: new Date(input().occurredAt).toISOString() };
  let applied = phase === 'standalone-applied';
  const sync = {
    mutations: async () => ({ data: { receipts: [{ operationId, status: applied ? 'applied' : 'received', ...(applied ? { result: ledgerCreateReceipt(serverId) } : {}) }] }, meta: { requestId: 'receipt' } }),
    bootstrap: jest.fn(async ([domain]: string[]) => ({ data: { domains: [{ domain, cursor, items: domain === 'transactions' ? [canonical] : [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } })),
    delta: async (domain: string) => ({ data: { domain, changes: [], nextCursor: cursor, hasMore: false }, meta: { requestId: 'delta' } }),
    acknowledge: jest.fn(async (_domain: string) => ({})),
    conflicts: async () => ({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } })
  };
  const runtime = () => createLiveCoreFinanceSync({ database: mockDatabase, repository: queue, sync: sync as never, identity: async () => ({ userId: mockOwner, token: 'boundary-token', assertCurrent: async () => undefined }) });
  jest.useFakeTimers();
  try {
    const first = runtime().synchronize(); await jest.runAllTimersAsync(); await first;
    if (!applied) {
      expect(sync.bootstrap.mock.calls.some(([domains]) => domains[0] === 'transactions')).toBe(false);
      expect(await queue.cursor('transactions')).toBe(null);
      expect(await mockDatabase.getAllAsync('SELECT id FROM finance_transactions')).toEqual([{ id: saved.value.id }]);
      expect(await mockDatabase.getAllAsync('SELECT * FROM sync_id_mappings WHERE domain=?', 'transactions')).toEqual([]);
      applied = true; await jest.advanceTimersByTimeAsync(1000); await runtime().synchronize();
    }
    jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
    expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, version: 1, syncStatus: 'synced' });
    expect(await mockDatabase.getAllAsync('SELECT id FROM finance_transactions')).toEqual([{ id: saved.value.id }]);
    expect(await queue.localId('transactions', serverId)).toBe(saved.value.id);
  } finally { jest.useRealTimers(); }
});

it('defers an in-flight projection and its cursor acknowledgement when an offline Save commits during HTTP', async () => {
  const saved = await service().createTransaction(input(), operationId);
  const serverId = '31000000-0000-4000-8000-000000000001';
  const queue = new SyncRepository(mockDatabase);
  await queue.complete(operationId, 'applied', null, { domain: 'transactions', localId: saved.value.id, serverId });
  const cursor = `cursor.${'a'.repeat(43)}`;
  const next = `later.${'b'.repeat(43)}`;
  const canonical = { ...ledgerCreateReceipt(serverId).transaction.transaction, currencyCode: 'SAR', accountId: account.id, createdAt: new Date(input().occurredAt).toISOString(), updatedAt: new Date(input().occurredAt).toISOString() };
  const adapter = new CoreFinanceSyncAdapter(mockDatabase, queue);
  await adapter.applyBootstrap('transactions', [canonical], cursor, false);
  const sync = {
    bootstrap: async ([domain]: string[]) => ({ data: { domains: [{ domain, cursor, items: [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } }),
    delta: async (domain: string) => {
      if (domain === 'transactions') await service().updateTransaction(saved.value.id, { ...input(), notes: 'Saved during HTTP' });
      return { data: { domain, changes: domain === 'transactions' ? [{ resourceId: serverId, resourceType: 'transaction', operation: 'upsert', version: 2, snapshot: { ...canonical, version: 2, note: 'Remote update' }, deletedAt: null }] : [], nextCursor: next, hasMore: false }, meta: { requestId: 'delta' } };
    },
    acknowledge: jest.fn(async (_domain: string) => ({})),
    conflicts: async () => ({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } })
  };
  await createLiveCoreFinanceSync({ database: mockDatabase, repository: queue, sync: sync as never, identity: async () => ({ userId: mockOwner, token: 'boundary-token', assertCurrent: async () => undefined }) }).synchronize();
  expect(await queue.cursor('transactions')).toBe(cursor);
  expect(sync.acknowledge.mock.calls.some(([domain]) => domain === 'transactions')).toBe(false);
  expect(await service().getTransaction(saved.value.id)).toMatchObject({ notes: 'Saved during HTTP', syncStatus: 'pending' });
  expect(await mockDatabase.getAllAsync('SELECT * FROM finance_sync_conflicts')).toEqual([]);
});

it('edits an applied local-origin row after restart and protects it while its canonical target is pending', async () => {
  const saved = await service().createTransaction(input(), operationId);
  const serverId = '31000000-0000-4000-8000-000000000001';
  const queue = new SyncRepository(mockDatabase);
  await queue.complete(operationId, 'applied', null, { domain: 'transactions', localId: saved.value.id, serverId });
  const snapshot = { ...ledgerCreateReceipt(serverId).transaction.transaction, currencyCode: 'SAR', accountId: account.id, createdAt: new Date(input().occurredAt).toISOString(), updatedAt: new Date(input().occurredAt).toISOString() };
  const adapter = new CoreFinanceSyncAdapter(mockDatabase, queue);
  await adapter.applyBootstrap('transactions', [snapshot], 'cursor', false);
  expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, syncStatus: 'synced', version: 1 });
  const edited = await service().updateTransaction(saved.value.id, { ...input(), notes: 'After apply' });
  expect(edited.value).toMatchObject({ id: saved.value.id, version: 2, notes: 'After apply', syncStatus: 'pending' });
  const child = (await queue.ready())[0]!;
  await queue.markSending([child.operationId]);
  await adapter.applyDelta('transactions', [{ resourceId: serverId, operation: 'upsert', version: 2, snapshot: { ...snapshot, version: 2, note: 'Other device' }, deletedAt: null }], 'cursor2', null);
  expect(await service().getTransaction(saved.value.id)).toMatchObject({ id: saved.value.id, notes: 'After apply' });
  expect(await mockDatabase.getFirstAsync('SELECT status FROM sync_mutation_queue WHERE operation_id=?', child.operationId)).toEqual({ status: 'sending' });
  await queue.complete(child.operationId, 'conflict', 'SYNC_CONFLICT');
  await adapter.applyDelta('transactions', [{ resourceId: serverId, operation: 'upsert', version: 2, snapshot: { ...snapshot, version: 2, note: 'Other device' }, deletedAt: null }], 'cursor2', null);
  expect(await mockDatabase.getFirstAsync('SELECT status FROM sync_mutation_queue WHERE operation_id=?', child.operationId)).toEqual({ status: 'conflict' });
});

it('never changes a target already submitted under a different envelope', async () => {
  await service().createTransaction(input(), operationId);
  const queue = new SyncRepository(mockDatabase);
  await queue.complete(operationId, 'applied', null, { domain: 'transactions', localId: operationId, serverId: '31000000-0000-4000-8000-000000000001' });
  await service().updateTransaction(operationId, { ...input(), notes: 'Frozen target' });
  const child = (await queue.ready())[0]!;
  await mockDatabase.runAsync('UPDATE sync_mutation_queue SET attempt_count=1 WHERE operation_id=?', child.operationId);
  await expect(queue.markSending([child.operationId])).rejects.toThrow('SYNC_SUBMITTED_TARGET_IMMUTABLE');
  expect(await mockDatabase.getFirstAsync('SELECT resource_id,attempt_count FROM sync_mutation_queue WHERE operation_id=?', child.operationId)).toEqual({ resource_id: operationId, attempt_count: 1 });
});

it('bounds total submitted roots and immutable applied ancestors to100 and leaves the remaining roots pending', async () => {
  await service().createTransaction(input(), operationId);
  const queue = new SyncRepository(mockDatabase);
  await queue.complete(operationId, 'applied', null);
  const parent = await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId);
  for (let index = 0; index < 100; index += 1) await queue.enqueue({ operationId: jest.requireActual('node:crypto').randomUUID(), domain: 'transactions', resourceType: 'transaction', schemaVersion: 1, dependsOn: [operationId], operation: 'update', resourceId: operationId, baseVersion: 1, payload: { note: String(index) } });
  const ready = await queue.ready();
  const batch = await queue.submissionBatch(ready);
  expect(batch).toHaveLength(100);
  expect(batch[0]?.operationId).toBe(operationId);
  expect(new Set(batch.map(row => row.operationId)).size).toBe(100);
  expect(ready.filter(row => !batch.some(included => included.operationId === row.operationId))).toHaveLength(1);
  expect(await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId)).toEqual(parent);
  expect(await queue.ready()).toHaveLength(100);
});

it.each(['missing', 'cycle', 'not-applied', 'oversize'] as const)('fails closed on %s dependency ancestry without mutating stored envelopes', async problem => {
  await service().createTransaction(input(), operationId);
  const queue = new SyncRepository(mockDatabase);
  const root = (await queue.ready())[0]!;
  const before = await mockDatabase.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', operationId);
  if (problem === 'missing') await expect(queue.submissionBatch([{ ...root, dependsOn: ['missing-operation'] }])).rejects.toThrow('SYNC_DEPENDENCY_MISSING');
  else if (problem === 'not-applied') await expect(queue.submissionBatch([{ ...root, operationId: 'child', dependsOn: [operationId] }])).rejects.toThrow('SYNC_DEPENDENCY_NOT_APPLIED');
  else {
    await queue.complete(operationId, 'applied', null);
    if (problem === 'cycle') {
      await mockDatabase.runAsync('UPDATE sync_mutation_queue SET depends_on=? WHERE operation_id=?', JSON.stringify([operationId]), operationId);
      await expect(queue.submissionBatch([{ ...root, operationId: 'child', dependsOn: [operationId] }])).rejects.toThrow('SYNC_DEPENDENCY_CYCLE');
    } else {
      let dependency = operationId;
      for (let index = 0; index < 101; index += 1) {
        const id = `synthetic-ancestor-${String(index)}`;
        await queue.enqueue({ ...root, operationId: id, dependsOn: [dependency] });
        await queue.complete(id, 'applied', null);
        dependency = id;
      }
      const reads = jest.spyOn(mockDatabase, 'getFirstAsync');
      reads.mockClear();
      await expect(queue.submissionBatch([{ ...root, operationId: 'child', dependsOn: [dependency] }])).rejects.toThrow('SYNC_DEPENDENCY_LIMIT');
      expect(reads).toHaveBeenCalledTimes(99);
      reads.mockRestore();
    }
  }
  const after = await mockDatabase.getFirstAsync<{ payload: string; resource_id: string }>('SELECT payload,resource_id FROM sync_mutation_queue WHERE operation_id=?', operationId);
  expect(after).toMatchObject({ payload: (before as { payload: string }).payload, resource_id: root.resourceId });
});


it('discovers only active owner budget drafts in a bounded deterministic list', async () => {
  for (let index = 0; index < 68; index++) {
    const draft = {
      id: `budget-draft-${index}`,
      kind: 'budget',
      entityId: `budget-${index}`,
      payload: { periodKey: '2026-13' },
      status: 'editing',
      updatedAt: index
    };
    await mockDatabase.runAsync(
      'INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES(?,?,?,?,?)',
      draft.id,
      JSON.stringify(draft),
      draft.kind,
      draft.status,
      draft.updatedAt
    );
  }
  await mockDatabase.runAsync(
    "INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES('saved','{}','budget','saved',100)"
  );
  await mockDatabase.runAsync(
    "INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES('goal','{}','goal','editing',101)"
  );
  const owner = {
    userId: 'user_offline',
    assertCurrent: async () => undefined
  };
  const planning = createLiveFinancialPlanningService({
    baseUrl: 'https://inert.invalid',
    request,
    persistent: true
  });
  const drafts = await planning.listDrafts('budget');
  expect(request).not.toHaveBeenCalled();
  expect(drafts).toHaveLength(64);
  expect(drafts[0]?.id).toBe('budget-draft-67');
  expect(drafts[63]?.id).toBe('budget-draft-4');
  await expect(
    listPlanningDrafts({ ...owner, userId: 'other-owner' }, 'budget')
  ).rejects.toThrow('stale database owner');
});
