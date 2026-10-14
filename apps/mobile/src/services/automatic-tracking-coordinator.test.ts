import type { Account } from '@/domain/core-finance';
import type {
  TrackingImportSession,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import { permissionState } from './mocks/tracking-permission-service';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { createAutomaticTrackingCoordinator } from './automatic-tracking-coordinator';
import { prepareFinancialMessageImport } from '@/features/tracking/sms-import';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import {
  defaultSnapshot,
  discoverFinancialMessage
} from '@masarifi/transaction-parser';
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .createHash('sha256')
      .update(value)
      .digest('hex')
}));

it('retains a fee-bearing backlog in submissions within the durable import limit', async () => {
  const context = setup({ prepare: prepareFinancialMessageImport });
  context.setOnline(false);
  await context.queue.saveRules('owner-1', {
    snapshot: defaultSnapshot,
    keywords: [],
    senders: [
      { normalizedSender: 'examplebank', enabled: true, trusted: true }
    ],
    accountingPolicy: 'default_account_nominal_v1',
    rolloutMode: 'automatic'
  });
  const messages = Array.from({ length: 61 }, (_, i) => ({
    id: String(i + 1),
    sender: 'ExampleBank',
    body: 'Paid SAR50; additional fee SAR2',
    receivedAt: 100 + i
  }));
  context.inbox.readRecent.mockImplementation(
    async ({ since, limit }: { since: number; limit: number }) =>
      messages.filter((m) => m.receivedAt > since).slice(0, limit)
  );
  expect((await context.coordinator.sync()).status).toBe('queued');
  const queued = await context.queue.load('owner-1');
  expect(
    queued.pending.reduce(
      (total, item) => total + item.submission.events.length,
      0
    )
  ).toBe(122);
  expect(
    queued.pending.every((item) => item.submission.events.length <= 100)
  ).toBe(true);
  expect(queued.cursor).toBe(160);
});

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
it('keeps a removed default tombstone effective if the authoritative refresh fails and after restart', async () => {
  const configured = jest.fn(async () => undefined),
    context = setup({ configureBackground: configured });
  await context.queue.saveRules('owner-1', {
    snapshot: defaultSnapshot,
    keywords: [
      {
        id: 'default-payment',
        origin: 'default',
        group: 'expense',
        language: 'ar',
        value: 'دفع',
        enabled: true
      }
    ],
    senders: []
  });
  context.tracking.getStatus.mockRejectedValue(new Error('offline'));
  await expect(
    context.coordinator.updateKeywordConfiguration([])
  ).rejects.toThrow('tracking_configuration_refresh_failed');
  const persisted = (await context.queue.load('owner-1')).rules;
  expect(persisted.keywords).toContainEqual(
    expect.objectContaining({ value: 'دفع', enabled: false })
  );
  expect(
    discoverFinancialMessage(
      { text: 'تم دفع 50 ريال' },
      persisted.snapshot,
      persisted.keywords
    ).strong
  ).toBe(false);
  expect(configured).toHaveBeenCalledWith(
    'owner-1',
    expect.objectContaining({
      keywords: expect.arrayContaining([
        expect.objectContaining({ value: 'دفع', enabled: false })
      ])
    }),
    expect.any(String),
    expect.any(Number)
  );
});

