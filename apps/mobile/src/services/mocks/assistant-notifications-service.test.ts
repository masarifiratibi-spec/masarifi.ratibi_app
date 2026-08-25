import { createNotificationPreferences, type NotificationEvent, type NotificationPreferences } from '@/domain/notifications';
import { resetRuntimeUserData } from '@/storage/runtime-user-data-reset';

import { createMockAssistantNotificationsService } from './assistant-notifications-service';

const event = (id: string, patch: Partial<NotificationEvent> = {}): NotificationEvent => ({
  id,
  eventKey: `event-${id}`,
  category: 'transaction',
  eventType: 'created',
  titleKey: 'notifications.transaction.created',
  bodyKey: 'notifications.transaction.created.body',
  messageValues: {},
  sensitivity: 'protected',
  target: { kind: 'transaction', transactionId: 'tx-1' },
  availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: 1 }],
  occurredAt: 100,
  readAt: null,
  deletedAt: null,
  phoneStatus: 'not_requested',
  syncStatus: 'synced',
  safeFailure: null,
  ...patch
});

function repository(initialPreferences: NotificationPreferences = createNotificationPreferences(1)) {
  const events = new Map<string, NotificationEvent>();
  let preferences = initialPreferences;
  return {
    async saveNotification(value: NotificationEvent) {
      const duplicate = [...events.values()].find((item) => item.eventKey === value.eventKey);
      if (duplicate) return duplicate;
      events.set(value.id, value);
      return value;
    },
    async updateNotificationPhoneStatus(id: string, fields: Pick<NotificationEvent, 'phoneStatus' | 'syncStatus' | 'safeFailure'>) {
      const value = await this.getNotification(id);
      const next = { ...value, ...fields };
      events.set(id, next);
      return next;
    },
    async upsertNotification(value: NotificationEvent) {
      events.set(value.id, value);
      return value;
    },
    async getNotification(id: string) {
      const value = events.get(id);
      if (!value) throw new Error('not_found');
      return value;
    },
    async listNotifications(input: { category?: NotificationEvent['category']; unreadOnly?: boolean; pageSize?: number } = {}) {
      if ('pageSize' in input && input.pageSize && input.pageSize > 100) throw new Error('page_size_too_large');
      const items = [...events.values()].filter((item) => item.deletedAt === null && (!input.category || item.category === input.category) && (!input.unreadOnly || item.readAt === null));
      return { items, nextCursor: null, total: items.length };
    },
    async markNotificationRead(id: string, readAt: number | null) {
      const value = await this.getNotification(id);
      const next = { ...value, readAt };
      events.set(id, next);
      return next;
    },
    async markAllNotificationsRead(filter: { category?: NotificationEvent['category'] }, readAt: number) {
      let count = 0;
      for (const [id, value] of events) if (value.deletedAt === null && value.readAt === null && (!filter.category || value.category === filter.category)) {
        events.set(id, { ...value, readAt }); count += 1;
      }
      return count;
    },
    async tombstoneNotification(id: string, deletedAt: number) {
      const value = await this.getNotification(id);
      const next = { ...value, deletedAt };
      events.set(id, next);
      return next;
    },
    async getNotificationPreferences() {
      return preferences;
    },
    async saveNotificationPreferences(value: typeof preferences) {
      preferences = value;
      return value;
    }
  };
}

test('creates, lists, gets, and deduplicates source events while retaining correction and reversal events', async () => {
  const service = createMockAssistantNotificationsService({ repository: repository() });
  const original = await service.createFromSource(event('original'));
  expect(await service.createFromSource(event('duplicate', { eventKey: original.eventKey }))).toEqual(original);
  await service.createFromSource(event('correction', { eventKey: 'transaction:tx-1:correction', eventType: 'corrected' }));
  await service.createFromSource(event('reversal', { eventKey: 'transaction:tx-1:reversal', eventType: 'reversed' }));

  expect((await service.list({})).items.map((item) => item.id)).toEqual(['original', 'correction', 'reversal']);
  expect(await service.get('original')).toEqual(original);
});

