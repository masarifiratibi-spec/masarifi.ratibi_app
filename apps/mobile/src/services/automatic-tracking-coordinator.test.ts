import type { Account } from '@/domain/core-finance';
import type {
  TrackingImportSession,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import { permissionState } from './mocks/tracking-permission-service';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import {
  createAutomaticTrackingCoordinator,
  syncAutomaticTracking
} from './automatic-tracking-coordinator';
import { prepareFinancialMessageImport } from '@/features/tracking/sms-import';
import {
  invalidateTrackingConsent,
  trackingSourcePreferences
} from './tracking-source-preferences';
import * as productionConsent from './tracking-installation-consent';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
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

it('continues across filtered-empty pages and durably advances the scanned boundary', async () => {
  const context = setup({ prepare: prepareFinancialMessageImport });
  context.setOnline(false);
  const readPage = jest
    .fn()
    .mockResolvedValueOnce({
      version: 2,
      messages: [],
      lastScanned: { receivedAt: 100, id: '1000' },
      hasMore: true,
      scanned: 1000
    })
    .mockResolvedValueOnce({
      version: 2,
      messages: [],
      lastScanned: { receivedAt: 200, id: '2000' },
      hasMore: false,
      scanned: 1000
    });
  Object.assign(context.inbox, { readPage });
  await context.coordinator.sync();
  expect(readPage).toHaveBeenCalledTimes(2);
  expect(readPage.mock.calls[1][0]).toMatchObject({
    since: 100,
    afterId: '1000'
  });
  expect(await context.queue.load('owner-1')).toMatchObject({
    cursor: 200,
    cursorId: '2000',
    pending: []
  });
});

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
it('runs the durable source-consent actor before ordinary background synchronization', async () => {
  const retry = jest
    .spyOn(trackingSourcePreferences, 'retryPendingConsent')
    .mockResolvedValue(false);
  try {
    await syncAutomaticTracking();
    expect(retry).toHaveBeenCalledTimes(1);
  } finally {
    retry.mockRestore();
  }
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
    waitForImport: jest.fn(async () => undefined),
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
  it('uses the prepared pass rule response after status admission instead of another rule context', async () => {
    const context = setup();
    const readRules = jest.fn(async () => ({
      snapshot: defaultSnapshot,
      keywords: [],
      senders: [],
      configurationRevision: 'a'.repeat(64)
    }));
    const submit = Object.assign(
      jest.fn(async () => session('complete')),
      { getRuleConfiguration: readRules }
    );
    let finishStatus!: (value: TrackingStatusSnapshot) => void;
    context.tracking.getStatus.mockReturnValue(
      new Promise((resolve) => {
        finishStatus = resolve;
      })
    );
    Object.assign(context.tracking, {
      prepareImportSubmission: jest.fn(async () => submit),
      getRuleConfiguration: jest.fn(async () => {
        throw new Error('unbound rule read');
      })
    });
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(readRules).not.toHaveBeenCalled();
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
    } finally {
      finishStatus(status());
      await sync;
    }
    expect((await sync).status).toBe('imported');
    expect(
      (await context.queue.load('owner-1')).rules.configurationRevision
    ).toBe('a'.repeat(64));
  });

  it('prepares owned prerequisites while status is pending without capturing or submitting early', async () => {
    const accounts = jest.fn(async () => [ownerAccount]);
    const context = setup({ listAccounts: accounts });
    const submit = jest.fn(async () => session('complete'));
    const prepareSubmission = jest.fn(async () => submit);
    const readRules = jest.fn(async () => ({
      snapshot: defaultSnapshot,
      keywords: [],
      senders: []
    }));
    let finishStatus!: (value: TrackingStatusSnapshot) => void;
    context.tracking.getStatus.mockReturnValue(
      new Promise((resolve) => {
        finishStatus = resolve;
      })
    );
    Object.assign(context.tracking, {
      prepareImportSubmission: prepareSubmission,
      getRuleConfiguration: readRules
    });
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(prepareSubmission).toHaveBeenCalledWith('owner-1');
      expect(accounts).toHaveBeenCalledTimes(1);
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
      expect(readRules).not.toHaveBeenCalled();
    } finally {
      finishStatus(status());
      await sync;
    }
    expect(submit).toHaveBeenCalledTimes(1);
    expect(readRules).toHaveBeenCalledTimes(1);
  });

  it('discards prepared prerequisites if the owner changes while status is pending', async () => {
    let owner = 'owner-1';
    const context = setup({
      session: () => ({ status: 'authenticated', userId: owner })
    });
    const submit = jest.fn(async () => session('complete'));
    const prepareSubmission = jest.fn(async () => submit);
    let finishStatus!: (value: TrackingStatusSnapshot) => void;
    context.tracking.getStatus.mockReturnValue(
      new Promise((resolve) => {
        finishStatus = resolve;
      })
    );
    Object.assign(context.tracking, {
      prepareImportSubmission: prepareSubmission
    });
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(prepareSubmission).toHaveBeenCalledWith('owner-1');
      owner = 'owner-2';
    } finally {
      finishStatus(status());
      await sync;
    }
    expect((await sync).status).toBe('error');
    expect(context.inbox.readRecent).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('observes a server commit after the original short window without another native wake', async () => {
    const startedAt = Date.now();
    let elapsed = 0;
    const clock = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => startedAt + elapsed);
    const onSaved = jest.fn(async () => true);
    const followUp = jest.fn(async () => undefined);
    const context = setup({
      onSaved,
      scheduleFollowUp: followUp,
      waitForImport: async (milliseconds: number) => {
        elapsed += milliseconds;
      }
    });
    context.tracking.getImportSession.mockImplementation(async () => {
      elapsed += 400;
      return session(elapsed >= 1450 ? 'complete' : 'processing');
    });
    try {
      expect((await context.coordinator.sync()).status).toBe('imported');
      expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
      expect(followUp).not.toHaveBeenCalled();
      expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
      expect(context.tracking.getImportSession).toHaveBeenCalledTimes(3);
      expect(elapsed).toBeLessThanOrEqual(2000);
    } finally {
      clock.mockRestore();
    }
  });

  it('prepares fresh import identity alongside configuration and uses it only after capture is authorized', async () => {
    let resolveRules!: (value: unknown) => void;
    const rules = new Promise((resolve) => {
      resolveRules = resolve;
    });
    let resolveSubmit!: (value: typeof context.tracking.submitImport) => void;
    const prepared = new Promise<typeof context.tracking.submitImport>(
      (resolve) => {
        resolveSubmit = resolve;
      }
    );
    const context = setup();
    const submit = jest.fn(async () => session('complete'));
    const prepareSubmission = jest.fn(() => prepared);
    Object.assign(context.tracking, {
      prepareImportSubmission: prepareSubmission,
      getRuleConfiguration: jest.fn(() => rules)
    });
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(prepareSubmission).toHaveBeenCalledWith('owner-1');
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
      resolveRules({ snapshot: defaultSnapshot, keywords: [], senders: [] });
      for (let turn = 0; turn < 200; turn++) await Promise.resolve();
      expect(context.tracking.submitImport).not.toHaveBeenCalled();
    } finally {
      resolveRules({ snapshot: defaultSnapshot, keywords: [], senders: [] });
      resolveSubmit(submit);
      await sync;
    }
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'sms' }),
      expect.any(String),
      'owner-1'
    );
  });

  it('handles failed identity preparation without submitting or losing the queued capture', async () => {
    const context = setup();
    Object.assign(context.tracking, {
      prepareImportSubmission: jest.fn(async () => {
        throw new Error('identity_unavailable');
      })
    });
    expect((await context.coordinator.sync()).status).toBe('error');
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
    expect(
      (await context.queue.load('owner-1')).pending[0].sessionId
    ).toBeNull();
  });

  it('does not submit when the owner changes while prepared identity is pending', async () => {
    let owner = 'owner-1';
    const context = setup({
      session: () => ({ status: 'authenticated', userId: owner })
    });
    let resolveSubmit!: (value: typeof context.tracking.submitImport) => void;
    const prepared = new Promise<typeof context.tracking.submitImport>(
      (resolve) => {
        resolveSubmit = resolve;
      }
    );
    Object.assign(context.tracking, {
      prepareImportSubmission: jest.fn(() => prepared)
    });
    const submit = jest.fn(async () => session('complete'));
    const sync = context.coordinator.sync();
    for (let turn = 0; turn < 300; turn++) await Promise.resolve();
    owner = 'owner-2';
    resolveSubmit(submit);
    await sync;
    expect(submit).not.toHaveBeenCalled();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('overlaps owned account reads with rules without capturing before both are ready', async () => {
    let resolveRules!: (value: unknown) => void;
    let resolveAccounts!: (value: Account[]) => void;
    const rules = new Promise((resolve) => {
      resolveRules = resolve;
    });
    const accounts = new Promise<Account[]>((resolve) => {
      resolveAccounts = resolve;
    });
    const listAccounts = jest.fn(() => accounts);
    const readRules = jest.fn(() => rules);
    const context = setup({ listAccounts });
    Object.assign(context.tracking, { getRuleConfiguration: readRules });
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(readRules).toHaveBeenCalledTimes(1);
      expect(listAccounts).toHaveBeenCalledTimes(1);
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
      expect(context.tracking.submitImport).not.toHaveBeenCalled();
      resolveRules({ snapshot: defaultSnapshot, keywords: [], senders: [] });
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
    } finally {
      resolveRules({ snapshot: defaultSnapshot, keywords: [], senders: [] });
      resolveAccounts([ownerAccount]);
      await sync;
    }
  });

  it('observes a newly posted import in the same pass instead of scheduling another native wake', async () => {
    const onSaved = jest.fn(async () => true);
    const followUp = jest.fn(async () => undefined);
    const context = setup({ onSaved, scheduleFollowUp: followUp });
    context.tracking.getImportSession
      .mockResolvedValueOnce(session('processing'))
      .mockResolvedValue(session('complete'));
    expect((await context.coordinator.sync()).status).toBe('imported');
    expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
    expect(followUp).not.toHaveBeenCalled();
  });

  it('bounds new-import settling and retains its receipt for the ordinary durable follow-up', async () => {
    const pause = jest.fn(async () => undefined);
    const followUp = jest.fn(async () => undefined);
    const context = setup({ waitForImport: pause, scheduleFollowUp: followUp });
    expect((await context.coordinator.sync()).status).toBe('processing');
    expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(5);
    expect(pause).toHaveBeenCalledTimes(4);
    expect(followUp).toHaveBeenCalledTimes(1);
    expect((await context.queue.load('owner-1')).pending[0].sessionId).toBe(
      'session-1'
    );
  });

  it('stops the new-import settling read if the owner changes while waiting', async () => {
    let owner = 'owner-1';
    const onSaved = jest.fn(async () => true);
    const context = setup({
      session: () => ({ status: 'authenticated', userId: owner }),
      waitForImport: async () => {
        owner = 'owner-2';
      },
      onSaved
    });
    expect((await context.coordinator.sync()).status).toBe('error');
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending[0].sessionId).toBe(
      'session-1'
    );
  });

  it('keeps slow import reads on the existing durable follow-up instead of adding network waits', async () => {
    const realNow = Date.now;
    let elapsed = realNow();
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => elapsed);
    const pause = jest.fn(async () => undefined);
    const context = setup({ waitForImport: pause });
    context.tracking.getImportSession.mockImplementation(async () => {
      elapsed += 2500;
      return session('processing');
    });
    try {
      expect((await context.coordinator.sync()).status).toBe('processing');
      expect(context.tracking.getImportSession).toHaveBeenCalledTimes(1);
      expect(pause).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
  it('stops settling when capture consent changes during its wait', async () => {
    const onSaved = jest.fn(async () => true);
    const context = setup({
      waitForImport: async () => {
        invalidateTrackingConsent();
      },
      onSaved
    });
    expect((await context.coordinator.sync()).status).toBe('error');
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending[0].sessionId).toBe(
      'session-1'
    );
  });

  it('handles a rejected concurrent account read without scanning or submitting', async () => {
    let resolveRules!: (value: unknown) => void;
    const rules = new Promise((resolve) => {
      resolveRules = resolve;
    });
    const listAccounts = jest.fn(async () => {
      throw new Error('offline');
    });
    const context = setup({ listAccounts });
    Object.assign(context.tracking, {
      getRuleConfiguration: jest.fn(() => rules)
    });
    const sync = context.coordinator.sync();
    for (let turn = 0; turn < 100; turn++) await Promise.resolve();
    expect(listAccounts).toHaveBeenCalledTimes(1);
    resolveRules({ snapshot: defaultSnapshot, keywords: [], senders: [] });
    expect((await sync).status).toBe('error');
    expect(context.inbox.readRecent).not.toHaveBeenCalled();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it('shares the extra-read budget across a batch rather than multiplying it by pending entries', async () => {
    const context = setup();
    context.inbox.readRecent.mockResolvedValue([]);
    for (let index = 0; index < 3; index++) {
      await context.queue.enqueue('owner-1', {
        idempotencyKey: `new-batch-${index}`,
        submission: {
          schemaVersion: 1,
          sourceType: 'sms',
          events: [
            {
              sourceItemKey: `new-${index}`,
              amountMinor: -1,
              receivedAt: '2026-01-01T00:00:00Z'
            }
          ]
        },
        cursor: index + 1,
        fingerprints: []
      });
    }
    let submitted = 0;
    context.tracking.submitImport.mockImplementation(async () => ({
      ...session('processing'),
      id: `new-session-${++submitted}`
    }));
    context.tracking.getImportSession.mockImplementation(
      async (id: string) => ({ ...session('processing'), id })
    );
    expect((await context.coordinator.sync()).status).toBe('processing');
    expect(context.tracking.submitImport).toHaveBeenCalledTimes(3);
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(7);
    expect((await context.queue.load('owner-1')).pending).toHaveLength(3);
  });

  it('cancels a stalled extra observation at the deadline and ignores its late completion', async () => {
    jest.useFakeTimers();
    let release!: (value: TrackingImportSession) => void;
    const stalled = new Promise<TrackingImportSession>((resolve) => {
      release = resolve;
    });
    let extraSignal: AbortSignal | undefined;
    const followUp = jest.fn(async () => undefined);
    const onSaved = jest.fn(async () => true);
    const context = setup({ scheduleFollowUp: followUp, onSaved });
    context.tracking.getImportSession
      .mockResolvedValueOnce(session('processing'))
      .mockImplementationOnce(
        (_id: string, _owner: string, signal?: AbortSignal) => {
          extraSignal = signal;
          return stalled;
        }
      )
      .mockResolvedValue(session('processing'));
    const sync = context.coordinator.sync();
    try {
      for (let turn = 0; turn < 300; turn++) await Promise.resolve();
      expect(context.tracking.getImportSession).toHaveBeenCalledTimes(2);
      expect(extraSignal).toBeDefined();
      await jest.advanceTimersByTimeAsync(2000);
      expect((await sync).status).toBe('processing');
      expect(extraSignal!.aborted).toBe(true);
      expect(followUp).toHaveBeenCalledTimes(1);
      release(session('complete'));
      for (let turn = 0; turn < 30; turn++) await Promise.resolve();
      expect(context.coordinator.getState().status).toBe('processing');
      expect(onSaved).not.toHaveBeenCalled();
      expect((await context.queue.load('owner-1')).pending[0].sessionId).toBe(
        'session-1'
      );
    } finally {
      release(session('processing'));
      await sync;
      jest.useRealTimers();
    }
  });

  const installation = {
    deviceId: 'aaaaaaaa-1111-4111-8111-111111111111',
    version: 1,
    generation: 'bbbbbbbb-2222-4222-8222-222222222222',
    sessionBinding: 'a'.repeat(64),
    captureAllowed: true,
    sources: {
      smsEnabled: true,
      notificationEnabled: false,
      smsActivatedAt: '1970-01-01T00:00:01.000Z',
      smsActivationId: '42',
      notificationActivatedAt: null
    }
  };
  const productionRules = () => ({
    keywords: [],
    senders: [],
    snapshot: defaultSnapshot,
    accountingPolicy: 'default_account_nominal_v1' as const,
    sourceAdmissionPolicy: 'financial_content_v1' as const,
    installation,
    activation: {
      smsActivatedAt: 1000,
      smsActivationId: '42',
      notificationActivatedAt: 0
    },
    policyActivatedAt: 1000,
    configurationRevision: 'c'.repeat(64)
  });
  it('holds capture and unsubmitted work while production consent is not locally acknowledged', async () => {
    const context = setup();
    const permit = jest
      .spyOn(productionConsent, 'hasProductionTrackingConsent')
      .mockResolvedValue(false);
    try {
      await context.coordinator.sync();
      expect(context.inbox.readRecent).not.toHaveBeenCalled();
      expect(context.bankNotifications.readRecent).not.toHaveBeenCalled();
      expect(context.tracking.submitImport).not.toHaveBeenCalled();
    } finally {
      permit.mockRestore();
    }
  });
  it('pins the production generation on newly captured events without changing their source identity', async () => {
    const context = setup({
      prepare: prepareFinancialMessageImport,
      deviceId: async () => installation.deviceId
    });
    context.setOnline(false);
    context.inbox.readRecent.mockResolvedValue([
      { id: '99', sender: 'BANK', body: 'Paid SAR2', receivedAt: 3000 }
    ]);
    await context.queue.saveRules('owner-1', productionRules());
    await context.coordinator.sync();
    const pending = (await context.queue.load('owner-1')).pending;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.submission.events[0]?.transport).toMatchObject({
      deviceId: installation.deviceId,
      installationGeneration: installation.generation,
      installationVersion: 1
    });
    const original = await prepareFinancialMessageImport(
      [{ id: '99', sender: 'BANK', body: 'Paid SAR2', receivedAt: 3000 }],
      {
        keywordRules: [],
        senderRules: [],
        accounts: [ownerAccount],
        knownFingerprints: new Set(),
        deviceId: installation.deviceId,
        snapshot: defaultSnapshot,
        accountingPolicy: 'default_account_nominal_v1',
        sourceAdmissionPolicy: 'financial_content_v1',
        activatedAt: 1000
      }
    );
    expect(pending[0]?.submission.events[0]?.sourceItemKey).toBe(
      original.events[0]?.sourceItemKey
    );
  });
  it('retains an unsubmitted stale generation without replacing its proof or operation ID', async () => {
    const context = setup({
      sources: {
        load: async () => ({
          smsEnabled: true,
          notificationEnabled: false,
          smsActivatedAt: 1000,
          smsActivationId: '42'
        })
      }
    });
    Object.assign(context.tracking, {
      getRuleConfiguration: async () => productionRules()
    });
    context.inbox.readRecent.mockResolvedValue([]);
    await context.queue.saveRules('owner-1', productionRules());
    const prepared = await prepareFinancialMessageImport(
      [{ id: '99', sender: 'BANK', body: 'Paid SAR2', receivedAt: 3000 }],
      {
        keywordRules: [],
        senderRules: [],
        accounts: [ownerAccount],
        knownFingerprints: new Set(),
        deviceId: installation.deviceId,
        snapshot: defaultSnapshot,
        accountingPolicy: 'default_account_nominal_v1',
        sourceAdmissionPolicy: 'financial_content_v1',
        activatedAt: 1000
      }
    );
    for (const event of prepared.events)
      if (event.transport)
        Object.assign(event.transport, {
          installationGeneration: 'cccccccc-3333-4333-8333-333333333333',
          installationVersion: 99
        });
    await context.queue.enqueue('owner-1', {
      idempotencyKey: 'retained-original',
      submission: {
        schemaVersion: 3,
        sourceType: 'sms',
        sourceChannel: 'android_sms',
        events: prepared.events
      },
      cursor: 3000,
      fingerprints: []
    });
    const before = (await context.queue.load('owner-1')).pending;
    await context.coordinator.sync();
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending).toEqual(before);
  });
  it('bounds polling of a retained processing receipt to one normal observation and recheck per pass', async () => {
    const context = setup();
    context.inbox.readRecent.mockResolvedValue([]);
    await context.queue.enqueue('owner-1', {
      idempotencyKey: 'retained-processing',
      submission: {
        schemaVersion: 1,
        sourceType: 'sms',
        events: [
          {
            sourceItemKey: 'retained-original',
            amountMinor: -1,
            receivedAt: '2026-01-01T00:00:00Z'
          }
        ]
      },
      cursor: 1,
      fingerprints: []
    });
    await context.queue.markSubmitted(
      'owner-1',
      'retained-processing',
      'session-1'
    );
    await context.coordinator.sync();
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(2);
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });
  it('reconciles a retained accepted session while capture is paused and both sources are disabled', async () => {
    const onSaved = jest.fn(async () => true);
    const context = setup({
      onSaved,
      sources: {
        load: async () => ({ smsEnabled: false, notificationEnabled: false })
      }
    });
    context.tracking.getStatus.mockResolvedValue({
      ...status(),
      mode: 'paused'
    });
    await context.queue.enqueue('owner-1', {
      idempotencyKey: 'retained-original',
      submission: {
        schemaVersion: 1,
        sourceType: 'sms',
        events: [
          {
            sourceItemKey: 'retained-original',
            amountMinor: -1,
            receivedAt: '2026-01-01T00:00:00Z'
          }
        ]
      },
      cursor: 1,
      fingerprints: []
    });
    await context.queue.markSubmitted(
      'owner-1',
      'retained-original',
      'session-1'
    );
    context.tracking.getImportSession.mockResolvedValue(session('complete'));
    expect((await context.coordinator.sync()).status).toBe('imported');
    expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending).toHaveLength(0);
    expect(context.inbox.readRecent).not.toHaveBeenCalled();
  });
  it('rechecks a live import once and reconciles a save before another native follow-up', async () => {
    const onSaved = jest.fn(async () => true);
    const scheduleFollowUp = jest.fn(async () => undefined);
    const context = setup({
      onSaved,
      scheduleFollowUp
    });
    context.tracking.getImportSession.mockResolvedValue(session('complete'));

    expect((await context.coordinator.sync()).status).toBe('imported');
    expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(1);
    expect(context.tracking.getImportSession).toHaveBeenCalledWith(
      'session-1',
      'owner-1'
    );
    expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
    expect(scheduleFollowUp).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending).toHaveLength(0);
  });

  it('bounds new live rechecks to five reads and retains the normal durable follow-up for slow processing', async () => {
    const scheduleFollowUp = jest.fn(async () => undefined);
    const context = setup({ scheduleFollowUp });
    context.tracking.submitImport.mockResolvedValue(session('received'));

    expect((await context.coordinator.sync()).status).toBe('processing');
    expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
    expect(context.tracking.getImportSession).toHaveBeenCalledTimes(5);
    expect(scheduleFollowUp).toHaveBeenCalledWith('owner-1');
    expect((await context.queue.load('owner-1')).pending).toEqual([
      expect.objectContaining({ sessionId: 'session-1' })
    ]);
  });

  it.each(['unavailable', 'different receipt'] as const)(
    'recovers an unconfirmed live read (%s) by its retained receipt without submitting again',
    async (failure) => {
      const onSaved = jest.fn(async () => true);
      const scheduleFollowUp = jest.fn(async () => undefined);
      const context = setup({
        onSaved,
        scheduleFollowUp
      });
      if (failure === 'unavailable')
        context.tracking.getImportSession.mockRejectedValueOnce(
          new Error('API unavailable')
        );
      else
        context.tracking.getImportSession.mockResolvedValueOnce({
          ...session('complete'),
          id: 'other-session'
        });
      expect((await context.coordinator.sync()).status).toBe('processing');
      expect((await context.queue.load('owner-1')).pending[0]?.sessionId).toBe(
        'session-1'
      );
      expect(scheduleFollowUp).toHaveBeenCalledWith('owner-1');
      expect(onSaved).not.toHaveBeenCalled();
      context.inbox.readRecent.mockResolvedValue([]);
      context.tracking.getImportSession.mockResolvedValue(session('complete'));

      expect((await context.coordinator.sync()).status).toBe('imported');
      expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect((await context.queue.load('owner-1')).pending).toHaveLength(0);
    }
  );

  it.each(['owner', 'consent'] as const)(
    'fences the live recheck result when the initiating %s changes',
    async (changed) => {
      let ownerId = 'owner-1';
      const onSaved = jest.fn(async () => true);
      const context = setup({
        onSaved,
        session: () => ({ status: 'authenticated', userId: ownerId })
      });
      context.tracking.getImportSession.mockImplementationOnce(async () => {
        if (changed === 'owner') ownerId = 'owner-2';
        else invalidateTrackingConsent();
        return session('complete');
      });

      expect((await context.coordinator.sync()).status).toBe('error');
      expect(onSaved).not.toHaveBeenCalled();
      expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
    }
  );

  it('does not delay an already accepted effect for another import read', async () => {
    const onSaved = jest.fn(async () => true);
    const context = setup({ onSaved });
    context.tracking.submitImport.mockResolvedValue({
      ...session('processing'),
      acceptedCount: 1,
      itemCount: 2
    });

    await context.coordinator.sync();
    expect(onSaved).toHaveBeenCalledWith('owner-1', 'session-1');
    expect(context.tracking.getImportSession).not.toHaveBeenCalled();
    expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
  });

  it.each([
    ['complete', 1],
    ['processing', 1],
    ['review', 0],
    ['failed', 0]
  ] as const)(
    'does not recheck a %s receipt with %i accepted effects',
    async (status, acceptedCount) => {
      const context = setup();
      context.tracking.submitImport.mockResolvedValue({
        ...session(status),
        acceptedCount
      });
      await context.coordinator.sync();
      expect(context.tracking.getImportSession).not.toHaveBeenCalled();
      expect(context.tracking.submitImport).toHaveBeenCalledTimes(1);
    }
  );

  it('schedules durable follow-up for an asynchronously submitted session', async () => {
    const scheduleFollowUp = jest.fn(async () => undefined);
    const context = setup({ scheduleFollowUp });

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'processing',
      sessionId: 'session-1'
    });

    expect(scheduleFollowUp).toHaveBeenCalledTimes(1);
    expect(scheduleFollowUp).toHaveBeenCalledWith('owner-1');
    expect((await context.queue.load('owner-1')).pending).toEqual([
      expect.objectContaining({ sessionId: 'session-1' })
    ]);
  });

  it('retains a submitted receipt and reports sync_failed if follow-up scheduling fails', async () => {
    const context = setup({
      scheduleFollowUp: async () => {
        throw new Error('native unavailable');
      }
    });

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'sync_failed'
    });
    expect((await context.queue.load('owner-1')).pending).toEqual([
      expect.objectContaining({ sessionId: 'session-1' })
    ]);
  });

  it.each(['owner', 'consent'] as const)(
    'does not schedule a receipt after the initiating %s changes during submission',
    async (changed) => {
      const scheduleFollowUp = jest.fn(async () => undefined);
      let ownerId = 'owner-1';
      const context = setup({
        scheduleFollowUp,
        session: () => ({ status: 'authenticated', userId: ownerId })
      });
      context.tracking.submitImport.mockImplementation(async () => {
        if (changed === 'owner') ownerId = 'owner-2';
        else invalidateTrackingConsent();
        return session('processing');
      });

      await context.coordinator.sync();

      expect(scheduleFollowUp).not.toHaveBeenCalled();
      expect((await context.queue.load('owner-1')).pending).toHaveLength(1);
    }
  );

  it('schedules a still-pending retained session without resubmitting it', async () => {
    const scheduleFollowUp = jest.fn(async () => undefined);
    const context = setup({ scheduleFollowUp });
    await context.coordinator.sync();
    scheduleFollowUp.mockClear();
    context.tracking.submitImport.mockClear();
    context.inbox.readRecent.mockResolvedValue([]);

    await context.coordinator.sync();

    expect(scheduleFollowUp).toHaveBeenCalledWith('owner-1');
    expect(context.tracking.submitImport).not.toHaveBeenCalled();
  });

  it.each(['complete', 'review'] as const)(
    'does not schedule a follow-up for visible terminal %s work',
    async (backend) => {
      const scheduleFollowUp = jest.fn(async () => undefined);
      const context = setup({ scheduleFollowUp });
      context.tracking.submitImport.mockResolvedValue(session(backend));
      context.tracking.listReviewItems.mockResolvedValue({
        items: [{ id: 'review-1', detectedEventId: 'item-1' }],
        nextCursor: null,
        total: 1
      });

      await context.coordinator.sync();

      expect(scheduleFollowUp).not.toHaveBeenCalled();
      expect((await context.queue.load('owner-1')).pending).toEqual([]);
    }
  );

  it('does not schedule when no receipt is pending', async () => {
    const scheduleFollowUp = jest.fn(async () => undefined);
    const context = setup({ scheduleFollowUp });
    context.inbox.readRecent.mockResolvedValue([]);

    await expect(context.coordinator.sync()).resolves.toMatchObject({
      status: 'idle'
    });

    expect(scheduleFollowUp).not.toHaveBeenCalled();
  });

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
        getRuleConfiguration: jest.fn().mockResolvedValue({
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

  it('persists the selected notification destination without changing the queued SMS destination', async () => {
    const context = setup({ prepare: prepareFinancialMessageImport });
    context.setOnline(false);
    const notificationAccountId = '10000000-0000-4000-8000-000000000002';
    context.dependencies.listCachedAccounts.mockResolvedValue([
      ownerAccount,
      {
        ...ownerAccount,
        id: notificationAccountId,
        type: 'wallet',
        currencyCode: 'EGP'
      }
    ]);
    await context.queue.saveRules('owner-1', {
      snapshot: defaultSnapshot,
      keywords: [],
      senders: [],
      accountingPolicy: 'default_account_nominal_v1',
      sourceAdmissionPolicy: 'financial_content_v1'
    });
    context.dependencies.sources.load.mockResolvedValue({
      smsEnabled: true,
      notificationEnabled: true,
      smsActivatedAt: 0,
      notificationActivatedAt: 0,
      notificationAccountId
    });
    context.bankNotifications.getAccessState.mockResolvedValue('granted');
    context.bankNotifications.readRecent.mockResolvedValue([
      {
        key: 'destination-test',
        packageName: 'example.wallet',
        title: '',
        text: 'You have received 1 EGP',
        postedAt: 100,
        capturePolicy: 'default_account_nominal_v1',
        captureActivatedAt: 0
      }
    ]);
    await context.coordinator.sync();
    const submissions = (await context.queue.load('owner-1')).pending.map(
      (entry) => entry.submission
    );
    expect(
      submissions.find(
        (submission) => submission.sourceChannel === 'android_sms'
      )?.events[0]?.metadata
    ).not.toHaveProperty('notificationAccountId');
    expect(
      submissions.find(
        (submission) => submission.sourceChannel === 'android_notification'
      )?.events[0]
    ).toMatchObject({
      currency: 'EGP',
      amountMinor: 100,
      metadata: { notificationAccountId }
    });
  });

  it('queues source currency with the current matching UI preference and ignores the legacy notification binding in the opted-in cohort', async () => {
    const context = setup({ prepare: prepareFinancialMessageImport });
    context.setOnline(false);
    const walletId = '10000000-0000-4000-8000-000000000002';
    context.dependencies.listCachedAccounts.mockResolvedValue([
      ownerAccount,
      { ...ownerAccount, id: walletId, type: 'wallet', currencyCode: 'EGP' }
    ]);
    await context.queue.saveRules('owner-1', {
      snapshot: defaultSnapshot,
      keywords: [],
      senders: [],
      accountingPolicy: 'default_account_nominal_v1',
      sourceAdmissionPolicy: 'financial_content_v1',
      currencyAccountPolicy: 'source_currency_v1'
    });
    context.dependencies.sources.load.mockResolvedValue({
      smsEnabled: true,
      notificationEnabled: true,
      smsActivatedAt: 0,
      notificationActivatedAt: 0,
      notificationAccountId: ownerAccount.id
    });
    context.bankNotifications.getAccessState.mockResolvedValue('granted');
    const receipt = {
      key: 'source-policy-one',
      packageName: 'example.wallet',
      sourceDisplayName: 'Wallet App',
      title: '',
      text: 'You have received 1 EGP',
      postedAt: 100,
      capturePolicy: 'default_account_nominal_v1',
      captureActivatedAt: 0
    };
    context.bankNotifications.readRecent.mockResolvedValue([receipt]);
    useCoreFinanceViewState.getState().selectAccount(walletId);
    try {
      expect((await context.coordinator.sync()).status).toBe('queued');
      const pending = (await context.queue.load('owner-1')).pending;
      const notification = pending.find(
        (entry) => entry.submission.sourceChannel === 'android_notification'
      );
      expect(notification?.submission.events[0]).toMatchObject({
        currency: 'EGP',
        amountMinor: 100,
        metadata: {
          preferredAccountId: walletId,
          sourceDisplayName: 'Wallet App'
        }
      });
      const sms = pending.find(
        (entry) => entry.submission.sourceChannel === 'android_sms'
      );
      expect(sms?.submission.events[0].metadata?.sourceDisplayName).toBe(
        'BANK'
      );
      expect(sms?.submission.events[0].metadata).not.toHaveProperty(
        'preferredAccountId'
      );
      expect(notification?.submission.events[0].metadata).not.toHaveProperty(
        'notificationAccountId'
      );
      expect(context.bankNotifications.acknowledge).toHaveBeenCalledWith([
        'source-policy-one'
      ]);
      useCoreFinanceViewState.getState().selectAccount(ownerAccount.id);
      context.inbox.readRecent.mockResolvedValue([]);
      context.bankNotifications.readRecent.mockResolvedValue([
        { ...receipt, key: 'source-policy-two', postedAt: 101 }
      ]);
      await context.coordinator.sync();
      const saved = (await context.queue.load('owner-1')).pending;
      expect(saved).toHaveLength(3);
      expect(saved[2].submission.events[0]).toMatchObject({
        currency: 'EGP',
        amountMinor: 100
      });
      expect(saved[2].submission.events[0].metadata).not.toHaveProperty(
        'preferredAccountId'
      );
      for (const entry of saved)
        for (const event of entry.submission.events) {
          expect(event).not.toHaveProperty('accountId');
          expect(event).not.toHaveProperty('kind');
        }
      expect(context.tracking.submitImport).not.toHaveBeenCalled();
    } finally {
      useCoreFinanceViewState.getState().selectAccount(null);
    }
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
