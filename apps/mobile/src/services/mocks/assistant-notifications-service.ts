import {
  createNotificationPreferences,
  type NotificationActionKind,
  type NotificationEvent,
  type NotificationPermissionState,
  type NotificationPreferences,
  type NotificationTarget,
  type NotificationTargetResolution
} from '@/domain/notifications';
import { decideNotificationPolicy, rewritePhoneCopy } from '@/features/notifications/notification-policy';
import type {
  NotificationActionResult,
  NotificationService,
  PhoneNotificationService,
  NotificationSourceEvent
} from '@/services/contracts/assistant-notifications-service';
import { notificationServiceCapability } from '@/services/contracts/assistant-notifications-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import type { MutationResult } from '@/services/contracts/core-finance-service';
import { translateDynamicOr } from '@/localization/i18n';
import { AssistantNotificationsRepository } from '@/storage/assistant-notifications-repository';
import { registerRuntimeUserDataReset } from '@/storage/runtime-user-data-reset';
import { coreFinanceService } from './core-finance-service';

type NotificationRepository = Pick<
  AssistantNotificationsRepository,
  | 'getNotification'
  | 'getNotificationPreferences'
  | 'listNotifications'
  | 'markAllNotificationsRead'
  | 'markNotificationRead'
  | 'saveNotification'
  | 'saveNotificationPreferences'
  | 'tombstoneNotification'
  | 'updateNotificationPhoneStatus'
  | 'upsertNotification'
>;

type SummaryWindow = 'none' | 'daily' | 'weekly' | 'all';

type TargetResolutionWithVersion = NotificationTargetResolution & {
  sourceVersion: number | null;
};

type ActionResolution = Awaited<ReturnType<NotificationService['revalidateAction']>>;
type ValidatedActionResolution = ActionResolution & { sourceVersion: number | null };

const lazyPhoneNotificationService: Pick<
  PhoneNotificationService,
  'getPermission' | 'requestPermission' | 'presentLocal'
> = {
  async getPermission() {
    const { phoneNotificationService } = await import(
      '@/services/platform/phone-notification-service'
    );
    return phoneNotificationService.getPermission();
  },
  async requestPermission() {
    const { phoneNotificationService } = await import(
      '@/services/platform/phone-notification-service'
    );
    return phoneNotificationService.requestPermission();
  },
  async presentLocal(input) {
    const { phoneNotificationService } = await import(
      '@/services/platform/phone-notification-service'
    );
    return phoneNotificationService.presentLocal(input);
  }
};

export type NotificationOwnerActionInput = {
  notificationId: string;
  operationId: string;
  action: 'undo';
  target: NotificationTarget;
  sourceVersion: number | null;
};