test('marks only matching notifications and deleting one leaves its source target intact', async () => {
  const service = createMockAssistantNotificationsService({ repository: repository() });
  await service.createFromSource(event('transaction'));
  await service.createFromSource(event('transaction-2'));
  await service.createFromSource(event('security', { category: 'security', target: { kind: 'security', securityEventId: 'security-1' } }));

  expect((await service.markRead('transaction', true)).value.readAt).toEqual(expect.any(Number));
  expect((await service.markAllRead({ category: 'transaction' }, 'read-transactions')).value).toBe(1);
  const deleted = await service.delete('transaction', 'delete-transaction');
  expect(deleted.value).toEqual({ id: 'transaction' });
  expect(await service.delete('transaction', 'delete-transaction')).toEqual(deleted);
  expect((await service.list({})).items.map((item) => item.id)).toEqual(['transaction-2', 'security']);
  expect((await service.get('transaction')).target).toEqual({ kind: 'transaction', transactionId: 'tx-1' });
});

test('resets notification operation replays with runtime user data', async () => {
  const executeOwnerAction = jest.fn(async () => undefined);
  const service = createMockAssistantNotificationsService({
    repository: repository(),
    now: () => 100,
    resolveTarget: async (target) => ({ status: 'exact' as const, target, sourceVersion: 1 }),
    executeOwnerAction,
    registerForReset: true
  });
  await service.createFromSource(event('mark-before', { category: 'budget' }));
  await service.createFromSource(event('delete-target'));
  await service.createFromSource(event('action-before', {
    availableActions: [{ kind: 'undo', expiresAt: null, sourceVersion: 1 }]
  }));
  await service.markAllRead({ category: 'budget' }, 'mark-reset');
  await service.delete('delete-target', 'delete-reset');
  await service.executeAction('action-before', 'undo', 'action-reset');

  resetRuntimeUserData();

  await service.createFromSource(event('mark-after', { category: 'budget' }));
  await service.createFromSource(event('delete-target', { eventKey: 'event-delete-after' }));
  await service.createFromSource(event('action-after', {
    target: { kind: 'transaction', transactionId: 'tx-2' },
    availableActions: [{ kind: 'undo', expiresAt: null, sourceVersion: 1 }]
  }));
  await service.markAllRead({ category: 'budget' }, 'mark-reset');
  await service.delete('delete-target', 'delete-reset');
  await expect(service.executeAction('action-after', 'undo', 'action-reset')).resolves.toMatchObject({
    value: { target: { kind: 'transaction', transactionId: 'tx-2' } }
  });

  expect((await service.get('mark-after')).readAt).toBe(100);
  expect((await service.get('delete-target')).deletedAt).toBe(100);
  expect(executeOwnerAction).toHaveBeenCalledTimes(2);
});

test('resolves current targets and rejects unavailable, expired, or stale actions before executing an operation once', async () => {
  const service = createMockAssistantNotificationsService({
    repository: repository(),
    now: () => 100,
    resolveTarget: async (target) => target?.kind === 'transaction'
      ? { status: 'exact' as const, target, sourceVersion: 1 }
      : { status: 'unavailable' as const, target: null, sourceVersion: null }
  });
  await service.createFromSource(event('available'));
  await service.createFromSource(event('expired', { availableActions: [{ kind: 'undo', expiresAt: 99, sourceVersion: 1 }] }));
  await service.createFromSource(event('stale', { availableActions: [{ kind: 'edit', expiresAt: null, sourceVersion: 2 }] }));

  expect(await service.resolveTarget('available')).toEqual({ status: 'exact', target: { kind: 'transaction', transactionId: 'tx-1' } });
  expect((await service.revalidateAction('expired', 'undo')).status).toBe('expired');
  expect((await service.revalidateAction('stale', 'edit')).status).toBe('unavailable');
  expect(await service.executeAction('available', 'view', 'open-1')).toEqual(await service.executeAction('available', 'view', 'open-1'));
});

test('rejects an absent action without resolving its target', async () => {
  const resolveTarget = jest.fn(async (target: NotificationEvent['target']) => ({
    status: 'unlock_required' as const,
    target,
    sourceVersion: 1
  }));
  const service = createMockAssistantNotificationsService({ repository: repository(), resolveTarget });
  await service.createFromSource(event('missing-action', { availableActions: [] }));

  expect((await service.revalidateAction('missing-action', 'undo')).status).toBe('unavailable');
  expect(resolveTarget).not.toHaveBeenCalled();
});

