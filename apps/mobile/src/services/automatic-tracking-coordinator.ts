import * as Crypto from 'expo-crypto';
import { getTrackingDeviceId } from './tracking-device';
import { reconcileTrackingSaves } from './tracking-save-confirmation';
import { configureTrackingBackground } from './tracking-background-runtime';

import { resolveClientMode } from '@/config/client-runtime';
import type {
  KeywordRuleSummary,
  SenderRule,
  TrackingImportSession,
  TrackingMode,
  TrackingStatusSnapshot
} from '@/domain/automatic-tracking';
import type { Account } from '@/domain/core-finance';
import type { KeywordRule } from '@/domain/app-shell';
import {
  prepareFinancialMessageImport,
  type PreparedSmsImport
} from '@/features/tracking/sms-import';
import { useAppShellStore } from '@/state/app-shell';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  SmsImportQueue,
  type SmsImportQueueEntry,
  type SmsRuleSnapshot
} from '@/storage/sms-import-queue';
import { automaticTrackingService } from './automatic-tracking-service';
import type { AutomaticTrackingService } from './contracts/automatic-tracking-service';
import type { TrackingPermissionService } from './contracts/app-shell-service';
import type { CoreFinanceService } from './contracts/core-finance-service';
import { coreFinanceService } from './mocks/core-finance-service';
import { createTrackingPermissionService } from './platform/tracking-permission-service';
import {
  smsInboxService,
  type SmsInboxService
} from './platform/sms-inbox-service';
import {
  bankNotificationService,
  type BankNotificationService
} from './platform/bank-notification-service';
import {
  trackingSourcePreferences,
  trackingConsentEpoch,
  type TrackingSourcePreferences
} from './tracking-source-preferences';

export type AutomaticTrackingSyncStatus =
  | 'idle'
  | 'scanning'
  | 'queued'
  | 'processing'
  | 'imported'
  | 'review'
  | 'duplicate'
  | 'account_required'
  | 'error';

export interface AutomaticTrackingSyncState {
  status: AutomaticTrackingSyncStatus;
  sessionId: string | null;
  reviewId: string | null;
  duplicateId: string | null;
  errorCode: string | null;
}

interface CoordinatorDependencies {
  isLive(): boolean;
  session(): { status: string; userId: string | null } | null;
  offlineMode(): TrackingMode | null;
  tracking: Pick<
    AutomaticTrackingService,
    | 'getStatus'
    | 'listKeywordRules'
    | 'listSenderRules'
    | 'submitImport'
    | 'getImportSession'
    | 'listImportItemIds'
    | 'listReviewItems'
    | 'listDuplicates'
    | 'getRuleConfiguration'
    | 'listImportOutcomes'
  >;
  permission: Pick<TrackingPermissionService, 'getState'>;
  inbox: SmsInboxService;
  bankNotifications: BankNotificationService;
  sources: Pick<TrackingSourcePreferences, 'load'>;
  listAccounts: CoreFinanceService['listAccounts'];
  listCachedAccounts(): Promise<Account[]>;
  queue: SmsImportQueue;
  prepare: typeof prepareFinancialMessageImport;
  now(): number;
  deviceId?(): Promise<string>;
  onSaved?(ownerId: string, sessionId: string): Promise<boolean | void>;
  configureBackground?(
    ownerId: string,
    rules: SmsRuleSnapshot,
    mode?: string,
    epoch?: number
  ): Promise<void>;
}

const idleState: AutomaticTrackingSyncState = {
  status: 'idle',
  sessionId: null,
  reviewId: null,
  duplicateId: null,
  errorCode: null
};

