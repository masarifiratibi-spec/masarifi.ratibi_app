import { createIosShortcutLedger } from './ios-shortcut-ledger';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import { createDefaultCategories } from '@/domain/default-categories';
import {
  transactionInputSchema,
  type Account,
  type Category,
  type Transaction,
  type TransactionInput
} from '@/domain/core-finance';
import type { IosShortcutResult } from './ios-shortcut-import';

let mockDatabase: StatefulSqlite;
jest.mock('@/storage/database', () => ({
  openDatabase: async () => mockDatabase,
  runExclusiveDatabaseTransaction: async (
    db: StatefulSqlite,
    op: (tx: StatefulSqlite) => Promise<void>
  ) => db.withExclusiveTransactionAsync(op)
}));
const accountId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const candidate = {
  sourceItemKey: 'ios-shortcut:' + 'a'.repeat(64),
  amountMinor: 1234,
  currency: 'SAR',
  kind: 'expense' as const,
  receivedAt: '2026-11-16T12:00:00.000Z',
  occurredAt: '2026-11-16T12:00:00.000Z'
};
beforeEach(() => {
  mockDatabase = new StatefulSqlite(['sms_import_queue']);
});
function setup() {
  let enabled = true,
    current = true,
    online = true,
    cutoff = 0;
  const calls: { input: TransactionInput; key: string }[] = [];
  const saved = new Map<string, Transaction>();
  const queue = new SmsImportQueue({
    getItem: async () => null,
    removeItem: async () => {}
  });
  const scope = {
    ownerId: 'qa-owner',
    enrollmentId: 'qa-enrollment',
    sessionBinding: 'b'.repeat(64),
    assertCurrent: async () => {
      if (!current) throw Error('owner_changed');
    },
    captureEnabled: async () => enabled
  };
  const ports = {
    queue,
    accounts: async () => [
      {
        id: accountId,
        type: 'bank',
        currencyCode: 'SAR',
        status: 'active',
        automaticTrackingEnabled: true
      } as Account
    ],
    categories: async () => [
      { id: categoryId, status: 'active', financialType: 'expense' } as Category
    ],
    resetState: async () => ({ cutoff, changed: false }),
    legacy: jest.fn(async (): Promise<IosShortcutResult> => ({
      status: 'processing',
      transactionId: null,
      sessionId: 'legacy-session'
    })),
    title: () => 'Captured transaction',
    submit: jest.fn(async (input: TransactionInput, key: string) => {
      calls.push({ input, key });
      if (!online) throw Error('offline');
      const normalized = transactionInputSchema.parse(input);
      if (!saved.has(key))
        saved.set(key, {
          ...normalized,
          id: key,
          source: 'platform_assisted',
          status: 'posted',
          reviewStatus: 'none',
          syncStatus: 'synced',
          version: 1,
          createdAt: 1,
          updatedAt: 1
        } as Transaction);
      return { value: saved.get(key)!, affectedScopes: ['transactions.list'] };
    })
  };
  return {
    ports,
    scope,
    queue,
    calls,
    saved,
    service: createIosShortcutLedger(ports),
    disable: () => {
      enabled = false;
    },
    changeOwner: () => {
      current = false;
    },
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
    reset: () => {
      cutoff = Date.parse(candidate.receivedAt);
    }
  };
}

it('uses explicit ordinary ledger confirmation without requiring global automatic tracking', async () => {
  const x = setup();
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).resolves.toMatchObject({ status: 'saved' });
  expect(x.calls).toHaveLength(1);
  expect(x.calls[0]!.input).toMatchObject({
    type: 'expense',
    amountMinor: 1234,
    currencyCode: 'SAR',
    accountId,
    categoryId
  });
  expect(x.calls[0]!.key).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  );
  expect(x.ports.legacy).not.toHaveBeenCalled();
});
it('does not create another financial command for an exact replay', async () => {
  const x = setup();
  await x.service.confirm(x.scope, candidate, accountId, categoryId);
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).resolves.toMatchObject({ status: 'duplicate' });
  expect(x.calls).toHaveLength(1);
});

it('queues and submits a real default category local key without changing the shared UUID import schema', async () => {
  const x = setup();
  const category = createDefaultCategories().find(
    (row) => row.financialType === 'expense'
  )!;
  expect(category.id).not.toMatch(/^[a-f0-9-]{36}$/);
  x.ports.categories = async () => [category];
  x.offline();
  await expect(
    x.service.confirm(x.scope, candidate, accountId, category.id)
  ).resolves.toMatchObject({ status: 'queued' });
  const queued = (await x.queue.load(x.scope.ownerId)).pending[0]!.submission
    .events[0]!;
  expect(queued.categoryId).toBeUndefined();
  expect(queued.metadata?.iosCategoryId).toBe(category.id);
  x.online();
  await expect(x.service.resume(x.scope)).resolves.toMatchObject({
    status: 'saved'
  });
  expect(x.calls.at(-1)!.input.categoryId).toBe(category.id);
});

