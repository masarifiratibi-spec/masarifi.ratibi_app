import type { Account } from '@/domain/core-finance';
import type {
  TrackingImportSession,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import { permissionState } from './mocks/tracking-permission-service';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { createAutomaticTrackingCoordinator } from './automatic-tracking-coordinator';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import { defaultSnapshot } from '@masarifi/transaction-parser';

it('applies a persisted keyword change to cached and native policy even if refresh loses network', async () => {
  const configured = jest.fn(async () => undefined);
  const runtime = setup({ configureBackground: configured });
  await runtime.queue.saveRules('owner-1', {
    snapshot: defaultSnapshot,
    keywords: [],
    senders: []
  });
  const rules = [
    {
      id: 'purchase-override',
      origin: 'default' as const,
      group: 'expense' as const,
      language: 'en' as const,
      value: 'purchase',
      normalizedValue: 'purchase',
      enabled: false
    }
  ];
  runtime.tracking.getStatus.mockRejectedValueOnce(new Error('offline'));
  await expect(
    runtime.coordinator.updateKeywordConfiguration(rules)
  ).rejects.toThrow('tracking_configuration_refresh_failed');
  expect((await runtime.queue.load('owner-1')).rules.keywords).toEqual(rules);
  expect(configured).toHaveBeenCalledWith(
    'owner-1',
    expect.objectContaining({ keywords: rules }),
    expect.any(String),
    expect.any(Number)
  );
});

let mockDatabase: StatefulSqlite;
jest.mock('@/storage/database', () => ({
  openDatabase: jest.fn(async () => mockDatabase),
  runExclusiveDatabaseTransaction: jest.fn(
    async (
      db: StatefulSqlite,
      operation: (tx: StatefulSqlite) => Promise<void>
    ) => db.withExclusiveTransactionAsync(operation)
  )
}));
beforeEach(() => {
  mockDatabase = new StatefulSqlite(['sms_import_queue']);
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
    removeItem: async (key: string) => void values.delete(key)
  };
}

const ownerAccount: Account = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Primary',
  type: 'bank',
  currencyCode: 'SAR',
  openingBalanceMinor: 0,
  institution: 'Bank',
  lastFour: '4242',
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  monthlyInterestRateBasisPoints: null,
  minimumPaymentMinor: null,
  automaticTrackingEnabled: true,
  isDefault: true,
  iconKey: null,
  colorKey: null,
  notes: null,
  status: 'active',
  createdAt: 1,
  updatedAt: 1
};

const status = (
  patch: Partial<TrackingStatusSnapshot> = {}
): TrackingStatusSnapshot => ({
  platform: 'android',
  mode: 'automatic_clear',
  permissionStatus: null,
  serviceState: 'healthy',
  lastDetectedAt: null,
  lastSuccessfulTransactionId: null,
  detectedThisMonth: 0,
  reviewCount: 0,
  activeKeywordCount: 0,
  activeSenderCount: 0,
  lastUpdatedAt: 1,
  ...patch
});

const session = (
  state: TrackingImportSession['status']
): TrackingImportSession => ({
  id: 'session-1',
  status: state,
  itemCount: 1,
  acceptedCount: state === 'complete' ? 1 : 0,
  rejectedCount: state === 'failed' ? 1 : 0,
  completedAt: ['complete', 'failed', 'cancelled'].includes(state) ? 2 : null,
  updatedAt: 2
});