export function createAutomaticTrackingCoordinator(
  dependencies: CoordinatorDependencies
) {
  let state = idleState;
  let running: Promise<AutomaticTrackingSyncState> | null = null;
  const listeners = new Set<() => void>();
  const update = (
    status: AutomaticTrackingSyncStatus,
    patch: Partial<AutomaticTrackingSyncState> = {}
  ) => {
    state = { ...idleState, status, ...patch };
    listeners.forEach((listener) => listener());
    return state;
  };

  const execute = async (
    requireFreshConfiguration = false
  ): Promise<AutomaticTrackingSyncState> => {
    const session = dependencies.session();
    if (
      !dependencies.isLive() ||
      session?.status !== 'authenticated' ||
      !session.userId
    ) {
      return update('idle');
    }
    try {
      const ownerId = session.userId;
      const epoch = trackingConsentEpoch();
      const queue = await dependencies.queue.load(ownerId);
      const online = await dependencies.inbox.isNetworkAvailable();
      if (requireFreshConfiguration && !online)
        throw new Error('tracking_configuration_refresh_failed');
      let mode = queue.mode ?? dependencies.offlineMode();
      let status: TrackingStatusSnapshot | null = null;
      if (online) {
        status = await dependencies.tracking.getStatus();
        mode = status.mode;
      }
      if (mode === 'paused' || status?.serviceState === 'unavailable') {
        await dependencies.configureBackground?.(
          ownerId,
          queue.rules,
          'paused',
          epoch
        );
        return update('idle');
      }
      const stillOwner = () => {
        if (epoch !== trackingConsentEpoch())
          throw new Error('tracking_consent_changed');
        if (
          dependencies.session()?.userId !== ownerId ||
          dependencies.session()?.status !== 'authenticated'
        )
          throw new Error('tracking_owner_changed');
      };
      let last: AutomaticTrackingSyncState | null = null;
      const sources = await dependencies.sources.load();
      if (online && queue.pending.length)
        last = await flush(
          ownerId,
          queue.pending.filter((entry) =>
            entry.submission.sourceChannel === 'android_notification'
              ? sources.notificationEnabled
              : sources.smsEnabled
          ),
          dependencies,
          update,
          stillOwner
        );
      stillOwner();
      if (!sources.smsEnabled && !sources.notificationEnabled)
        return last ?? update('idle');
      const [permission, notificationAccess] = await Promise.all([
        dependencies.permission.getState(),
        dependencies.bankNotifications.getAccessState()
      ]);
      let config = queue.rules;
      if (online) {
        try {
          config = dependencies.tracking.getRuleConfiguration
            ? await dependencies.tracking.getRuleConfiguration()
            : await onlineRuleSnapshot(dependencies);
          stillOwner();
          await dependencies.queue.saveRules(ownerId, config);
        } catch (error) {
          if (requireFreshConfiguration) throw error;
          /* Keep the complete last-known-good release. Unconfigured capture is held for review. */
        }
      }
      if (config.requiresRefresh) {
        await dependencies.configureBackground?.(ownerId, config, 'paused', epoch);
        throw new Error('tracking_configuration_refresh_failed');
      }
      const rules = cachedRules(config);
      const deviceId = dependencies.deviceId
        ? await dependencies.deviceId()
        : 'legacy-device';
      const accounts = online
        ? await dependencies.listAccounts()
        : await dependencies.listCachedAccounts();
      stillOwner();
      await dependencies.configureBackground?.(
        ownerId,
        config,
        mode ?? undefined,
        epoch
      );
      let cursor =
        queue.cursor ?? Math.max(0, dependencies.now() - 7 * 86_400_000);
      let cursorId = queue.cursorId;
      let fingerprints = new Set(queue.fingerprints);
      let captured = false;
      let accountRequired = false;
      update('scanning');
      // Each pass gives both channels a bounded quantum. Unresolved items are durably queued before progress.
      const capture = async (
        inputs: Parameters<typeof prepareFinancialMessageImport>[0],
        source: 'sms' | 'provider'
      ) => {
        const prepared = await dependencies.prepare(inputs, {
          ...rules,
          accounts,
          knownFingerprints: fingerprints,
          deviceId,
          snapshot: config.snapshot,
          configurationRevision: config.configurationRevision,
          bindings: config.bindings
        });
        prepared.events = prepared.events.filter(
          (event) => !fingerprints.has(event.sourceItemKey)
        );
        accountRequired ||= prepared.accountRequiredCount > 0;
        stillOwner();
        if (config.rolloutMode !== 'automatic')
          for (const event of prepared.events)
            if (event.classification) {
              event.classification.disposition = 'review';
              if (!event.classification.reasonCodes.includes('rollout_review'))
                event.classification.reasonCodes.push('rollout_review');
            }
        if (source === 'sms' && inputs.length) {
          const tail = inputs[inputs.length - 1];
          if (tail && 'body' in tail) {
            cursor = tail.receivedAt;
            cursorId = tail.id;
          }
        }
        const seen = [
          ...prepared.events.map((e) => e.sourceItemKey),
          ...prepared.skippedFingerprints
        ];
        if (prepared.events.length) {
          await dependencies.queue.enqueue(ownerId, {
            idempotencyKey: await importKey(prepared, source),
            submission: {
              schemaVersion: prepared.events.every(
                (e) => e.classification && e.transport
              )
                ? 2
                : 1,
              sourceType: source,
              sourceChannel:
                source === 'sms' ? 'android_sms' : 'android_notification',
              events: prepared.events
            },
            cursor,
            cursorId,
            fingerprints: seen,
            mode: mode ?? undefined
          });
          captured = true;
        } else
          await dependencies.queue.checkpoint(
            ownerId,
            cursor,
            seen,
            mode ?? undefined,
            cursorId
          );
        stillOwner();
        if (source === 'provider')
          await dependencies.bankNotifications.acknowledge(
            prepared.consumedSourceKeys
          );
        fingerprints = new Set([...fingerprints, ...seen]);
      };
      if (sources.notificationEnabled && notificationAccess === 'granted')
        await capture(
          await dependencies.bankNotifications.readRecent(100),
          'provider'
        );
      if (
        sources.smsEnabled &&
        permission.status === 'granted' &&
        dependencies.inbox.available
      ) {
        for (let page = 0; page < 4; page++) {
          const messages = await dependencies.inbox.readRecent({
            since: cursor,
            afterId: cursorId,
            limit: 100
          });
          if (!messages.length) break;
          const priorId = cursorId,
            priorCursor = cursor;
          await capture(messages, 'sms');
          if (
            messages.length < 100 ||
            (priorId === cursorId && priorCursor === cursor)
          )
            break;
        }
      }
      stillOwner();
      const pending = (await dependencies.queue.load(ownerId)).pending;
      if (online && pending.length)
        return await flush(
          ownerId,
          pending.filter((entry) =>
            entry.submission.sourceChannel === 'android_notification'
              ? sources.notificationEnabled
              : sources.smsEnabled
          ),
          dependencies,
          update,
          stillOwner
        );
      return captured
        ? update('queued')
        : (last ?? update(accountRequired ? 'account_required' : 'idle'));
    } catch {
      return update('error', { errorCode: 'sync_failed' });
    }
  };

  return {
    sync(
      requireFreshConfiguration = false
    ): Promise<AutomaticTrackingSyncState> {
      if (running) return running;
      running = execute(requireFreshConfiguration).finally(() => {
        running = null;
      });
      return running;
    },
    async resync(
      requireFreshConfiguration = false
    ): Promise<AutomaticTrackingSyncState> {
      if (running) await running;
      return this.sync(requireFreshConfiguration);
    },
    async updateKeywordConfiguration(
      rules: readonly KeywordRule[],
      expectedOwner: string | null | undefined = dependencies.session()?.userId
    ): Promise<void> {
      if (!dependencies.isLive()) return;
      const epoch = trackingConsentEpoch();
      const current = () =>
        dependencies.session()?.status === 'authenticated' &&
        dependencies.session()?.userId === expectedOwner &&
        epoch === trackingConsentEpoch();
      if (!expectedOwner || !current())
        throw new Error('tracking_owner_changed');
      if (running) await running;
      if (!current()) throw new Error('tracking_owner_changed');
      const queue = await dependencies.queue.load(expectedOwner);
      if (!current()) throw new Error('tracking_owner_changed');
      const config = { ...queue.rules, keywords: [...rules] };
      await dependencies.queue.saveRules(expectedOwner, config);
      if (!current()) throw new Error('tracking_owner_changed');
      await dependencies.configureBackground?.(
        expectedOwner,
        config,
        queue.mode ?? dependencies.offlineMode() ?? undefined,
        epoch
      );
      if (!current()) throw new Error('tracking_owner_changed');
      if ((await this.resync(true)).status === 'error')
        throw new Error('tracking_configuration_refresh_failed');
    },
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

async function onlineRuleSnapshot(
  dependencies: CoordinatorDependencies
): Promise<SmsRuleSnapshot> {
  const [keywords, senders] = await Promise.all([
    dependencies.tracking.listKeywordRules(),
    dependencies.tracking.listSenderRules()
  ]);
  return { keywords, senders };
}

function cachedRules(rules: SmsRuleSnapshot): {
  keywordRules: KeywordRuleSummary[];
  senderRules: SenderRule[];
} {
  return {
    keywordRules: rules.keywords.map((rule, index) => ({
      id: rule.id ?? `cached-keyword-${index}`,
      group: rule.group ?? 'financial',
      language: rule.language ?? 'en',
      value: rule.value,
      normalizedValue: rule.value.normalize('NFKC').toLocaleLowerCase('en'),
      origin: rule.origin ?? 'custom',
      enabled: rule.enabled && rule.group !== undefined,
      recentUseCount: 0,
      lastUsedAt: null
    })),
    senderRules: rules.senders.map((rule, index) => ({
      id: `cached-sender-${index}`,
      normalizedSender: rule.normalizedSender,
      displayLabel: rule.normalizedSender,
      institutionKey: null,
      origin: 'custom',
      enabled: rule.enabled,
      trusted: rule.trusted,
      recentUseCount: 0,
      lastUsedAt: null,
      createdAt: 0,
      updatedAt: 0
    }))
  };
}

async function importKey(
  prepared: PreparedSmsImport,
  source: 'sms' | 'provider'
): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    prepared.events.map((event) => event.sourceItemKey).join('|')
  );
  return `${source}:${digest}`;
}

