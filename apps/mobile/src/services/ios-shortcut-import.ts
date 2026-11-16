import type { Account } from '@/domain/core-finance';
import { accountAllowsAutomaticTracking } from '@/domain/core-finance';
import type { AutomaticTrackingService } from './contracts/automatic-tracking-service';
import type { IosShortcutCandidate } from '@/features/tracking/ios-shortcut-capture';
import type { SmsImportQueue } from '@/storage/sms-import-queue';

export interface IosShortcutScope {
  ownerId: string;
  enrollmentId: string;
  sessionBinding: string;
  captureNotBefore?: number;
  assertCurrent(): Promise<void>;
  captureEnabled(): Promise<boolean>;
}
export interface IosShortcutImportPorts {
  queue: SmsImportQueue;
  resetState(owner: string): Promise<{ cutoff: number; changed: boolean }>;
  accounts(): Promise<Account[]>;
  submit(
    input: Parameters<AutomaticTrackingService['submitImport']>[0],
    key: string,
    owner: string,
    assertCaptureIntent: () => Promise<void>
  ): ReturnType<AutomaticTrackingService['submitImport']>;
  receipt: AutomaticTrackingService['getImportSession'];
  outcomes: NonNullable<AutomaticTrackingService['listImportOutcomes']>;
}
export type IosShortcutResult = {
  status:
    | 'idle'
    | 'queued'
    | 'processing'
    | 'saved'
    | 'review'
    | 'duplicate'
    | 'failed'
    | 'disabled';
  transactionId: string | null;
  sessionId: string | null;
};
const result = (
  status: IosShortcutResult['status'],
  sessionId: string | null = null,
  transactionId: string | null = null
): IosShortcutResult => ({ status, sessionId, transactionId });