test('executes a mutating owner action once per operation while view stays read-only', async () => {
  const executeOwnerAction = jest.fn(async () => undefined);
  const service = createMockAssistantNotificationsService({
    repository: repository(),
    now: () => 100,
    resolveTarget: async (target) => ({ status: 'exact' as const, target, sourceVersion: 1 }),
    executeOwnerAction
  });
  await service.createFromSource(event('undoable', {
    availableActions: [
      { kind: 'view', expiresAt: null, sourceVersion: 1 },
      { kind: 'undo', expiresAt: 200, sourceVersion: 1 }
    ]
  }));

  const [first, replay] = await Promise.all([
    service.executeAction('undoable', 'undo', 'undo-operation'),
    service.executeAction('undoable', 'undo', 'undo-operation')
  ]);
  expect(replay).toEqual(first);
  expect(executeOwnerAction).toHaveBeenCalledTimes(1);
  expect(executeOwnerAction).toHaveBeenCalledWith({
    notificationId: 'undoable',
    operationId: 'undo-operation',
    action: 'undo',
    target: { kind: 'transaction', transactionId: 'tx-1' },
    sourceVersion: 1
  });

  await service.executeAction('undoable', 'view', 'view-operation');
  expect(executeOwnerAction).toHaveBeenCalledTimes(1);
});

test('refreshes denied, permanently denied, unavailable, and restored phone permission into preferences', async () => {
  const phone = {
    getPermission: jest
      .fn()
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('permanently_denied')
      .mockResolvedValueOnce('unavailable'),
    requestPermission: jest.fn().mockResolvedValueOnce('granted'),
    presentLocal: jest.fn()
  };
  const service = createMockAssistantNotificationsService({ repository: repository(), phone });

  expect(await service.refreshPermission()).toBe('denied');
  expect((await service.getPreferences()).permissionState).toBe('denied');
  expect(await service.refreshPermission()).toBe('permanently_denied');
  expect(await service.refreshPermission()).toBe('unavailable');
  expect(await service.requestPermissionAfterEducation()).toBe('granted');
  expect((await service.getPreferences()).permissionState).toBe('granted');
  expect(phone.requestPermission).toHaveBeenCalledTimes(1);
});