async function flush(
  ownerId: string,
  pending: readonly SmsImportQueueEntry[],
  dependencies: CoordinatorDependencies,
  update: (
    status: AutomaticTrackingSyncStatus,
    patch?: Partial<AutomaticTrackingSyncState>
  ) => AutomaticTrackingSyncState,
  fence: () => void = () => undefined
): Promise<AutomaticTrackingSyncState> {
  let last = update('idle');
  for (const entry of pending) {
    fence();
    if (
      dependencies.session()?.userId !== ownerId ||
      dependencies.session()?.status !== 'authenticated'
    )
      throw new Error('tracking_owner_changed');
    let current: TrackingImportSession;
    if (entry.sessionId) {
      current = await dependencies.tracking.getImportSession(
        entry.sessionId,
        ownerId
      );
    } else {
      current = await dependencies.tracking.submitImport(
        entry.submission,
        entry.idempotencyKey,
        ownerId
      );
      await dependencies.queue.markSubmitted(
        ownerId,
        entry.idempotencyKey,
        current.id
      );
    }
    if (current.status === 'received' || current.status === 'processing') {
      last = update('processing', { sessionId: current.id });
      continue;
    }
    if (
      current.acceptedCount > 0 &&
      (await dependencies.onSaved?.(ownerId, current.id)) === false
    ) {
      last = update('processing', { sessionId: current.id });
      continue;
    }
    if (current.status === 'review') {
      const itemIds = new Set(
        await dependencies.tracking.listImportItemIds(current.id)
      );
      const [review, duplicates] = await Promise.all([
        findReview(itemIds, dependencies),
        dependencies.tracking.listDuplicates()
      ]);
      const duplicate = duplicates.find((item) =>
        itemIds.has(item.detectedEventId)
      );
      if (!review && !duplicate)
        return update('processing', { sessionId: current.id });
      await dependencies.queue.markTerminal(ownerId, entry.idempotencyKey);
      return duplicate
        ? update('duplicate', {
            sessionId: current.id,
            reviewId: review?.id ?? null,
            duplicateId: duplicate.id
          })
        : update('review', {
            sessionId: current.id,
            reviewId: review?.id ?? null
          });
    }
    if (current.status === 'failed')
      return update('error', {
        sessionId: current.id,
        errorCode: 'import_failed'
      });
    await dependencies.queue.markTerminal(ownerId, entry.idempotencyKey);
    if (current.status === 'complete')
      last = update(current.acceptedCount > 0 ? 'imported' : 'idle', {
        sessionId: current.id
      });
    else
      return update('error', {
        sessionId: current.id,
        errorCode: `import_${current.status}`
      });
  }
  return last;
}

