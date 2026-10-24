import * as Crypto from 'expo-crypto';
import { getTrackingDeviceId } from './tracking-device';
import { reconcileTrackingSaves } from './tracking-save-confirmation';
import {
  configureTrackingBackground,
  scheduleTrackingFollowUp
} from './tracking-background-runtime';

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
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
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
  invalidateTrackingConsent,
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
  scheduleFollowUp?(ownerId: string): Promise<void>;
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

function laterSmsId(left: string, right: string): string {
  const a = /^\d{1,19}$/.test(left) ? left.replace(/^0+(?=\d)/, '') : '0',
    b = /^\d{1,19}$/.test(right) ? right.replace(/^0+(?=\d)/, '') : '0';
  return a.length > b.length || (a.length === b.length && a > b) ? a : b;
}

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
    let phase = 'queue';
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
      let online = await dependencies.inbox.isNetworkAvailable();
      let serviceFailed = false;
      if (requireFreshConfiguration && !online)
        throw new Error('tracking_configuration_refresh_failed');
      let mode = queue.mode ?? dependencies.offlineMode();
      let status: TrackingStatusSnapshot | null = null;
      if (online) {
        try {
          phase = 'status';
          status = await dependencies.tracking.getStatus();
          mode = status.mode;
        } catch (error) {
          if (requireFreshConfiguration) throw error;
          online = false;
          serviceFailed = true;
        }
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
      phase = 'notification_status';
      const captureIssue = sources.notificationEnabled
        ? await dependencies.bankNotifications.getCaptureIssue?.()
        : null;
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
          phase = 'rules';
          const candidate = dependencies.tracking.getRuleConfiguration
            ? await dependencies.tracking.getRuleConfiguration()
            : await onlineRuleSnapshot(dependencies);
          stillOwner();
          await dependencies.queue.saveRules(ownerId, candidate);
          config = candidate;
        } catch (error) {
          if (requireFreshConfiguration) throw error;
          /* Keep the complete last-known-good release. Unconfigured capture is held for review. */
        }
      }
      if (config.requiresRefresh) {
        await dependencies.configureBackground?.(
          ownerId,
          config,
          'paused',
          epoch
        );
        throw new Error('tracking_configuration_refresh_failed');
      }
      const eligiblePending = (entries: readonly SmsImportQueueEntry[]) =>
        entries.filter(
          (entry) =>
            (!config.policyActivatedAt ||
              entry.submission.events.every(
                (event) =>
                  Date.parse(event.receivedAt) >= config.policyActivatedAt!
              )) &&
            (!config.accountingPolicy ||
              entry.submission.schemaVersion === 3) &&
            (entry.submission.sourceChannel === 'android_notification'
              ? sources.notificationEnabled
              : sources.smsEnabled)
        );
      phase = 'pending_receipts';
      if (online && queue.pending.length)
        last = await flush(
          ownerId,
          eligiblePending(queue.pending),
          dependencies,
          update,
          stillOwner,
          (step) => {
            phase = step;
          }
        );
      const sourceSmsAt =
        sources.smsActivatedAt ??
        queue.activation?.smsActivatedAt ??
        dependencies.now();
      const sourceSmsId =
        sources.smsActivationId ?? queue.activation?.smsActivationId ?? '0';
      const policySmsId = config.policySmsActivationId ?? '0';
      const activation = {
        smsActivatedAt: Math.max(
          config.policyActivatedAt ?? 0,
          sources.smsActivatedAt ??
            queue.activation?.smsActivatedAt ??
            dependencies.now()
        ),
        smsActivationId:
          (config.policyActivatedAt ?? 0) > sourceSmsAt
            ? policySmsId
            : config.policyActivatedAt === sourceSmsAt
              ? laterSmsId(policySmsId, sourceSmsId)
              : sourceSmsId,
        notificationActivatedAt: Math.max(
          config.policyActivatedAt ?? 0,
          sources.notificationActivatedAt ??
            queue.activation?.notificationActivatedAt ??
            dependencies.now()
        )
      };
      phase = 'activation';
      await dependencies.queue.setActivation(ownerId, activation);
      const rules = cachedRules(config);
      const deviceId = dependencies.deviceId
        ? await dependencies.deviceId()
        : 'legacy-device';
      phase = 'accounts';
      const accounts = online
        ? await dependencies.listAccounts()
        : await dependencies.listCachedAccounts();
      stillOwner();
      phase = 'native_configuration';
      await dependencies.configureBackground?.(
        ownerId,
        { ...config, activation },
        mode ?? undefined,
        epoch
      );
      let cursor = Math.max(queue.cursor ?? 0, activation.smsActivatedAt);
      let cursorId =
        queue.cursor !== null && queue.cursor >= activation.smsActivatedAt
          ? queue.cursor === activation.smsActivatedAt
            ? laterSmsId(queue.cursorId ?? '0', activation.smsActivationId)
            : queue.cursorId
          : activation.smsActivationId;
      let fingerprints = new Set(queue.fingerprints);
      let captured = false;
      let accountRequired = false;
      // One nominal observation can contain principal and an additional fee;
      // each durable/API submission permits at most 100 movement events.
      const capturePageSize = config.accountingPolicy ? 50 : 100;
      const sourceCurrencyPolicy =
        config.currencyAccountPolicy === 'source_currency_v1' &&
        config.sourceAdmissionPolicy === 'financial_content_v1';
      update('scanning');
      // Each pass gives both channels a bounded quantum. Unresolved items are durably queued before progress.
      const capture = async (
        inputs: Parameters<typeof prepareFinancialMessageImport>[0],
        source: 'sms' | 'provider',
        scanned?: { receivedAt: number; id: string }
      ) => {
        phase = `prepare_${source}`;
        const prepared = await dependencies.prepare(inputs, {
          ...rules,
          accounts,
          knownFingerprints: fingerprints,
          deviceId,
          snapshot: config.snapshot,
          configurationRevision: config.configurationRevision,
          bindings: config.bindings,
          accountingPolicy: config.accountingPolicy,
          sourceAdmissionPolicy: config.sourceAdmissionPolicy,
          currencyAccountPolicy: config.currencyAccountPolicy,
          ...(sourceCurrencyPolicy
            ? {
                preferredAccountId:
                  useCoreFinanceViewState.getState().selectedAccountId
              }
            : {}),
          ...(source === 'provider' &&
          !sourceCurrencyPolicy &&
          sources.notificationAccountId
            ? { notificationAccountId: sources.notificationAccountId }
            : {}),
          activatedAt:
            source === 'sms'
              ? activation.smsActivatedAt
              : activation.notificationActivatedAt
        });
        prepared.events = prepared.events.filter(
          (event) => !fingerprints.has(event.sourceItemKey)
        );
        accountRequired ||= prepared.accountRequiredCount > 0;
        stillOwner();
        if (prepared.diagnostics?.length)
          await dependencies.queue.retainDiagnostics(
            ownerId,
            prepared.diagnostics
          );
        if (!config.accountingPolicy && config.rolloutMode !== 'automatic')
          for (const event of prepared.events)
            if (event.classification) {
              event.classification.disposition = 'review';
              if (!event.classification.reasonCodes.includes('rollout_review'))
                event.classification.reasonCodes.push('rollout_review');
            }
        if (source === 'sms' && scanned) {
          cursor = scanned.receivedAt;
          cursorId = scanned.id;
        } else if (source === 'sms' && inputs.length) {
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
        phase = `persist_${source}`;
        if (prepared.events.length) {
          await dependencies.queue.enqueue(ownerId, {
            idempotencyKey: await importKey(prepared, source),
            submission: {
              schemaVersion: config.accountingPolicy
                ? 3
                : prepared.events.every((e) => e.classification && e.transport)
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
      if (sources.notificationEnabled && notificationAccess === 'granted') {
        phase = 'read_notifications';
        const records =
          await dependencies.bankNotifications.readRecent(capturePageSize);
        if (config.accountingPolicy) {
          const historical = records.filter(
            (item) =>
              item.capturePolicy !== config.accountingPolicy ||
              item.postedAt <
                Math.max(
                  item.captureActivatedAt ?? 0,
                  activation.notificationActivatedAt
                )
          );
          if (historical.length) {
            await dependencies.queue.retainDiagnostics(
              ownerId,
              historical.map((item) => ({
                sourceItemKey: item.key,
                sourceChannel: 'android_notification' as const,
                receivedAt: item.postedAt,
                sourceText: [item.title, item.text]
                  .filter(Boolean)
                  .join('\n')
                  .slice(0, 8000),
                reasonCodes: ['legacy_capture_preserved']
              }))
            );
            stillOwner();
            await dependencies.bankNotifications.acknowledge(
              historical.map((item) => item.key)
            );
          }
        }
        await capture(
          records.filter((item) =>
            config.accountingPolicy
              ? item.capturePolicy === config.accountingPolicy &&
                item.postedAt >=
                  Math.max(
                    item.captureActivatedAt ?? 0,
                    activation.notificationActivatedAt
                  )
              : item.postedAt >= activation.notificationActivatedAt
          ),
          'provider'
        );
      }
      if (
        sources.smsEnabled &&
        permission.status === 'granted' &&
        dependencies.inbox.available
      ) {
        for (let page = 0; page < 4; page++) {
          phase = 'read_sms';
          const scannedPage = dependencies.inbox.readPage
            ? await dependencies.inbox.readPage({
                since: cursor,
                afterId: cursorId,
                limit: capturePageSize,
                ownerId
              })
            : null;
          const messages =
            scannedPage?.messages ??
            (await dependencies.inbox.readRecent({
              since: cursor,
              afterId: cursorId,
              limit: capturePageSize
            }));
          if (!messages.length && !scannedPage) break;
          const priorId = cursorId,
            priorCursor = cursor;
          await capture(messages, 'sms', scannedPage?.lastScanned);
          if (
            (scannedPage
              ? !scannedPage.hasMore
              : messages.length < capturePageSize) ||
            (priorId === cursorId && priorCursor === cursor)
          )
            break;
        }
      }
      stillOwner();
      const pending = (await dependencies.queue.load(ownerId)).pending;
      phase = 'submit_receipts';
      if (captureIssue) {
        console.warn(
          'tracking_notification_capture_issue',
          captureIssue === 'tracking_notification_queue_full'
            ? 'queue_full'
            : 'storage_failed'
        );
        return update('error', { errorCode: 'sync_failed' });
      }
      if (online && pending.length)
        return await flush(
          ownerId,
          eligiblePending(pending),
          dependencies,
          update,
          stillOwner,
          (step) => {
            phase = step;
          }
        );
      return captured
        ? update('queued', serviceFailed ? { errorCode: 'sync_failed' } : {})
        : (last ?? update(accountRequired ? 'account_required' : 'idle'));
    } catch (error) {
      // Keep SMS text, identities and server responses out of device logs.
      const code =
        error instanceof Error && /^[a-z_]{1,80}$/.test(error.message)
          ? error.message
          : error instanceof TypeError
            ? 'type_error'
            : error instanceof RangeError
              ? 'range_error'
              : 'unknown';
      console.warn('tracking_sync_failed', phase, code);
      return update('error', { errorCode: 'sync_failed' });
    }
  };

  return {
    sync(
      requireFreshConfiguration = false
    ): Promise<AutomaticTrackingSyncState> {
      if (running) return running;
      const ownerId = dependencies.session()?.userId;
      const epoch = trackingConsentEpoch();
      running = execute(requireFreshConfiguration)
        .then(async (outcome) => {
          if (
            outcome.status === 'processing' &&
            outcome.sessionId &&
            ownerId &&
            dependencies.isLive() &&
            dependencies.session()?.status === 'authenticated' &&
            dependencies.session()?.userId === ownerId &&
            epoch === trackingConsentEpoch()
          )
            await dependencies.scheduleFollowUp?.(ownerId);
          return outcome;
        })
        .catch(() => update('error', { errorCode: 'sync_failed' }))
        .finally(() => {
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
    async suspendKeywordConfiguration(
      expectedOwner: string | null | undefined
    ): Promise<void> {
      if (!dependencies.isLive()) return;
      invalidateTrackingConsent();
      if (running) await running;
      if (!expectedOwner || dependencies.session()?.userId !== expectedOwner)
        throw new Error('tracking_owner_changed');
      const queue = await dependencies.queue.load(expectedOwner);
      const config = { ...queue.rules, requiresRefresh: true };
      await dependencies.queue.saveRules(expectedOwner, config);
      if (dependencies.session()?.userId !== expectedOwner)
        throw new Error('tracking_owner_changed');
      await dependencies.configureBackground?.(
        expectedOwner,
        config,
        'paused',
        trackingConsentEpoch()
      );
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
      // Editors hide deleted defaults. Their disabled overrides must remain in
      // effective policy until the authoritative snapshot can be refreshed.
      const removedDefaults = queue.rules.keywords
        .filter(
          (previous) =>
            previous.origin === 'default' &&
            !rules.some(
              (rule) =>
                rule.id === previous.id ||
                (rule.value === previous.value && rule.group === previous.group)
            )
        )
        .map((rule) => ({ ...rule, enabled: false }));
      const config = {
        ...queue.rules,
        keywords: [...rules, ...removedDefaults],
        requiresRefresh: !queue.rules.snapshot
      };
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
  fence: () => void = () => undefined,
  setPhase: (phase: string) => void = () => undefined
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
      setPhase('poll_import');
      current = await dependencies.tracking.getImportSession(
        entry.sessionId,
        ownerId
      );
    } else {
      setPhase('submit_import');
      current = await dependencies.tracking.submitImport(
        entry.submission,
        entry.idempotencyKey,
        ownerId
      );
      setPhase('persist_receipt');
      await dependencies.queue.markSubmitted(
        ownerId,
        entry.idempotencyKey,
        current.id
      );
    }
    if (
      current.acceptedCount === 0 &&
      (current.status === 'received' || current.status === 'processing')
    ) {
      // One owned read can observe a committed effect without another native wake.
      fence();
      try {
        const observed = await dependencies.tracking.getImportSession(
          current.id,
          ownerId
        );
        if (observed.id === current.id) current = observed;
      } catch {
        // The optional read cannot replace the receipt's durable processing follow-up.
      }
      fence();
    }
    setPhase('confirm_saved');
    if (
      current.acceptedCount > 0 &&
      (await dependencies.onSaved?.(ownerId, current.id)) === false
    ) {
      last = update('processing', { sessionId: current.id });
      continue;
    }
    if (current.status === 'received' || current.status === 'processing') {
      last = update('processing', { sessionId: current.id });
      continue;
    }
    if (current.status === 'review') {
      setPhase('read_reviews');
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
    await cachedAccounts.hydrate({ preserveDrafts: true });
    return cachedAccounts.listAccounts();
  },
  queue: new SmsImportQueue(),
  prepare: prepareFinancialMessageImport,
  now: Date.now,
  deviceId: getTrackingDeviceId,
  onSaved: reconcileTrackingSaves,
  configureBackground: configureTrackingBackground,
  scheduleFollowUp: scheduleTrackingFollowUp
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

export const suspendAutomaticTrackingConfiguration = (
  ownerId: string | null | undefined
) => coordinator.suspendKeywordConfiguration(ownerId);