test('keeps in-app events while mapping deterministic phone presentation outcomes', async () => {
  const enabledPreferences = {
    ...createNotificationPreferences(1),
    phoneEnabled: true,
    permissionState: 'granted' as const,
    dailySummary: { enabled: true, time: '09:00' },
    categoryEnabled: { ...createNotificationPreferences(1).categoryEnabled, budget: false }
  };
  const phone = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    presentLocal: jest
      .fn()
      .mockResolvedValueOnce({ status: 'presented', identifier: 'phone-1' })
      .mockRejectedValueOnce(new Error('native failed'))
  };
  const service = createMockAssistantNotificationsService({
    repository: repository(enabledPreferences),
    now: () => Date.UTC(2026, 0, 1, 10),
    phone
  });

  expect((await service.createFromSource(event('presented'))).phoneStatus).toBe('presented_local');
  expect((await service.createFromSource(event('failed')))).toMatchObject({ phoneStatus: 'failed_mock', syncStatus: 'failed', safeFailure: 'unavailable' });
  expect(await service.createFromSource(event('duplicate-presented', { eventKey: 'event-presented' }))).toMatchObject({ id: 'presented', phoneStatus: 'presented_local' });
  expect((await service.createFromSource(event('disabled', { category: 'budget' }))).phoneStatus).toBe('suppressed_preference');
  expect((await service.createFromSource(event('private', { sensitivity: 'security_sensitive' }))).phoneStatus).toBe('suppressed_private');
  const expired = await service.createFromSource(event('expired', { availableActions: [{ kind: 'undo', expiresAt: 99, sourceVersion: 1 }] }));
  expect(expired).toMatchObject({ phoneStatus: 'failed_mock', safeFailure: 'expired' });
  expect((await service.list({})).total).toBe(5);
  expect(phone.presentLocal).toHaveBeenCalledTimes(2);

  expect((await createMockAssistantNotificationsService({
    repository: repository({ ...enabledPreferences, permissionState: 'denied' }),
    phone
  }).createFromSource(event('denied'))).phoneStatus).toBe('permission_denied');
  expect((await createMockAssistantNotificationsService({
    repository: repository({
      ...enabledPreferences,
      quietHours: { enabled: true, start: '22:00', end: '07:00', weekdays: [4], timeZone: 'Asia/Riyadh' }
    }),
    now: () => Date.UTC(2026, 0, 1, 20, 30),
    phone
  }).createFromSource(event('quiet'))).phoneStatus).toBe('deferred');
  expect((await createMockAssistantNotificationsService({
    repository: repository(enabledPreferences),
    summaryWindow: 'daily',
    phone
  }).createFromSource(event('summary'))).phoneStatus).toBe('summarized');
  expect((await createMockAssistantNotificationsService({
    repository: repository(enabledPreferences),
    now: () => Date.UTC(2026, 0, 1, 10)
  }).createFromSource(event('no-adapter'))).phoneStatus).toBe('not_requested');

  const concurrentPhone = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'phone-2' })
  };
  const concurrent = createMockAssistantNotificationsService({
    repository: repository(enabledPreferences),
    now: () => Date.UTC(2026, 0, 1, 10),
    phone: concurrentPhone
  });
  const [first, replay] = await Promise.all([
    concurrent.createFromSource(event('concurrent')),
    concurrent.createFromSource(event('concurrent-replay', { eventKey: 'event-concurrent' }))
  ]);
  expect(replay).toEqual(first);
  expect(concurrentPhone.presentLocal).toHaveBeenCalledTimes(1);

  await concurrent.markRead('concurrent', true);
  expect((await concurrent.createFromSource(event('concurrent-again', { eventKey: 'event-concurrent' }))).readAt).toEqual(expect.any(Number));
});

test('creates one daily summary event with covered period and grouped count without individual phone presentation', async () => {
  const preferences = {
    ...createNotificationPreferences(1),
    phoneEnabled: true,
    permissionState: 'granted' as const,
    quietHours: { ...createNotificationPreferences(1).quietHours, timeZone: 'Asia/Riyadh' },
    dailySummary: { enabled: true, time: '09:00' }
  };
  const phone = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'summary-phone' })
  };
  const service = createMockAssistantNotificationsService({
    repository: repository(preferences),
    summaryWindow: 'daily',
    now: () => Date.UTC(2026, 0, 1, 12),
    phone
  });

  const [transaction, budget] = await Promise.all([
    service.createFromSource(event('daily-1', { occurredAt: Date.UTC(2025, 11, 31, 21, 30) })),
    service.createFromSource(event('daily-2', { category: 'budget', occurredAt: Date.UTC(2026, 0, 1, 10) }))
  ]);
  expect(transaction.phoneStatus).toBe('summarized');
  expect(budget.phoneStatus).toBe('summarized');

  const summary = await service.get('notification-summary-daily-2026-01-01');
  expect(summary).toMatchObject({
    eventKey: 'summary:daily:2026-01-01',
    category: 'system',
    eventType: 'daily_summary',
    phoneStatus: 'presented_local',
    messageValues: {
      count: 2,
      transactionCount: 1,
      budgetCount: 1,
      coveredStart: '2026-01-01',
      coveredEnd: '2026-01-02',
      periodKind: 'daily'
    }
  });
  expect(phone.presentLocal).toHaveBeenCalledTimes(1);
  expect(phone.presentLocal).toHaveBeenCalledWith(expect.objectContaining({ notificationId: summary.id }));
  expect((await service.list({})).total).toBe(3);

  await service.delete('daily-2', 'delete-budget-source');
  await service.createFromSource(event('daily-3', { occurredAt: Date.UTC(2026, 0, 1, 11) }));
  const rebuilt = await service.get('notification-summary-daily-2026-01-01');
  expect(rebuilt.messageValues).toMatchObject({ count: 2, transactionCount: 2 });
  expect(rebuilt.messageValues).not.toHaveProperty('budgetCount');
});