it('ordinary explicit confirmation preserves an account automatic-tracking opt-out', async () => {
  const x = setup();
  const accounts = await x.ports.accounts();
  accounts[0]!.automaticTrackingEnabled = false;
  x.ports.accounts = async () => accounts;
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).resolves.toMatchObject({ status: 'saved' });
  expect(accounts[0]!.automaticTrackingEnabled).toBe(false);
});

it('never persists optional source text or sender fields in the financial queue', async () => {
  const x = setup();
  x.offline();
  await x.service.confirm(
    x.scope,
    { ...candidate, body: 'PRIVATE QA SOURCE', sender: 'PRIVATE QA SENDER' },
    accountId,
    categoryId
  );
  const stored = JSON.stringify(await x.queue.load(x.scope.ownerId));
  expect(stored).not.toContain('PRIVATE QA SOURCE');
  expect(stored).not.toContain('PRIVATE QA SENDER');
});
it('keeps two distinct capture identities even when their amounts and times match', async () => {
  const x = setup();
  await x.service.confirm(x.scope, candidate, accountId, categoryId);
  await x.service.confirm(
    x.scope,
    { ...candidate, sourceItemKey: 'ios-shortcut:' + 'c'.repeat(64) },
    accountId,
    categoryId
  );
  expect(x.calls).toHaveLength(2);
  expect(x.calls[0]!.key).not.toBe(x.calls[1]!.key);
  expect(x.saved.size).toBe(2);
});
it('persists minimized immutable financial input and retries the same UUID after a restart', async () => {
  const x = setup();
  x.offline();
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).resolves.toMatchObject({ status: 'queued' });
  const retained = JSON.stringify(await x.queue.load(x.scope.ownerId));
  expect(retained).not.toContain('Purchase SAR');
  expect(retained).not.toContain('token');
  x.online();
  await expect(
    createIosShortcutLedger(x.ports).resume(x.scope)
  ).resolves.toMatchObject({ status: 'saved' });
  expect(x.calls[0]!.key).toBe(x.calls[1]!.key);
  expect(x.calls[0]!.input).toEqual(x.calls[1]!.input);
  expect(x.saved.size).toBe(1);
});
it('quarantines a legacy import identity instead of reposting it through another idempotency scope', async () => {
  const x = setup();
  await x.queue.enqueue(x.scope.ownerId, {
    idempotencyKey: candidate.sourceItemKey,
    submission: {
      schemaVersion: 1,
      sourceType: 'manual',
      sourceChannel: 'ios_shortcut',
      events: [{ ...candidate, accountId }]
    },
    cursor: Date.parse(candidate.receivedAt),
    fingerprints: [candidate.sourceItemKey]
  });
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).resolves.toMatchObject({ status: 'processing' });
  expect(x.ports.legacy).toHaveBeenCalled();
  expect(x.calls).toHaveLength(0);
});
it('requires an eligible active category of the parsed financial direction', async () => {
  const x = setup();
  x.ports.categories = async () => [
    { id: categoryId, status: 'active', financialType: 'income' } as Category
  ];
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).rejects.toThrow();
  expect(x.calls).toHaveLength(0);
});
it('cannot dispatch queued financial work after consent is disabled', async () => {
  const x = setup();
  x.offline();
  await x.service.confirm(x.scope, candidate, accountId, categoryId);
  x.online();
  x.disable();
  await expect(x.service.resume(x.scope)).resolves.toMatchObject({
    status: 'disabled'
  });
  expect(x.calls).toHaveLength(1);
});
it('rejects an owner change and a capture preceding the financial reset', async () => {
  const x = setup();
  x.changeOwner();
  await expect(
    x.service.confirm(x.scope, candidate, accountId, categoryId)
  ).rejects.toThrow();
  const y = setup();
  y.reset();
  await expect(
    y.service.confirm(y.scope, candidate, accountId, categoryId)
  ).rejects.toThrow();
  expect(x.calls).toHaveLength(0);
  expect(y.calls).toHaveLength(0);
});
it('does not claim a local pending transaction is a synchronized server save', async () => {
  const x = setup();
  const submit = x.ports.submit;
  x.ports.submit = jest.fn(async (...args: Parameters<typeof submit>) => {
    const receipt = await submit(...args);
    return {
      ...receipt,
      value: { ...receipt.value, syncStatus: 'pending' as const }
    };
  });
  const result = await x.service.confirm(
    x.scope,
    candidate,
    accountId,
    categoryId
  );
  expect(result.status).not.toBe('saved');
  expect((await x.queue.load(x.scope.ownerId)).pending).toHaveLength(1);
});