async function findReview(
  itemIds: ReadonlySet<string>,
  dependencies: CoordinatorDependencies
) {
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page = await dependencies.tracking.listReviewItems({
      status: 'pending',
      pageSize: 100,
      cursor
    });
    const review = page.items.find((item) => itemIds.has(item.detectedEventId));
    if (review) return review;
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor)) throw new Error('review_cursor_loop');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return null;
}

const coordinator = createAutomaticTrackingCoordinator({
  isLive: () => resolveClientMode() === 'live',
  session: () => useAppShellStore.getState().session,
  offlineMode: () =>
    useAppShellStore.getState().onboarding?.trackingPreference?.mode ?? null,
  tracking: automaticTrackingService,
  permission: createTrackingPermissionService(),
  inbox: smsInboxService,
  bankNotifications: bankNotificationService,
  sources: trackingSourcePreferences,
  listAccounts: (...args) => coreFinanceService.listAccounts(...args),
  async listCachedAccounts() {
    const cachedAccounts = new CoreFinanceRepository();
    await cachedAccounts.hydrate();
    return cachedAccounts.listAccounts();
  },
  queue: new SmsImportQueue(),
  prepare: prepareFinancialMessageImport,
  now: Date.now,
  deviceId: getTrackingDeviceId,
  onSaved: reconcileTrackingSaves,
  configureBackground: configureTrackingBackground
});

export const syncAutomaticTracking = () => coordinator.sync();
export const resyncAutomaticTracking = () => coordinator.resync();
export const updateAutomaticTrackingKeywords = (
  rules: readonly KeywordRule[],
  ownerId?: string | null
) => coordinator.updateKeywordConfiguration(rules, ownerId);
export const getAutomaticTrackingSyncState = () => coordinator.getState();
export const subscribeAutomaticTrackingSyncState = (listener: () => void) =>
  coordinator.subscribe(listener);