let mockDatabase: StatefulSqlite;
it('durably archives old nominal notifications so a later page can reach new captures', async () => {
  const context = setup({ prepare: prepareFinancialMessageImport });
  context.setOnline(false);
  context.bankNotifications.getAccessState.mockResolvedValue('granted');
  await context.queue.saveRules('owner-1', {
    snapshot: defaultSnapshot,
    keywords: [],
    senders: [],
    accountingPolicy: 'default_account_nominal_v1',
    sourceAdmissionPolicy: 'financial_content_v1',
    policyActivatedAt: 5000
  });
  context.dependencies.sources.load.mockResolvedValue({
    smsEnabled: false,
    notificationEnabled: true,
    notificationActivatedAt: 0
  });
  let records = Array.from({ length: 51 }, (_, i) => ({
    key: 'record-' + i,
    packageName: 'com.synthetic.payment',
    title: '',
    text: 'Paid SAR2',
    postedAt: i === 50 ? 5001 : 1000 + i,
    captureActivatedAt: 0,
    capturePolicy: 'default_account_nominal_v1' as const
  }));
  context.dependencies.bankNotifications.readRecent.mockImplementation(
    async (limit: number) => records.slice(0, limit)
  );
  context.dependencies.bankNotifications.acknowledge.mockImplementation(
    async (keys: string[]) => {
      records = records.filter((record) => !keys.includes(record.key));
    }
  );
  await context.coordinator.sync();
  expect((await context.queue.load('owner-1')).diagnostics ?? []).toHaveLength(
    50
  );
  await context.coordinator.sync();
  expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
  expect(records).toHaveLength(0);
});
it('starts a fresh SMS queue at activation rather than scanning historical messages', async () => {
  const context = setup();
  context.dependencies.sources.load.mockResolvedValue({
    smsEnabled: true,
    notificationEnabled: false,
    smsActivatedAt: 500,
    notificationActivatedAt: 0
  });
  await context.coordinator.sync();
  expect(context.inbox.readRecent).toHaveBeenCalledWith(
    expect.objectContaining({ since: 500 })
  );
  expect((await context.queue.load('owner-1')).activation?.smsActivatedAt).toBe(
    500
  );
});
it('continues after the activation native ID while retaining later timestamp ties', async () => {
  const context = setup();
  context.dependencies.sources.load.mockResolvedValue({
    smsEnabled: true,
    notificationEnabled: false,
    smsActivatedAt: 500,
    smsActivationId: '42',
    notificationActivatedAt: 0
  });
  await context.coordinator.sync();
  expect(context.inbox.readRecent).toHaveBeenCalledWith(
    expect.objectContaining({ since: 500, afterId: '42' })
  );
});
it('captures locally from cached rules when the API fails on a connected network', async () => {
  const context = setup();
  await context.queue.saveRules('owner-1', {
    snapshot: defaultSnapshot,
    keywords: [],
    senders: [],
    rolloutMode: 'automatic'
  });
  context.tracking.getStatus.mockRejectedValue(new Error('API outage'));
  const result = await context.coordinator.sync();
  expect(result.status).toBe('queued');
  expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
  expect(context.tracking.submitImport).not.toHaveBeenCalled();
});
it('reports native retention exhaustion while preserving admitted pending captures', async () => {
  const context = setup();
  context.dependencies.sources.load.mockResolvedValue({
    smsEnabled: false,
    notificationEnabled: true,
    smsActivatedAt: 0,
    notificationActivatedAt: 0
  });
  Object.assign(context.dependencies.bankNotifications, {
    getCaptureIssue: async () => 'tracking_notification_queue_full'
  });
  await context.queue.enqueue('owner-1', {
    idempotencyKey: 'retained',
    submission: {
      schemaVersion: 1,
      sourceType: 'provider',
      sourceChannel: 'android_notification',
      events: [
        {
          sourceItemKey: 'retained',
          receivedAt: '2026-10-14T00:00:00Z',
          amountMinor: -100,
          currency: 'SAR'
        }
      ]
    },
    cursor: 42,
    fingerprints: ['retained']
  });
  context.tracking.getStatus.mockRejectedValue(new Error('offline'));
  expect((await context.coordinator.sync()).status).toBe('error');
  expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
});
it('never drains legacy retained imports while adopting nominal capture', async () => {
  const context = setup();
  await context.queue.enqueue('owner-1', {
    idempotencyKey: 'legacy',
    submission: {
      schemaVersion: 1,
      sourceType: 'sms',
      events: [
        {
          sourceItemKey: 'legacy',
          receivedAt: '2026-10-14T00:00:00Z',
          amountMinor: -100,
          currency: 'SAR'
        }
      ]
    },
    cursor: 42,
    fingerprints: ['legacy']
  });
  const configuration = {
    snapshot: defaultSnapshot,
    keywords: [],
    senders: [],
    accountingPolicy: 'default_account_nominal_v1',
    rolloutMode: 'automatic'
  };
  await context.queue.saveRules('owner-1', configuration as never);
  Object.assign(context.tracking, {
    getRuleConfiguration: jest.fn().mockResolvedValue(configuration)
  });
  context.inbox.readRecent.mockResolvedValue([]);
  await context.coordinator.sync();
  expect(context.tracking.submitImport).not.toHaveBeenCalled();
  expect((await context.queue.load('owner-1')).pending[0]?.idempotencyKey).toBe(
    'legacy'
  );
});
it('refreshes accepted effects while another item in the batch is still processing', async () => {
  const onSaved = jest.fn(async () => true),
    context = setup({ onSaved });
  context.tracking.submitImport.mockResolvedValue({
    ...session('processing'),
    acceptedCount: 1,
    itemCount: 2
  });
  await context.coordinator.sync();
  expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
  expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
});
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
        notificationEnabled: true,
        smsActivatedAt: 0,
        notificationActivatedAt: 0
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
  it.each([
    [undefined, '42'],
    ['20', '42'],
    ['50', '50']
  ])(
    'keeps the native SMS ID boundary at a timestamp tie (cursor %s)',
    async (cursorId, expectedId) => {
      const context = setup();
      if (cursorId)
        await context.queue.checkpoint(
          'owner-1',
          5000,
          [],
          undefined,
          cursorId
        );
      Object.assign(context.tracking, {
        getRuleConfiguration: jest
          .fn()
          .mockResolvedValue({
            snapshot: defaultSnapshot,
            keywords: [],
            senders: [],
            accountingPolicy: 'default_account_nominal_v1',
            sourceAdmissionPolicy: 'financial_content_v1',
            policyActivatedAt: 5000,
            policySmsActivationId: '42'
          })
      });
      await context.coordinator.sync();
      expect(context.inbox.readRecent).toHaveBeenCalledWith(
        expect.objectContaining({ since: 5000, afterId: expectedId })
      );
    }
  );
  it('does not replay retained work or scan earlier than a new device policy boundary', async () => {
    const context = setup();
    await context.queue.enqueue('owner-1', {
      idempotencyKey: 'retained-old',
      submission: {
        schemaVersion: 1,
        sourceType: 'sms',
        events: [
          {
            sourceItemKey: 'old-source',
            receivedAt: '1970-01-01T00:00:00.100Z',
            amountMinor: -200,
            currency: 'SAR'
          }
        ]
      },
      cursor: 100,
      fingerprints: ['old-source']
    });
    Object.assign(context.tracking, {
      getRuleConfiguration: jest.fn().mockResolvedValue({
        keywords: [],
        senders: [],
        sourceAdmissionPolicy: 'financial_content_v1',
        policyActivatedAt: 5000,
        accountingPolicy: 'default_account_nominal_v1',
        snapshot: defaultSnapshot
      })
    });
    context.inbox.readRecent.mockResolvedValue([]);
    context.bankNotifications.readRecent.mockResolvedValue([]);
    await context.coordinator.sync();
    expect(context.inbox.readRecent).toHaveBeenCalledWith(
      expect.objectContaining({ since: 5000 })
    );
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect(
      (await context.queue.load('owner-1')).pending[0]?.idempotencyKey
    ).toBe('retained-old');
  });
  it('replaces obsolete cached safety rules online and resumes with the original intake checkpoint', async () => {
    const context = setup();
    await mockDatabase.runAsync(
      'INSERT INTO sms_import_queue (id, payload) VALUES (?, ?)',
      'singleton',
      JSON.stringify({
        version: 1,
        ownerId: 'owner-1',
        pending: [],
        cursor: 42,
        cursorId: 'old-sms',
        fingerprints: ['seen'],
        mode: 'review_all',
        rules: {
          keywords: [],
          senders: [],
          snapshot: { ...defaultSnapshot, rules: [] }
        }
      })
    );
    Object.assign(context.tracking, {
      getRuleConfiguration: jest.fn().mockResolvedValue({
        keywords: [],
        senders: [],
        snapshot: defaultSnapshot
      })
    });
    context.inbox.readRecent.mockResolvedValue([]);
    expect(await context.coordinator.sync()).toMatchObject({
      status: 'idle',
      errorCode: null
    });
    const refreshed = await context.queue.load('owner-1');
    expect(refreshed).toMatchObject({
      pending: [],
      cursor: 42,
      cursorId: 'old-sms',
      fingerprints: ['seen'],
      rules: { snapshot: defaultSnapshot }
    });
    expect(refreshed.rules.requiresRefresh).toBeUndefined();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('holds stale safety configuration offline without reading either capture channel', async () => {
    const configureBackground = jest.fn(async () => undefined);
    const context = setup({ configureBackground });
    await mockDatabase.runAsync(
      'INSERT INTO sms_import_queue (id, payload) VALUES (?, ?)',
      'singleton',
      JSON.stringify({
        version: 1,
        ownerId: 'owner-1',
        pending: [],
        cursor: 42,
        fingerprints: ['seen'],
        mode: 'review_all',
        rules: {
          keywords: [],
          senders: [],
          snapshot: { ...defaultSnapshot, rules: [] }
        }
      })
    );
    context.setOnline(false);
    expect(await context.coordinator.sync()).toMatchObject({
      status: 'error',
      errorCode: 'sync_failed'
    });
    expect(context.inbox.readRecent).not.toHaveBeenCalled();
    expect(context.bankNotifications.readRecent).not.toHaveBeenCalled();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect(await context.queue.load('owner-1')).toMatchObject({
      cursor: 42,
      fingerprints: ['seen'],
      pending: [],
      rules: { requiresRefresh: true }
    });
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
      status: 'queued',
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