export function createIosShortcutImport(ports: IosShortcutImportPorts) {
  let running: Promise<IosShortcutResult> | null = null;
  const execute = async (
    scope: IosShortcutScope
  ): Promise<IosShortcutResult> => {
    await scope.assertCurrent();
    let last = result('idle');
    const state = await ports.queue.load(scope.ownerId);
    await scope.assertCurrent();
    for (const entry of state.pending.filter(
      (row) =>
        row.submission.sourceChannel === 'ios_shortcut' &&
        row.submission.events[0]?.metadata?.iosLedger !== 'confirmed_v1'
    )) {
      await scope.assertCurrent();
      const event = entry.submission.events[0];
      if (
        !entry.sessionId &&
        (event.metadata?.iosEnrollmentId !== scope.enrollmentId ||
          event.metadata?.iosSessionBinding !== scope.sessionBinding)
      )
        continue;
      try {
        if (!entry.sessionId) {
          if (!(await scope.captureEnabled())) {
            last = result('disabled');
            continue;
          }
          const reset = await ports.resetState(scope.ownerId);
          await scope.assertCurrent();
          const currentQueue = await ports.queue.load(scope.ownerId);
          await scope.assertCurrent();
          if (
            reset.changed ||
            !currentQueue.pending.some(
              (row) => row.idempotencyKey === entry.idempotencyKey
            )
          )
            return result('failed');
          if (Date.parse(event.receivedAt) <= reset.cutoff) {
            last = result('failed');
            continue;
          }
          // Explicit iOS manual confirmation has its own consent; it does not
          // enable or inherit Android automatic-capture preferences.
          const accounts = await ports.accounts();
          await scope.assertCurrent();
          if (
            !accounts.some(
              (account) =>
                account.id === event.accountId &&
                account.currencyCode === event.currency &&
                accountAllowsAutomaticTracking(account)
            )
          ) {
            last = result('failed');
            continue;
          }
          if (!(await scope.captureEnabled())) {
            last = result('disabled');
            continue;
          }
        }
        await scope.assertCurrent();
        const receipt = entry.sessionId
          ? await ports.receipt(entry.sessionId, scope.ownerId)
          : await ports.submit(
              entry.submission,
              entry.idempotencyKey,
              scope.ownerId,
              async () => {
                await scope.assertCurrent();
                if (!(await scope.captureEnabled()))
                  throw Error('ios_shortcut_disabled');
              }
            );
        await scope.assertCurrent();
        if (!entry.sessionId)
          await ports.queue.markSubmitted(
            scope.ownerId,
            entry.idempotencyKey,
            receipt.id
          );
        await scope.assertCurrent();
        if (
          receipt.acceptedCount > 0 ||
          receipt.status === 'complete' ||
          receipt.status === 'review'
        ) {
          const outcomes = await ports.outcomes(receipt.id);
          await scope.assertCurrent();
          const accepted = outcomes.find(
            (row) => row.status === 'accepted' && row.transactionId
          );
          if (accepted) {
            last = result('saved', receipt.id, accepted.transactionId);
            await ports.queue.markTerminal(scope.ownerId, entry.idempotencyKey);
            continue;
          }
          if (outcomes.some((row) => row.status === 'duplicate')) {
            last = result('duplicate', receipt.id);
            await ports.queue.markTerminal(scope.ownerId, entry.idempotencyKey);
            continue;
          }
        }
        if (receipt.status === 'review') {
          last = result('review', receipt.id);
          continue;
        }
        if (receipt.status === 'failed' || receipt.status === 'cancelled') {
          last = result('failed', receipt.id);
          continue;
        }
        if (receipt.status !== 'complete') {
          last = result('processing', receipt.id);
          continue;
        }
        // Session completion alone is not proof of a financial save.
        last = result('failed', receipt.id);
        await ports.queue.markTerminal(scope.ownerId, entry.idempotencyKey);
      } catch {
        // Retain the exact command/idempotency key on network errors or ambiguous POST.
        await scope.assertCurrent();
        last = result('queued', entry.sessionId);
      }
    }
    return last;
  };
  const resume = async (scope: IosShortcutScope) => {
    await scope.assertCurrent();
    if (running) {
      await running;
      await scope.assertCurrent();
    }
    running = execute(scope).finally(() => {
      running = null;
    });
    return running;
  };
  return {
    resume,
    async confirm(
      scope: IosShortcutScope,
      candidate: IosShortcutCandidate,
      accountId: string
    ) {
      await scope.assertCurrent();
      if (!(await scope.captureEnabled())) throw Error('ios_shortcut_disabled');
      const accounts = await ports.accounts();
      await scope.assertCurrent();
      if (
        !accounts.some(
          (account) =>
            account.id === accountId &&
            account.currencyCode === candidate.currency &&
            accountAllowsAutomaticTracking(account)
        )
      )
        throw Error('ios_shortcut_account_required');
      let reset: { cutoff: number; changed: boolean } | null = null;
      try {
        reset = await ports.resetState(scope.ownerId);
      } catch {
        /* queue until reconciliation is available */
      }
      await scope.assertCurrent();
      if (reset?.changed) throw Error('ios_shortcut_generation_changed');
      if (reset !== null && Date.parse(candidate.receivedAt) <= reset.cutoff)
        throw Error('ios_shortcut_before_reset');
      const queue = await ports.queue.load(scope.ownerId);
      await scope.assertCurrent();
      if (queue.fingerprints.includes(candidate.sourceItemKey))
        return queue.pending.some((entry) =>
          entry.submission.events.some(
            (event) => event.sourceItemKey === candidate.sourceItemKey
          )
        )
          ? resume(scope)
          : result('duplicate');
      if (!(await scope.captureEnabled())) throw Error('ios_shortcut_disabled');
      await ports.queue.enqueue(scope.ownerId, {
        idempotencyKey: candidate.sourceItemKey,
        submission: {
          schemaVersion: 1,
          sourceType: 'manual',
          sourceChannel: 'ios_shortcut',
          events: [
            {
              ...candidate,
              accountId,
              metadata: {
                iosEnrollmentId: scope.enrollmentId,
                iosSessionBinding: scope.sessionBinding
              }
            }
          ]
        },
        cursor: Date.parse(candidate.receivedAt),
        fingerprints: [candidate.sourceItemKey]
      });
      await scope.assertCurrent();
      return resume(scope);
    }
  };
}
