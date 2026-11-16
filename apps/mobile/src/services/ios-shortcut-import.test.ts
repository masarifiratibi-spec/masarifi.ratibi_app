import { createIosShortcutImport } from './ios-shortcut-import';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import type { Account } from '@/domain/core-finance';
import type {
  TrackingImportSession,
  TrackingImportSubmission
} from '@/domain/automatic-tracking';

let mockDatabase: StatefulSqlite;
jest.mock('@/storage/database', () => ({
  openDatabase: async () => mockDatabase,
  runExclusiveDatabaseTransaction: async (
    db: StatefulSqlite,
    op: (tx: StatefulSqlite) => Promise<void>
  ) => db.withExclusiveTransactionAsync(op)
}));
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
  let current = true,
    online = true,
    enabled = true,
    cutoff = 0,
    accepted = 0;
  const saved = new Map<string, TrackingImportSession>();
  const submitted: TrackingImportSubmission[] = [];
  const queue = new SmsImportQueue({
    getItem: async () => null,
    removeItem: async () => {}
  });
  const account = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'active',
    currencyCode: 'SAR',
    type: 'bank',
    automaticTrackingEnabled: true
  } as Account;
  const scope = {
    ownerId: 'qa-owner',
    enrollmentId: 'enrollment-qa',
    sessionBinding: 'b'.repeat(64),
    assertCurrent: async () => {
      if (!current) throw Error('ios_shortcut_owner_changed');
    },
    captureEnabled: async () => enabled
  };
  const ports = {
    queue,
    async resetState() {
      if (!online) throw Error('offline');
      return { cutoff, changed: false };
    },
    async accounts() {
      return [account];
    },
    async status() {
      return { mode: 'automatic_clear' as string };
    },
    async submit(input: TrackingImportSubmission, key: string, owner: string) {
      if (!online) throw Error('offline');
      if (owner !== 'qa-owner') throw Error('owner');
      submitted.push(input);
      if (!saved.has(key)) {
        accepted++;
        saved.set(key, {
          id:
            accepted === 1
              ? '22222222-2222-4222-8222-222222222222'
              : '33333333-3333-4333-8333-333333333333',
          status: 'complete',
          acceptedCount: 1,
          rejectedCount: 0,
          itemCount: 1,
          updatedAt: 1,
          completedAt: 1
        });
      }
      return saved.get(key)!;
    },
    async receipt(id: string) {
      return [...saved.values()].find((row) => row.id === id)!;
    },
    async outcomes(id: string) {
      return [
        {
          itemId: id,
          status: 'accepted',
          transactionId: 'transaction-qa' as string | null,
          notificationId: null
        }
      ];
    }
  };
  return {
    queue,
    scope,
    ports,
    submitted,
    service: createIosShortcutImport(ports),
    count: () => accepted,
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
    changeOwner: () => {
      current = false;
    },
    disable: () => {
      enabled = false;
    },
    reset: () => {
      cutoff = Date.parse(candidate.receivedAt);
    }
  };
}
test('approved synthetic financial capture queues no raw text, obtains a receipt and replays once', async () => {
  const ctx = setup();
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'saved', transactionId: 'transaction-qa' });
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'duplicate' });
  expect(ctx.count()).toBe(1);
  expect(ctx.submitted[0]).toMatchObject({
    schemaVersion: 1,
    sourceType: 'manual',
    sourceChannel: 'ios_shortcut',
    events: [
      {
        amountMinor: 1234,
        currency: 'SAR',
        kind: 'expense',
        accountId: '11111111-1111-4111-8111-111111111111'
      }
    ]
  });
  expect(ctx.submitted[0].events[0].body).toBeUndefined();
  expect(ctx.submitted[0].events[0].sender).toBeUndefined();
});
test('offline confirmation survives coordinator restart and is submitted once on retry', async () => {
  const ctx = setup();
  ctx.offline();
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'queued' });
  ctx.online();
  expect(
    await createIosShortcutImport(ctx.ports).resume(ctx.scope)
  ).toMatchObject({ status: 'saved' });
  await ctx.service.resume(ctx.scope);
  expect(ctx.count()).toBe(1);
});
test.each(['owner', 'disabled', 'reset', 'foreign-account'])(
  'rejects %s without a financial effect',
  async (reason) => {
    const ctx = setup();
    if (reason === 'owner') ctx.changeOwner();
    if (reason === 'disabled') ctx.disable();
    if (reason === 'reset') ctx.reset();
    await expect(
      ctx.service.confirm(
        ctx.scope,
        candidate,
        reason === 'foreign-account'
          ? 'foreign'
          : '11111111-1111-4111-8111-111111111111'
      )
    ).rejects.toThrow();
    expect(ctx.count()).toBe(0);
  }
);
test('an unsubmitted offline capture is not sent after disabling or changing owner', async () => {
  const ctx = setup();
  ctx.offline();
  await ctx.service.confirm(
    ctx.scope,
    candidate,
    '11111111-1111-4111-8111-111111111111'
  );
  ctx.online();
  ctx.disable();
  await ctx.service.resume(ctx.scope);
  expect(ctx.count()).toBe(0);
  ctx.changeOwner();
  await expect(ctx.service.resume(ctx.scope)).rejects.toThrow();
});
test('two distinct original identities are not collapsed by the client', async () => {
  const ctx = setup();
  await ctx.service.confirm(
    ctx.scope,
    candidate,
    '11111111-1111-4111-8111-111111111111'
  );
  await ctx.service.confirm(
    ctx.scope,
    { ...candidate, sourceItemKey: 'ios-shortcut:' + 'c'.repeat(64) },
    '11111111-1111-4111-8111-111111111111'
  );
  expect(ctx.count()).toBe(2);
});
test('explicit iOS manual confirmation works while Android automatic tracking is globally paused', async () => {
  const ctx = setup();
  ctx.ports.status = async () => ({ mode: 'paused' });
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'saved', transactionId: 'transaction-qa' });
  expect(ctx.count()).toBe(1);
});
test('financial reset rejects a captured candidate even when its timestamp is after the cutoff', async () => {
  const ctx = setup();
  Object.assign(ctx.ports, {
    resetState: async () => ({
      cutoff: Date.parse(candidate.receivedAt) - 1000,
      changed: true
    })
  });
  await expect(
    ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).rejects.toThrow();
  expect(ctx.count()).toBe(0);
});
test('a reset cannot submit erased pending work from a stale in-memory queue snapshot', async () => {
  const ctx = setup();
  ctx.offline();
  await ctx.service.confirm(
    ctx.scope,
    candidate,
    '11111111-1111-4111-8111-111111111111'
  );
  ctx.online();
  Object.assign(ctx.ports, {
    resetState: async () => {
      await ctx.queue.clear(ctx.scope.ownerId);
      return { cutoff: Date.parse(candidate.receivedAt) - 1000, changed: true };
    }
  });
  await ctx.service.resume(ctx.scope);
  expect(ctx.count()).toBe(0);
});
test('a server keep-existing duplicate resolution is terminal without claiming a new save', async () => {
  const ctx = setup();
  ctx.ports.submit = async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    status: 'complete',
    acceptedCount: 0,
    rejectedCount: 0,
    itemCount: 1,
    updatedAt: 1,
    completedAt: 1
  });
  ctx.ports.outcomes = async () => [
    {
      itemId: 'reviewed',
      status: 'duplicate',
      transactionId: 'existing',
      notificationId: null
    }
  ];
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'duplicate', transactionId: null });
  expect((await ctx.queue.load(ctx.scope.ownerId)).pending).toHaveLength(0);
});
test('review and rejected receipts cannot appear as saved', async () => {
  const ctx = setup();
  ctx.ports.submit = async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    status: 'review',
    acceptedCount: 0,
    rejectedCount: 0,
    itemCount: 1,
    updatedAt: 1,
    completedAt: null
  });
  ctx.ports.outcomes = async () => [
    {
      itemId: 'review-qa',
      status: 'review',
      transactionId: null,
      notificationId: null
    }
  ];
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'review', transactionId: null });
});
test('a reviewed receipt with an accepted transaction is recognized after explicit server review', async () => {
  const ctx = setup();
  ctx.ports.submit = async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    status: 'review',
    acceptedCount: 1,
    rejectedCount: 0,
    itemCount: 1,
    updatedAt: 1,
    completedAt: null
  });
  expect(
    await ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).toMatchObject({ status: 'saved', transactionId: 'transaction-qa' });
});