test('creates weekly summary covered periods from the configured weekday', async () => {
  const preferences = {
    ...createNotificationPreferences(1),
    phoneEnabled: true,
    permissionState: 'granted' as const,
    weeklySummary: { enabled: true, weekday: 1, time: '09:00' }
  };
  const service = createMockAssistantNotificationsService({
    repository: repository(preferences),
    summaryWindow: 'weekly',
    now: () => Date.UTC(2026, 0, 7, 12),
    phone: {
      getPermission: jest.fn(),
      requestPermission: jest.fn(),
      presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'weekly-summary-phone' })
    }
  });

  await service.createFromSource(event('weekly-1', { occurredAt: Date.UTC(2026, 0, 7, 9) }));
  await service.createFromSource(event('weekly-2', { category: 'budget', occurredAt: Date.UTC(2026, 0, 8, 9) }));

  expect(await service.get('notification-summary-weekly-2026-01-05')).toMatchObject({
    eventKey: 'summary:weekly:2026-01-05',
    eventType: 'weekly_summary',
    messageValues: {
      count: 2,
      transactionCount: 1,
      budgetCount: 1,
      coveredStart: '2026-01-05',
      coveredEnd: '2026-01-12',
      periodKind: 'weekly'
    }
  });
});

test('recovers summary membership after a failed first aggregation and enables production summaries', async () => {
  const preferences = {
    ...createNotificationPreferences(1),
    phoneEnabled: true,
    permissionState: 'granted' as const,
    dailySummary: { enabled: true, time: '09:00' }
  };
  const store = repository(preferences);
  const upsert = store.upsertNotification.bind(store);
  store.upsertNotification = jest.fn()
    .mockRejectedValueOnce(new Error('write_failed'))
    .mockImplementation(upsert);
  const service = createMockAssistantNotificationsService({
    repository: store,
    summaryWindow: 'daily',
    now: () => Date.UTC(2026, 0, 1, 12)
  });

  await expect(service.createFromSource(event('retry-summary', { occurredAt: Date.UTC(2026, 0, 1, 10) }))).rejects.toThrow('write_failed');
  expect((await service.createFromSource(event('retry-summary', { occurredAt: Date.UTC(2026, 0, 1, 10) }))).phoneStatus).toBe('summarized');
  expect(await service.get('notification-summary-daily-2026-01-01')).toMatchObject({
    messageValues: { count: 1, transactionCount: 1 }
  });

  const production = createMockAssistantNotificationsService({
    repository: repository(preferences),
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 1, 12)
  });
  expect((await production.createFromSource(event('production-summary', { occurredAt: Date.UTC(2026, 0, 1, 10) }))).phoneStatus).toBe('summarized');
  expect(await production.get('notification-summary-daily-2026-01-01')).toMatchObject({
    messageValues: { count: 1, transactionCount: 1 }
  });
});