export function createMockAssistantNotificationsService({
  repository = new AssistantNotificationsRepository(),
  now = Date.now,
  resolveTarget = defaultTargetResolution,
  executeOwnerAction,
  phone,
  hideBalances = false,
  summaryWindow = 'none',
  summarizedEventKeys = [],
  registerForReset = false
}: {
  repository?: NotificationRepository;
  now?: () => number;
  resolveTarget?: (target: NotificationTarget | null) => Promise<TargetResolutionWithVersion>;
  executeOwnerAction?: (input: NotificationOwnerActionInput) => Promise<void>;
  phone?: Pick<PhoneNotificationService, 'getPermission' | 'requestPermission' | 'presentLocal'>;
  hideBalances?: boolean;
  summaryWindow?: SummaryWindow;
  summarizedEventKeys?: readonly string[];
  registerForReset?: boolean;
} = {}): CapabilityProviderHandle<NotificationService> {
  const markAllResults = new Map<string, MutationResult<number>>();
  const deleteResults = new Map<string, MutationResult<{ id: string }>>();
  const actionResults = new Map<string, Promise<MutationResult<NotificationActionResult>>>();
  const sourceResults = new Map<string, Promise<NotificationEvent>>();
  const summaryResults = new Map<string, Promise<NotificationEvent | void>>();
  const summaryPresentations = new Map<string, Promise<NotificationEvent>>();
  if (registerForReset)
    registerRuntimeUserDataReset(() => {
      markAllResults.clear();
      deleteResults.clear();
      actionResults.clear();
    });

  async function validateAction(id: string, action: NotificationActionKind): Promise<ValidatedActionResolution> {
    const event = await repository.getNotification(id);
    const available = event.availableActions.find((item) => item.kind === action);
    if (!available) return { status: 'unavailable', target: event.target, action, sourceVersion: null };
    const resolution = event.deletedAt === null
      ? await resolveTarget(event.target)
      : { status: 'unavailable' as const, target: null, sourceVersion: null };
    if (resolution.status === 'unlock_required') return { status: 'unlock_required', target: resolution.target, action, sourceVersion: available.sourceVersion };
    if (resolution.status !== 'exact' || !resolution.target) return { status: 'unavailable', target: resolution.target, action, sourceVersion: available.sourceVersion };
    if (available.expiresAt !== null && available.expiresAt <= now()) return { status: 'expired', target: resolution.target, action, sourceVersion: available.sourceVersion };
    if (available.sourceVersion !== null && available.sourceVersion !== resolution.sourceVersion) return { status: 'unavailable', target: resolution.target, action, sourceVersion: available.sourceVersion };
    return { status: 'available', target: resolution.target, action, sourceVersion: available.sourceVersion };
  }

  async function loadPreferences(): Promise<NotificationPreferences> {
    try {
      return await repository.getNotificationPreferences();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'not_found') throw error;
      const value = createNotificationPreferences(now());
      return repository.saveNotificationPreferences(value, null);
    }
  }

  async function saveObservedPermission(permissionState: NotificationPermissionState) {
    const current = await loadPreferences();
    await repository.saveNotificationPreferences(
      { ...current, permissionState, version: current.version + 1, updatedAt: now() },
      current.version
    );
    return permissionState;
  }

  async function phoneFields(event: NotificationEvent): Promise<Pick<NotificationEvent, 'phoneStatus' | 'syncStatus' | 'safeFailure'>> {
    if (event.availableActions.length > 0 && event.availableActions.every((action) => action.expiresAt !== null && action.expiresAt <= now())) {
      return { phoneStatus: 'failed_mock', syncStatus: 'failed', safeFailure: 'expired' };
    }
    const preferences = await loadPreferences();
    const activeSummaryWindow = policySummaryWindow(preferences, summaryWindow);
    const policy = decideNotificationPolicy({
      event,
      preferences,
      permission: preferences.permissionState,
      now: now(),
      hideBalances,
      summaryWindow: activeSummaryWindow,
      summarizedEventKeys
    });
    if (policy.outcome === 'present_local') {
      if (!phone) return { phoneStatus: 'not_requested', syncStatus: 'synced', safeFailure: null };
      const copy = rewritePhoneCopy(event, { hideSensitiveValues: policy.hideSensitiveValues });
      const presentation = await Promise.resolve(phone.presentLocal({
          notificationId: event.id,
          title: translateDynamicOr(copy.titleKey, 'notifications.fallback.title', copy.messageValues),
          body: translateDynamicOr(copy.bodyKey, 'notifications.fallback.body', copy.messageValues),
          categoryId: 'financial-change'
        }))
        .catch(() => ({ status: 'failed' as const, identifier: null }));
      if (presentation?.status === 'presented') return { phoneStatus: 'presented_local', syncStatus: 'synced', safeFailure: null };
      if (presentation?.status === 'suppressed') return { phoneStatus: 'suppressed_preference', syncStatus: 'synced', safeFailure: null };
      return { phoneStatus: 'failed_mock', syncStatus: 'failed', safeFailure: 'unavailable' };
    }
    if (policy.outcome === 'suppress_permission') return { phoneStatus: 'permission_denied', syncStatus: 'synced', safeFailure: null };
    if (policy.outcome === 'suppress_private') return { phoneStatus: 'suppressed_private', syncStatus: 'synced', safeFailure: null };
    if (policy.outcome === 'defer_quiet_hours') return { phoneStatus: 'deferred', syncStatus: 'synced', safeFailure: null };
    if (policy.outcome === 'include_daily_summary' || policy.outcome === 'include_weekly_summary') return { phoneStatus: 'summarized', syncStatus: 'synced', safeFailure: null };
    return { phoneStatus: 'suppressed_preference', syncStatus: 'synced', safeFailure: null };
  }

  async function updateSummaryEvent(event: NotificationEvent) {
    const preferences = await loadPreferences();
    for (const kind of summaryKinds(preferences, summaryWindow)) {
      const period = summaryPeriod(event.occurredAt, kind, preferences.weeklySummary.weekday, preferences.quietHours.timeZone);
      const id = `notification-summary-${kind}-${period.start}`;
      const previous = summaryResults.get(id) ?? Promise.resolve();
      const current = previous.catch(() => undefined).then(() => writeSummaryEvent(kind, preferences, period, id));
      summaryResults.set(id, current);
      try {
        await current;
      } finally {
        if (summaryResults.get(id) === current) summaryResults.delete(id);
      }
    }
    if (summaryWindow === 'all') await flushDueSummaries(preferences);
  }

  async function writeSummaryEvent(
    kind: 'daily' | 'weekly',
    preferences: NotificationPreferences,
    period: { start: string; end: string },
    id: string
  ) {
    let existing: NotificationEvent | null = null;
    try {
      existing = await repository.getNotification(id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'not_found') throw error;
    }
    const members = (await listAllNotifications()).filter((item) =>
      item.phoneStatus === 'summarized' &&
      !item.eventKey.startsWith('summary:') &&
      summaryPeriod(item.occurredAt, kind, preferences.weeklySummary.weekday, preferences.quietHours.timeZone).start === period.start
    );
    const counts = members.reduce<Record<string, number>>((totals, item) => {
      const key = `${item.category}Count`;
      totals[key] = (totals[key] ?? 0) + 1;
      return totals;
    }, {});
    const summary: NotificationEvent = {
      id,
      eventKey: `summary:${kind}:${period.start}`,
      category: 'system',
      eventType: `${kind}_summary`,
      titleKey: `notifications.summary.${kind}.title`,
      bodyKey: `notifications.summary.${kind}.body`,
      messageValues: {
        ...counts,
        count: members.length,
        coveredStart: period.start,
        coveredEnd: period.end,
        periodKind: kind
      },
      sensitivity: 'public',
      target: null,
      availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: null }],
      occurredAt: now(),
      readAt: existing?.readAt ?? null,
      deletedAt: existing?.deletedAt ?? null,
      phoneStatus: existing?.phoneStatus ?? 'not_requested',
      syncStatus: existing?.syncStatus ?? 'synced',
      safeFailure: existing?.safeFailure ?? null
    };
    const saved = await repository.upsertNotification(summary);
    if (!phone || saved.phoneStatus === 'presented_local') return saved;
    if (summaryWindow === 'all' && !summaryDue(kind, preferences, period, now())) return saved;
    if (summaryWindow !== 'all' && existing) return saved;
    return presentSummary(saved, preferences);
  }

  async function flushDueSummaries(preferences: NotificationPreferences) {
    if (!phone || !preferences.phoneEnabled || preferences.permissionState !== 'granted') return;
    for (const summary of await listAllNotifications()) {
      const kind = summary.eventType === 'daily_summary' ? 'daily' : summary.eventType === 'weekly_summary' ? 'weekly' : null;
      const coveredEnd = summary.messageValues.coveredEnd;
      if (!kind || typeof coveredEnd !== 'string' || summary.phoneStatus === 'presented_local') continue;
      if (kind === 'daily' && !preferences.dailySummary.enabled) continue;
      if (kind === 'weekly' && !preferences.weeklySummary.enabled) continue;
      if (summaryDue(kind, preferences, { end: coveredEnd }, now())) await presentSummary(summary, preferences);
    }
  }

  async function presentSummary(saved: NotificationEvent, preferences: NotificationPreferences) {
    if (!phone || !preferences.phoneEnabled || preferences.permissionState !== 'granted') return saved;
    const replay = summaryPresentations.get(saved.id);
    if (replay) return replay;
    const presentation = (async () => {
      const result = await Promise.resolve(phone.presentLocal({
        notificationId: saved.id,
        title: translateDynamicOr(saved.titleKey, 'notifications.fallback.title', saved.messageValues),
        body: translateDynamicOr(saved.bodyKey, 'notifications.fallback.body', saved.messageValues),
        categoryId: 'financial-change'
      }))
      .catch(() => ({ status: 'failed' as const, identifier: null }));
      return repository.updateNotificationPhoneStatus(saved.id, result?.status === 'presented'
        ? { phoneStatus: 'presented_local', syncStatus: 'synced', safeFailure: null }
        : { phoneStatus: 'failed_mock', syncStatus: 'failed', safeFailure: 'unavailable' });
    })();
    summaryPresentations.set(saved.id, presentation);
    try {
      return await presentation;
    } finally {
      summaryPresentations.delete(saved.id);
    }
  }

  async function listAllNotifications() {
    const items: NotificationEvent[] = [];
    let cursor: string | undefined;
    do {
      const page = await repository.listNotifications({ cursor, pageSize: 100 });
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  return {
    metadata: {
      id: 'mock-assistant-notifications',
      capability: notificationServiceCapability.capability,
      majorVersion: notificationServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    async list(input) {
      if (summaryWindow === 'all') await flushDueSummaries(await loadPreferences());
      return repository.listNotifications(input);
    },
    get: (id) => repository.getNotification(id),
    async createFromSource(input) {
      const replay = sourceResults.get(input.eventKey);
      if (replay) return replay;
      const creation = (async () => {
        const value = input as NotificationSourceEvent & Partial<NotificationEvent>;
        const event = {
          ...input,
          id: value.id ?? `notification-${input.eventKey}`,
          readAt: null,
          deletedAt: null,
          phoneStatus: 'not_requested',
          syncStatus: 'synced',
          safeFailure: null
        } satisfies NotificationEvent;
        const saved = await repository.saveNotification(event);
        if (saved.id !== event.id || saved.phoneStatus !== 'not_requested') {
          if (saved.phoneStatus === 'summarized') await updateSummaryEvent(saved);
          return saved;
        }
        const updated = await repository.updateNotificationPhoneStatus(saved.id, await phoneFields(saved));
        if (updated.phoneStatus === 'summarized') await updateSummaryEvent(updated);
        return updated;
      })();
      sourceResults.set(input.eventKey, creation);
      try {
        return await creation;
      } catch (error) {
        throw error;
      } finally {
        sourceResults.delete(input.eventKey);
      }
    },
    async markRead(id, read) {
      return mutation(
        await repository.markNotificationRead(id, read ? now() : null),
        notificationScopes(id, 'mark-read')
      );
    },
    async markAllRead(filter, operationId) {
      const replay = markAllResults.get(operationId);
      if (replay) return replay;
      const result = mutation(
        await repository.markAllNotificationsRead(filter, now()),
        ['notifications.list', 'notifications.unread', `notifications.mark-all.${filter.category ?? 'all'}`]
      );
      markAllResults.set(operationId, result);
      return result;
    },
    async delete(id, operationId) {
      const replay = deleteResults.get(operationId);
      if (replay) return replay;
      await repository.tombstoneNotification(id, now());
      const result = mutation({ id }, notificationScopes(id, 'delete'));
      deleteResults.set(operationId, result);
      return result;
    },
    async getPreferences() {
      const preferences = await loadPreferences();
      if (summaryWindow === 'all') await flushDueSummaries(preferences);
      return preferences;
    },
    async savePreferences(input, expectedVersion) {
      const current = await this.getPreferences();
      return mutation(
        await repository.saveNotificationPreferences(
          { ...input, version: current.version + 1, updatedAt: now() },
          expectedVersion
        ),
        ['notifications.preferences']
      );
    },
    async refreshPermission() {
      return phone ? saveObservedPermission(await phone.getPermission()) : (await loadPreferences()).permissionState;
    },
    async requestPermissionAfterEducation() {
      return phone ? saveObservedPermission(await phone.requestPermission()) : (await loadPreferences()).permissionState;
    },
    async resolveTarget(id) {
      const event = await repository.getNotification(id);
      const resolution = event.deletedAt === null
        ? await resolveTarget(event.target)
        : { status: 'unavailable' as const, target: null, sourceVersion: null };
      return { status: resolution.status, target: resolution.target };
    },
    async revalidateAction(id, action) {
      const { sourceVersion: _, ...resolution } = await validateAction(id, action);
      return resolution;
    },
    async executeAction(id, action, operationId) {
      const replay = actionResults.get(operationId);
      if (replay) return replay;
      const execution = (async () => {
        const resolution = await validateAction(id, action);
        if (resolution.status !== 'available' || !resolution.target) throw new Error(resolution.status);
        if (action === 'undo') {
          if (!executeOwnerAction) throw new Error('owner_action_unavailable');
          await executeOwnerAction({ notificationId: id, operationId, action, target: resolution.target, sourceVersion: resolution.sourceVersion });
        }
        return mutation({ id, target: resolution.target }, notificationScopes(id, 'action'));
      })();
      actionResults.set(operationId, execution);
      try {
        return await execution;
      } catch (error) {
        actionResults.delete(operationId);
        throw error;
      }
    }
  };
}

export const assistantNotificationsService = createMockAssistantNotificationsService({
  phone: lazyPhoneNotificationService,
  summaryWindow: 'all',
  registerForReset: true,
  executeOwnerAction: async ({ target }) => {
    if (target.kind !== 'transaction') throw new Error('owner_action_unavailable');
    await coreFinanceService.deleteTransaction(target.transactionId);
  }
});

async function defaultTargetResolution(target: NotificationTarget | null): Promise<TargetResolutionWithVersion> {
  return target
    ? { status: 'exact', target, sourceVersion: 1 }
    : { status: 'unavailable', target: null, sourceVersion: null };
}

function notificationScopes(id: string, operation: string): readonly string[] {
  return [`notifications.detail.${id}`, 'notifications.list', 'notifications.unread', `notifications.${operation}.${id}`];
}

function mutation<T>(value: T, affectedScopes: readonly string[]): MutationResult<T> {
  return { value, affectedScopes };
}

function policySummaryWindow(preferences: NotificationPreferences, summaryWindow: SummaryWindow = 'none'): 'none' | 'daily' | 'weekly' {
  if (summaryWindow === 'daily' || summaryWindow === 'weekly') return summaryWindow;
  if (summaryWindow === 'all') {
    if (preferences.dailySummary.enabled) return 'daily';
    if (preferences.weeklySummary.enabled) return 'weekly';
  }
  return 'none';
}

function summaryKinds(preferences: NotificationPreferences, summaryWindow: SummaryWindow = 'none'): ('daily' | 'weekly')[] {
  if (summaryWindow === 'daily' || summaryWindow === 'weekly') return [summaryWindow];
  if (summaryWindow !== 'all') return [];
  return [
    preferences.dailySummary.enabled ? 'daily' as const : null,
    preferences.weeklySummary.enabled ? 'weekly' as const : null
  ].filter((item): item is 'daily' | 'weekly' => item !== null);
}

function summaryDue(kind: 'daily' | 'weekly', preferences: NotificationPreferences, period: { end: string }, value: number) {
  const today = localDate(value, preferences.quietHours.timeZone);
  if (today > period.end) return true;
  if (today < period.end) return false;
  const dueTime = kind === 'daily' ? preferences.dailySummary.time : preferences.weeklySummary.time;
  return minutes(localTime(value, preferences.quietHours.timeZone)) >= minutes(dueTime);
}

function summaryPeriod(value: number, kind: 'daily' | 'weekly', weekStart: number, timeZone: string) {
  const localDay = localDate(value, timeZone);
  if (kind === 'daily') return { start: localDay, end: addDays(localDay, 1) };
  const weekday = new Date(`${localDay}T00:00:00.000Z`).getUTCDay();
  const start = addDays(localDay, -((weekday - weekStart + 7) % 7));
  return { start, end: addDays(start, 7) };
}

function localDate(value: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function localTime(value: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('hour')}:${part('minute')}`;
}

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