test('legacy accepted item proves a save even when its aggregate counter has not reconciled', async () => {
  const ctx = setup();
  ctx.ports.submit = async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    status: 'complete',
    acceptedCount: 0,
    rejectedCount: 0,
    itemCount: 1,
    updatedAt: 1,
    completedAt: 1
  });
  await expect(
    ctx.service.confirm(
      ctx.scope,
      candidate,
      '11111111-1111-4111-8111-111111111111'
    )
  ).resolves.toMatchObject({
    status: 'saved',
    transactionId: 'transaction-qa'
  });
});

test('legacy receipt reconciliation never submits the corrected manual-ledger queue entries', async () => {
  const ctx = setup();
  await ctx.queue.enqueue(ctx.scope.ownerId, {
    idempotencyKey: candidate.sourceItemKey,
    submission: {
      schemaVersion: 1,
      sourceType: 'manual',
      sourceChannel: 'ios_shortcut',
      events: [
        {
          ...candidate,
          metadata: {
            iosLedger: 'confirmed_v1',
            iosEnrollmentId: ctx.scope.enrollmentId,
            iosSessionBinding: ctx.scope.sessionBinding
          }
        }
      ]
    },
    cursor: Date.parse(candidate.receivedAt),
    fingerprints: [candidate.sourceItemKey]
  });
  await expect(ctx.service.resume(ctx.scope)).resolves.toMatchObject({
    status: 'idle'
  });
  expect(ctx.submitted).toHaveLength(0);
});