test('does not double-count summarized source replay after service restart or present all-mode immediately', async () => {
  const preferences = {
    ...createNotificationPreferences(1),
    phoneEnabled: true,
    permissionState: 'granted' as const,
    dailySummary: { enabled: true, time: '09:00' },
    weeklySummary: { enabled: true, weekday: 4, time: '17:00' }
  };
  const shared = repository(preferences);
  const firstService = createMockAssistantNotificationsService({
    repository: shared,
    summaryWindow: 'daily',
    now: () => Date.UTC(2026, 0, 1, 12)
  });
  await firstService.createFromSource(event('restart-summary', { occurredAt: Date.UTC(2026, 0, 1, 10) }));

  const restartedService = createMockAssistantNotificationsService({
    repository: shared,
    summaryWindow: 'daily',
    now: () => Date.UTC(2026, 0, 1, 12)
  });
  await restartedService.createFromSource(event('restart-summary', { occurredAt: Date.UTC(2026, 0, 1, 10) }));
  expect(await restartedService.get('notification-summary-daily-2026-01-01')).toMatchObject({
    messageValues: { count: 1, transactionCount: 1 }
  });
  expect(JSON.stringify(await restartedService.get('notification-summary-daily-2026-01-01'))).not.toContain('event-restart-summary');

  const phone = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'too-soon' })
  };
  const production = createMockAssistantNotificationsService({
    repository: repository(preferences),
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 1, 5),
    phone
  });
  await production.createFromSource(event('all-mode', { occurredAt: Date.UTC(2026, 0, 1, 10) }));
  expect(await production.get('notification-summary-daily-2026-01-01')).toMatchObject({ phoneStatus: 'not_requested' });
  expect(await production.get('notification-summary-weekly-2026-01-01')).toMatchObject({ phoneStatus: 'not_requested' });
  expect(phone.presentLocal).not.toHaveBeenCalled();

  const dueStore = repository(preferences);
  const beforeWindow = createMockAssistantNotificationsService({
    repository: dueStore,
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 1, 5),
    phone
  });
  await beforeWindow.createFromSource(event('before-window', { occurredAt: Date.UTC(2026, 0, 1, 5) }));
  const dueFlush = createMockAssistantNotificationsService({
    repository: dueStore,
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 2, 7),
    phone
  });
  await Promise.all([dueFlush.list({}), dueFlush.list({})]);
  expect(await dueFlush.get('notification-summary-daily-2026-01-01')).toMatchObject({ phoneStatus: 'presented_local' });
  expect(await dueFlush.get('notification-summary-weekly-2026-01-01')).toMatchObject({ phoneStatus: 'not_requested' });
  expect(phone.presentLocal).toHaveBeenCalledTimes(1);

  const disabledPhone = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'disabled' })
  };
  const disabledStore = repository(preferences);
  await createMockAssistantNotificationsService({
    repository: disabledStore,
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 1, 5),
    phone: disabledPhone
  }).createFromSource(event('disabled-daily', { occurredAt: Date.UTC(2026, 0, 1, 5) }));
  await disabledStore.saveNotificationPreferences({
    ...preferences,
    version: 2,
    dailySummary: { enabled: false, time: '09:00' },
    updatedAt: 2
  });
  const disabledFlush = createMockAssistantNotificationsService({
    repository: disabledStore,
    summaryWindow: 'all',
    now: () => Date.UTC(2026, 0, 2, 7),
    phone: disabledPhone
  });
  await disabledFlush.list({});
  expect(await disabledFlush.get('notification-summary-daily-2026-01-01')).toMatchObject({ phoneStatus: 'not_requested' });
  expect(disabledPhone.presentLocal).not.toHaveBeenCalled();

  for (const blocked of [
    { phoneEnabled: false, permissionState: 'granted' as const },
    { phoneEnabled: true, permissionState: 'denied' as const },
    { phoneEnabled: true, permissionState: 'unavailable' as const }
  ]) {
    const blockedPhone = {
      getPermission: jest.fn(),
      requestPermission: jest.fn(),
      presentLocal: jest.fn().mockResolvedValue({ status: 'presented', identifier: 'blocked' })
    };
    const blockedStore = repository(preferences);
    await createMockAssistantNotificationsService({
      repository: blockedStore,
      summaryWindow: 'all',
      now: () => Date.UTC(2026, 0, 1, 5),
      phone: blockedPhone
    }).createFromSource(event(`blocked-${blocked.permissionState}-${blocked.phoneEnabled}`, { occurredAt: Date.UTC(2026, 0, 1, 5) }));
    await blockedStore.saveNotificationPreferences({
      ...preferences,
      ...blocked,
      version: 2,
      updatedAt: 2
    });
    await createMockAssistantNotificationsService({
      repository: blockedStore,
      summaryWindow: 'all',
      now: () => Date.UTC(2026, 0, 2, 7),
      phone: blockedPhone
    }).createFromSource(event(`blocked-${blocked.permissionState}-${blocked.phoneEnabled}`, { occurredAt: Date.UTC(2026, 0, 1, 5) }));
    await createMockAssistantNotificationsService({
      repository: blockedStore,
      summaryWindow: 'all',
      now: () => Date.UTC(2026, 0, 2, 7),
      phone: blockedPhone
    }).list({});
    expect(blockedPhone.presentLocal).not.toHaveBeenCalled();
  }
});