function setup(overrides: Record<string, unknown> = {}) {
  let online = true;
  const queue = new SmsImportQueue(memoryStorage());
  const tracking = {
    getStatus: jest.fn().mockResolvedValue(status()),
    listKeywordRules: jest.fn().mockResolvedValue([]),
    listSenderRules: jest.fn().mockResolvedValue([]),
    submitImport: jest.fn().mockResolvedValue(session('processing')),
    getImportSession: jest.fn().mockResolvedValue(session('processing')),
    listImportItemIds: jest.fn().mockResolvedValue(['item-1']),
    listReviewItems: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0
    }),
    listDuplicates: jest.fn().mockResolvedValue([])
  };
  const inbox = {
    available: true,
    readRecent: jest
      .fn()
      .mockResolvedValue([
        { id: '1', sender: 'BANK', body: 'Paid 12 SAR', receivedAt: 100 }
      ]),
    isNetworkAvailable: jest.fn(async () => online)
  };
  const prepare = jest.fn().mockResolvedValue({
    events: [
      {
        sourceItemKey: 'sha256:one',
        amountMinor: -1200,
        currency: 'SAR',
        kind: 'expense',
        accountId: ownerAccount.id,
        receivedAt: '2026-09-12T10:00:00.000Z'
      }
    ],
    skippedFingerprints: [],
    newestReceivedAt: 100,
    accountRequiredCount: 0,
    consumedSourceKeys: []
  });
  const bankNotifications = {
    getAccessState: jest.fn().mockResolvedValue('denied'),
    openSettings: jest.fn(),
    readRecent: jest.fn().mockResolvedValue([]),
    acknowledge: jest.fn().mockResolvedValue(undefined)
  };
  const dependencies = {
    isLive: () => true,
    session: () => ({ status: 'authenticated' as const, userId: 'owner-1' }),
    offlineMode: () => 'automatic_clear' as const,
    tracking,
    permission: {
      getState: jest.fn().mockResolvedValue(permissionState('granted'))
    },
    inbox,
    bankNotifications,
    sources: {
      load: jest.fn().mockResolvedValue({
        smsEnabled: true,
        notificationEnabled: true
      })
    },
    listAccounts: jest.fn().mockResolvedValue([ownerAccount]),
    listCachedAccounts: jest.fn().mockResolvedValue([ownerAccount]),
    queue,
    prepare,
    now: () => 1_757_678_500_000,
    ...overrides
  };
  return {
    coordinator: createAutomaticTrackingCoordinator(dependencies as never),
    dependencies,
    tracking,
    inbox,
    bankNotifications,
    prepare,
    queue,
    setOnline(value: boolean) {
      online = value;
    }
  };
}

