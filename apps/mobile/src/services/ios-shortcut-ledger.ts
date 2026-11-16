import {
  transactionInputSchema,
  type Account,
  type Category,
  type Transaction,
  type TransactionInput
} from '@/domain/core-finance';
import type { MutationResult } from './contracts/core-finance-service';
import type { IosShortcutCandidate } from '@/features/tracking/ios-shortcut-capture';
import type { SmsImportQueue } from '@/storage/sms-import-queue';
import type {
  IosShortcutResult,
  IosShortcutScope
} from './ios-shortcut-import';

export interface IosShortcutLedgerPorts {
  queue: SmsImportQueue;
  accounts(): Promise<Account[]>;
  categories(): Promise<Category[]>;
  resetState(owner: string): Promise<{ cutoff: number; changed: boolean }>;
  legacy(scope: IosShortcutScope): Promise<IosShortcutResult>;
  title(kind: 'income' | 'expense'): string;
  submit(
    input: TransactionInput,
    operationId: string,
    scope: IosShortcutScope
  ): Promise<MutationResult<Transaction>>;
}

const marker = 'confirmed_v1';
const result = (
  status: IosShortcutResult['status'],
  transactionId: string | null = null
): IosShortcutResult => ({ status, transactionId, sessionId: null });
function operationUuid(sourceItemKey: string) {
  const digest = /^ios-shortcut:([a-f0-9]{64})$/u.exec(sourceItemKey)?.[1];
  if (!digest) throw Error('ios_shortcut_identity_invalid');
  const variant = ((parseInt(digest[16]!, 16) & 3) | 8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/** Confirmed manual commands use the ordinary ledger API, never the legacy import worker. */
export function createIosShortcutLedger(ports: IosShortcutLedgerPorts) {
  let running: Promise<IosShortcutResult> | null = null;
  const execute = async (
    scope: IosShortcutScope
  ): Promise<IosShortcutResult> => {
    await scope.assertCurrent();
    const state = await ports.queue.load(scope.ownerId);
    await scope.assertCurrent();
    const entries = state.pending.filter(
      (row) => row.submission.sourceChannel === 'ios_shortcut'
    );
    let last = entries.some(
      (row) => row.submission.events[0]?.metadata?.iosLedger !== marker
    )
      ? await ports.legacy(scope)
      : result('idle');
    await scope.assertCurrent();
    for (const entry of entries) {
      const event = entry.submission.events[0];
      if (event?.metadata?.iosLedger !== marker) continue;
      if (
        event.metadata.iosEnrollmentId !== scope.enrollmentId ||
        event.metadata.iosSessionBinding !== scope.sessionBinding
      )
        continue;
      try {
        if (!(await scope.captureEnabled())) {
          last = result('disabled');
          continue;
        }
        const reset = await ports.resetState(scope.ownerId);
        await scope.assertCurrent();
        const current = await ports.queue.load(scope.ownerId);
        await scope.assertCurrent();
        if (
          reset.changed ||
          !current.pending.some(
            (row) => row.idempotencyKey === entry.idempotencyKey
          )
        )
          return result('failed');
        if (Date.parse(event.receivedAt) <= reset.cutoff) {
          last = result('failed');
          continue;
        }
        if (Date.parse(event.receivedAt) < (scope.captureNotBefore ?? 0)) {
          last = result('failed');
          continue;
        }
        const [accounts, categories] = await Promise.all([
          ports.accounts(),
          ports.categories()
        ]);
        await scope.assertCurrent();
        if (
          !accounts.some(
            (row) =>
              row.id === event.accountId &&
              row.currencyCode === event.currency &&
              row.status === 'active'
          ) ||
          !categories.some(
            (row) =>
              row.id === event.metadata?.iosCategoryId &&
              row.status === 'active' &&
              row.financialType === event.kind
          )
        ) {
          last = result('failed');
          continue;
        }
        if (entry.submission.events.length !== 1)
          throw Error('ios_shortcut_command_invalid');
        const input = transactionInputSchema.parse({
          type: event.kind,
          amountMinor: event.amountMinor,
          currencyCode: event.currency,
          accountId: event.accountId,
          categoryId: event.metadata.iosCategoryId,
          title: event.metadata.iosTitle,
          occurredAt: Date.parse(event.occurredAt ?? event.receivedAt),
          merchant: null,
          notes: null
        });
        const receipt = await ports.submit(
          input,
          operationUuid(event.sourceItemKey),
          scope
        );
        await scope.assertCurrent();
        const saved = receipt.value;
        if (
          saved.syncStatus !== 'synced' ||
          saved.status !== 'posted' ||
          saved.source !== 'platform_assisted' ||
          !saved.id ||
          saved.amountMinor !== input.amountMinor ||
          saved.currencyCode !== input.currencyCode ||
          saved.type !== input.type ||
          saved.accountId !== input.accountId ||
          saved.categoryId !== input.categoryId ||
          saved.occurredAt !== input.occurredAt
        ) {
          last = result('queued');
          continue;
        }
        await ports.queue.markTerminal(scope.ownerId, entry.idempotencyKey);
        await scope.assertCurrent();
        last = result('saved', saved.id);
      } catch {
        // Keep the same immutable command and UUID after offline or ambiguous delivery.
        await scope.assertCurrent();
        last = result('queued');
      }
    }
    return last;
  };
  const resume = async (
    scope: IosShortcutScope
  ): Promise<IosShortcutResult> => {
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
      accountId: string,
      categoryId: string
    ) {
      await scope.assertCurrent();
      if (!(await scope.captureEnabled())) throw Error('ios_shortcut_disabled');
      if (Date.parse(candidate.receivedAt) < (scope.captureNotBefore ?? 0))
        throw Error('ios_shortcut_before_cutover');
      const queue = await ports.queue.load(scope.ownerId);
      await scope.assertCurrent();
      if (queue.fingerprints.includes(candidate.sourceItemKey)) {
        // This includes legacy identities: never move an in-flight import to a second ledger scope.
        return queue.pending.some((row) =>
          row.submission.events.some(
            (event) => event.sourceItemKey === candidate.sourceItemKey
          )
        )
          ? resume(scope)
          : result('duplicate');
      }
      const [accounts, categories] = await Promise.all([
        ports.accounts(),
        ports.categories()
      ]);
      await scope.assertCurrent();
      if (
        !accounts.some(
          (row) =>
            row.id === accountId &&
            row.currencyCode === candidate.currency &&
            row.status === 'active'
        )
      )
        throw Error('ios_shortcut_account_required');
      if (
        !categories.some(
          (row) =>
            row.id === categoryId &&
            row.status === 'active' &&
            row.financialType === candidate.kind
        )
      )
        throw Error('ios_shortcut_category_required');
      let reset: { cutoff: number; changed: boolean } | null = null;
      try {
        reset = await ports.resetState(scope.ownerId);
      } catch {
        /* durable confirmation can wait for reconciliation */
      }
      await scope.assertCurrent();
      if (
        reset?.changed ||
        (reset && Date.parse(candidate.receivedAt) <= reset.cutoff)
      )
        throw Error('ios_shortcut_generation_changed');
      operationUuid(candidate.sourceItemKey);
      if (!(await scope.captureEnabled())) throw Error('ios_shortcut_disabled');
      await ports.queue.enqueue(scope.ownerId, {
        idempotencyKey: candidate.sourceItemKey,
        submission: {
          schemaVersion: 1,
          sourceType: 'manual',
          sourceChannel: 'ios_shortcut',
          events: [
            {
              sourceItemKey: candidate.sourceItemKey,
              amountMinor: candidate.amountMinor,
              currency: candidate.currency,
              kind: candidate.kind,
              receivedAt: candidate.receivedAt,
              occurredAt: candidate.occurredAt,
              accountId,
              metadata: {
                iosLedger: marker,
                iosCategoryId: categoryId,
                iosTitle: ports.title(candidate.kind),
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