describe('automatic tracking coordinator', () => {
  it('replaces obsolete cached safety rules online and resumes with the original intake checkpoint', async () => {
    const context = setup();
    await mockDatabase.runAsync('INSERT INTO sms_import_queue (id, payload) VALUES (?, ?)', 'singleton', JSON.stringify({version:1,ownerId:'owner-1',pending:[],cursor:42,cursorId:'old-sms',fingerprints:['seen'],mode:'review_all',rules:{keywords:[],senders:[],snapshot:{...defaultSnapshot,rules:[]}}}));
    Object.assign(context.tracking, {getRuleConfiguration:jest.fn().mockResolvedValue({keywords:[],senders:[],snapshot:defaultSnapshot})});
    context.inbox.readRecent.mockResolvedValue([]);
    expect(await context.coordinator.sync()).toMatchObject({status:'idle',errorCode:null});
    const refreshed = await context.queue.load('owner-1');
    expect(refreshed).toMatchObject({pending:[],cursor:42,cursorId:'old-sms',fingerprints:['seen'],rules:{snapshot:defaultSnapshot}});
    expect(refreshed.rules.requiresRefresh).toBeUndefined();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('holds stale safety configuration offline without reading either capture channel', async () => {
    const configureBackground = jest.fn(async () => undefined);
    const context = setup({configureBackground});
    await mockDatabase.runAsync('INSERT INTO sms_import_queue (id, payload) VALUES (?, ?)', 'singleton', JSON.stringify({version:1,ownerId:'owner-1',pending:[],cursor:42,fingerprints:['seen'],mode:'review_all',rules:{keywords:[],senders:[],snapshot:{...defaultSnapshot,rules:[]}}}));
    context.setOnline(false);
    expect(await context.coordinator.sync()).toMatchObject({status:'error',errorCode:'sync_failed'});
    expect(context.inbox.readRecent).not.toHaveBeenCalled();
    expect(context.bankNotifications.readRecent).not.toHaveBeenCalled();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect(await context.queue.load('owner-1')).toMatchObject({cursor:42,fingerprints:['seen'],pending:[],rules:{requiresRefresh:true}});
  });

  it('does not read SMS when only notification tracking is enabled', async () => {
    const context = setup({
      sources: {
        load: jest.fn().mockResolvedValue({
          smsEnabled: false,
          notificationEnabled: true
        })
      }
    });

    await context.coordinator.sync();

    expect(context.inbox.readRecent).not.toHaveBeenCalled();
  });

  it('does not read notifications when only SMS tracking is enabled', async () => {
    const context = setup({
      sources: {
        load: jest.fn().mockResolvedValue({
          smsEnabled: true,
          notificationEnabled: false
        })
      }
    });
    context.bankNotifications.getAccessState.mockResolvedValue('granted');

    await context.coordinator.sync();

    expect(context.bankNotifications.readRecent).not.toHaveBeenCalled();
    expect(context.inbox.readRecent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not live', { isLive: () => false }],
    ['signed out', { session: () => ({ status: 'signed_out', userId: null }) }],
    [
      'paused',
      {
        tracking: {
          ...setup().tracking,
          getStatus: jest.fn().mockResolvedValue(status({ mode: 'paused' }))
        }
      }
    ],
    [
      'unavailable',
      {
        tracking: {
          ...setup().tracking,
          getStatus: jest
            .fn()
            .mockResolvedValue(status({ serviceState: 'unavailable' }))
        }
      }
    ],
    [
      'permission denied',
      {
        permission: {
          getState: jest.fn().mockResolvedValue(permissionState('denied'))
        }
      }
    ]
  ])('does not scan when %s', async (_label, override) => {
    const context = setup(override);

    await context.coordinator.sync();

    expect(context.inbox.readRecent).not.toHaveBeenCalled();
  });

  it('queues minimized events offline without making tracking HTTP mutations', async () => {
    const context = setup();
    context.setOnline(false);

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'queued'
    });
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    await expect(context.queue.load('owner-1')).resolves.toMatchObject({
      pending: [
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/^sms:/)
        })
      ]
    });
  });

  it('queues bank notifications when SMS permission is denied and acknowledges after persistence', async () => {
    const context = setup({
      permission: {
        getState: jest.fn().mockResolvedValue(permissionState('denied'))
      }
    });
    context.bankNotifications.getAccessState.mockResolvedValue('granted');
    context.bankNotifications.readRecent.mockResolvedValue([
      {
        key: 'notification-1',
        packageName: 'com.bank',
        title: 'Bank',
        text: 'Paid 12 SAR',
        postedAt: 100
      }
    ]);
    context.prepare.mockResolvedValue({
      events: [
        {
          sourceItemKey: 'sha256:notification-one',
          amountMinor: -1200,
          currency: 'SAR',
          kind: 'expense',
          accountId: ownerAccount.id,
          receivedAt: '2026-09-12T10:00:00.000Z'
        }
      ],
      skippedFingerprints: [],
      newestReceivedAt: 100,
      accountRequiredCount: 0,
      consumedSourceKeys: ['notification-1']
    });
    const enqueue = jest.spyOn(context.queue, 'enqueue');

    await context.coordinator.sync();

    const queued = await context.queue.load('owner-1');
    expect(queued.pending[0]?.submission).toMatchObject({
      sourceType: 'provider',
      sourceChannel: 'android_notification'
    });
    expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      context.bankNotifications.acknowledge.mock.invocationCallOrder[0]
    );
    expect(context.bankNotifications.acknowledge).toHaveBeenCalledWith([
      'notification-1'
    ]);
  });

  it('acknowledges rejected bank notifications without submitting them', async () => {
    const context = setup({
      permission: {
        getState: jest.fn().mockResolvedValue(permissionState('denied'))
      }
    });
    context.bankNotifications.getAccessState.mockResolvedValue('granted');
    context.bankNotifications.readRecent.mockResolvedValue([
      {
        key: 'notification-otp',
        packageName: 'com.bank',
        title: 'Bank',
        text: 'OTP 123456',
        postedAt: 100
      }
    ]);
    context.prepare.mockResolvedValue({
      events: [],
      skippedFingerprints: ['sha256:otp'],
      newestReceivedAt: 100,
      accountRequiredCount: 0,
      consumedSourceKeys: ['notification-otp']
    });

    await context.coordinator.sync();

    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect(context.bankNotifications.acknowledge).toHaveBeenCalledWith([
      'notification-otp'
    ]);
  });

  it('reuses the persisted idempotency key when connectivity returns', async () => {
    const context = setup();
    context.setOnline(false);
    await context.coordinator.sync();
    const originalKey = (await context.queue.load('owner-1')).pending[0]
      ?.idempotencyKey;
    context.setOnline(true);

    await context.coordinator.sync();

    expect(context.tracking.submitImport).toHaveBeenCalledWith(
      expect.any(Object),
      originalKey,
      'owner-1'
    );
  });

  it('polls an already submitted session instead of resubmitting it', async () => {
    const context = setup();
    await context.queue.enqueue('owner-1', {
      idempotencyKey: 'sms:existing',
      submission: {
        schemaVersion: 1,
        sourceType: 'sms',
        sourceChannel: 'android_sms',
        events: [
          {
            sourceItemKey: 'sha256:one',
            amountMinor: -1200,
            currency: 'SAR',
            receivedAt: '2026-09-12T10:00:00Z'
          }
        ]
      },
      cursor: 100,
      fingerprints: ['sha256:one']
    });
    await context.queue.markSubmitted('owner-1', 'sms:existing', 'session-1');

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'processing'
    });
    expect(context.tracking.getImportSession).toHaveBeenCalledWith(
      'session-1',
      'owner-1'
    );
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it.each([
    ['complete', 'imported'],
    ['failed', 'error']
  ] as const)(
    'maps terminal backend state %s to %s',
    async (backend, expected) => {
      const context = setup();
      context.tracking.submitImport.mockResolvedValue(session(backend));

      await expect(context.coordinator.sync()).resolves.toMatchObject({
        status: expected
      });
      await expect(context.queue.load('owner-1')).resolves.toMatchObject({
        pending: backend === 'failed' ? expect.any(Array) : []
      });
    }
  );

  it('uses real review and duplicate IDs from items in the current session', async () => {
    const review = {
      id: 'review-1',
      detectedEventId: 'item-1',
      status: 'pending',
      reasonCodes: ['duplicate'],
      missingFields: [],
      proposedValues: {},
      selectedDuplicateResolution: null,
      selectedObligationId: null,
      resolutionErrorCode: null,
      createdAt: 1,
      resolvedAt: null,
      updatedAt: 1
    };
    const context = setup();
    context.tracking.submitImport.mockResolvedValue(session('review'));
    context.tracking.listReviewItems.mockResolvedValue({
      items: [review],
      nextCursor: null,
      total: 1
    });
    context.tracking.listDuplicates.mockResolvedValue([
      {
        id: 'duplicate-1',
        detectedEventId: 'item-1',
        existingTransactionId: 'transaction-1',
        probabilityBasisPoints: 9000,
        reasonCodes: ['same_amount'],
        resolution: null,
        status: 'pending',
        resolvedAt: null
      }
    ]);

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'duplicate',
      duplicateId: 'duplicate-1',
      reviewId: 'review-1'
    });
  });

  it('keeps a review session pending until its real review ID is visible', async () => {
    const context = setup();
    context.tracking.submitImport.mockResolvedValue(session('review'));

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'processing',
      sessionId: 'session-1'
    });
    await expect(context.queue.load('owner-1')).resolves.toMatchObject({
      pending: [expect.objectContaining({ sessionId: 'session-1' })]
    });
  });

  it('keeps ambiguous-account messages local and reports account_required', async () => {
    const context = setup();
    context.prepare.mockResolvedValue({
      events: [],
      skippedFingerprints: [],
      newestReceivedAt: 100,
      accountRequiredCount: 1
    });

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'account_required'
    });
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('does not expose dependency error messages in sync state', async () => {
    const context = setup();
    context.tracking.getStatus.mockRejectedValue(
      new Error('sensitive upstream response')
    );

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'sync_failed'
    });
  });

  it('coalesces concurrent start and resume synchronization', async () => {
    let release!: (value: []) => void;
    const pending = new Promise<[]>((resolve) => {
      release = resolve;
    });
    const context = setup();
    context.inbox.readRecent.mockReturnValue(pending);

    const first = context.coordinator.sync();
    const second = context.coordinator.sync();
    expect(second).toBe(first);
    release([]);
    await first;
    expect(context.inbox.readRecent).toHaveBeenCalledTimes(1);
  });
});

it('resync waits for the stale pass then installs current source configuration', async () => {
  let ready!: () => void;
  const entered = new Promise<void>((r) => {
    ready = r;
  });
  let resume!: () => void;
  const background = jest.fn(async () => undefined);
  const context = setup({ configureBackground: background });
  context.tracking.getStatus.mockImplementationOnce(async () => {
    ready();
    await new Promise<void>((r) => {
      resume = r;
    });
    return status();
  });
  const first = context.coordinator.sync();
  await entered;
  const second = context.coordinator.resync();
  resume();
  await Promise.all([first, second]);
  expect(background).toHaveBeenCalledTimes(2);
});
