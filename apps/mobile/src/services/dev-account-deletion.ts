import { z } from 'zod';

import {
  isDevPrivacyDeletionEnabled,
  devPrivacyDeletionApiUrl
} from '@/config/client-runtime';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import {
  loadDeletionCompletion,
  pendingDeletionOwners,
  prepareDeletionCompletion,
  removeDeletionCompletion,
  retainDeletedOwnerFence,
  saveDeletionCompletion,
  type DeletionCompletionJournal,
  isDeletionOwnerFenced,
  ensureDeletionCompletionIndexed
} from '@/storage/deletion-completion-journal';
import { removeAccountDeletionJournal } from './account-deletion-journal';
import { eraseDeletedAccountLocalData } from './account-data-erasure';
import {
  captureLiveClerkIdentity,
  deletionRequestSchema,
  getLiveClerkOwnerId,
  signOutDeletedClerkOwner
} from './live/auth-service';
import { HttpError, requestJson } from './live/http-client';

const receiptSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum([
      'requested',
      'verified',
      'processing',
      'completed',
      'cancelled',
      'failed'
    ]),
    completedAt: z.string().datetime().nullable(),
    errorCode: z.string().nullable(),
    version: z.number().int().positive()
  })
  .strict()
  .refine(
    (receipt) => receipt.status !== 'completed' || receipt.completedAt !== null
  );
type CompletionReceipt = z.infer<typeof receiptSchema>;
export type DevDeletionPhase =
  | 'deleting'
  | 'pending'
  | 'verification_required'
  | 'rejected'
  | 'local_retry'
  | 'completed'
  | 'failed'
  | 'unavailable';
export interface DevDeletionSnapshot {
  ownerId: string;
  phase: DevDeletionPhase;
  error:
    | 'settings.deletion.error'
    | 'settings.deletion.rateLimited'
    | 'settings.deletion.dev.localRetry'
    | 'settings.deletion.dev.notAllowed'
    | null;
  nextAttemptAt: number;
  automaticRetries: boolean;
}
const backoff = [2_000, 5_000, 10_000, 20_000, 30_000, 60_000];
const snapshots = new Map<string, DevDeletionSnapshot>();
let publicSnapshots: readonly DevDeletionSnapshot[] = [];
const subscribers = new Set<() => void>();
const ownerFlights = new Map<string, Promise<void>>();

export function getDevDeletionSnapshots(): readonly DevDeletionSnapshot[] {
  return publicSnapshots;
}
export function subscribeDevAccountDeletion(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export async function hasPendingDevAccountDeletions(): Promise<boolean> {
  return (
    isDevPrivacyDeletionEnabled() && (await pendingDeletionOwners()).length > 0
  );
}

export async function prepareDevDeletionBootstrap(): Promise<boolean> {
  if (!isDevPrivacyDeletionEnabled()) return true;
  const ownerId = await getLiveClerkOwnerId();
  if (!ownerId) return true;
  let retained: DeletionCompletionJournal | null = null;
  await ownerFlight(ownerId, async () => {
    retained = await loadDeletionCompletion(ownerId);
    if (retained) await ensureDeletionCompletionIndexed(ownerId);
  });
  if (retained && !snapshots.has(ownerId)) {
    const journal = retained as DeletionCompletionJournal;
    if (journal.phase === 'rejected') publishRejected(ownerId);
    else {
      publish(
        ownerId,
        ['prepared', 'verification_required'].includes(journal.phase)
          ? 'verification_required'
          : 'pending',
        {
          nextAttemptAt: journal.nextAttemptAt || Date.now(),
          automaticRetries: true
        }
      );
    }
  }
  if (!(await isDeletionOwnerFenced(ownerId))) return true;
  useAppShellStore.getState().releaseDeletedOwner(ownerId);
  useAppShellStore.setState({ hydrated: true });
  return false;
}

function discardPriorCompletion(ownerIds: readonly string[]): void {
  let changed = false;
  for (const [ownerId, snapshot] of snapshots) {
    if (snapshot.phase === 'completed' && !ownerIds.includes(ownerId)) {
      snapshots.delete(ownerId);
      changed = true;
    }
  }
  if (changed) {
    publicSnapshots = [...snapshots.values()];
    subscribers.forEach((listener) => listener());
  }
}

function publish(
  ownerId: string,
  phase: DevDeletionPhase,
  options: Partial<DevDeletionSnapshot> = {}
): void {
  snapshots.set(ownerId, {
    ownerId,
    phase,
    error: null,
    nextAttemptAt: 0,
    automaticRetries: false,
    ...options
  });
  publicSnapshots = [...snapshots.values()];
  subscribers.forEach((listener) => listener());
}

function publishRejected(ownerId: string): void {
  publish(ownerId, 'rejected', { error: 'settings.deletion.dev.notAllowed' });
}

function ownerFlight(
  ownerId: string,
  operation: () => Promise<void>
): Promise<void> {
  const existing = ownerFlights.get(ownerId);
  if (existing) return existing;
  const flight = operation().finally(() => {
    if (ownerFlights.get(ownerId) === flight) ownerFlights.delete(ownerId);
  });
  ownerFlights.set(ownerId, flight);
  return flight;
}

function requireRuntime(): string {
  const apiUrl = devPrivacyDeletionApiUrl();
  if (!apiUrl) throw new HttpError('forbidden', 403);
  return apiUrl;
}

function assertShellOwner(ownerId: string): void {
  const session = useAppShellStore.getState().session;
  if (session?.userId && session.userId !== ownerId)
    throw new HttpError('session_expired', 401);
}

class DeletionTransportFailure extends Error {
  constructor(
    readonly failure: HttpError,
    readonly retryAfterMs: number,
    readonly method: 'POST' | 'GET'
  ) {
    super('Account deletion status unavailable');
  }
}

function retryDelay(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.ceil(seconds * 1_000);
  const deadline = Date.parse(header);
  return Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0;
}

async function deletionRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    token: string;
    method: 'POST' | 'GET';
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<{ value: T; retryAfterAt: number }> {
  let retryAfterMs = 0;
  try {
    const value = await requestJson(path, schema, {
      ...options,
      baseUrl: requireRuntime(),
      request: async (url, init) => {
        const response = await fetch(url, init);
        retryAfterMs = retryDelay(response.headers.get('Retry-After'));
        return response;
      }
    });
    return { value, retryAfterAt: retryAfterMs ? Date.now() + retryAfterMs : 0 };
  } catch (failure) {
    throw new DeletionTransportFailure(
      failure instanceof HttpError
        ? failure
        : new HttpError('provider_unavailable', 503),
      retryAfterMs,
      options.method
    );
  }
}

async function finishLocalErasure(
  journal: DeletionCompletionJournal
): Promise<void> {
  try {
    if (journal.phase === 'local_completed') {
      await removeDeletionCompletion(journal.ownerId);
      publish(journal.ownerId, 'completed');
      return;
    }
    await retainDeletedOwnerFence(journal.ownerId);
    let signOutFailure: unknown;
    try {
      await signOutDeletedClerkOwner(journal.ownerId);
    } catch (failure) {
      signOutFailure = failure;
    } finally {
      useAppShellStore.getState().releaseDeletedOwner(journal.ownerId);
    }
    await eraseDeletedAccountLocalData(journal.ownerId);
    if (signOutFailure) throw signOutFailure;
    if (!useAppShellStore.getState().session?.userId)
      await usePreferenceStore.getState().restartFirstLaunchOnboarding();
    await removeAccountDeletionJournal(journal.ownerId);
    await saveDeletionCompletion({
      ...journal,
      phase: 'local_completed',
      completionToken: null
    });
    await removeDeletionCompletion(journal.ownerId);
    publish(journal.ownerId, 'completed');
  } catch {
    // The durable completed receipt remains authoritative while local erasure retries.
    publish(journal.ownerId, 'local_retry', {
      error: 'settings.deletion.dev.localRetry'
    });
  }
}

async function acceptReceipt(
  journal: DeletionCompletionJournal,
  receipt: CompletionReceipt,
  retryAfterAt: number
): Promise<void> {
  if (!receiptSchema.safeParse(receipt).success)
    throw new HttpError('contract_mismatch', 502);
  if (journal.requestId && journal.requestId !== receipt.id)
    throw new HttpError('contract_mismatch', 502);
  if (receipt.status === 'completed') {
    const completed: DeletionCompletionJournal = {
      ...journal,
      phase: 'server_completed',
      requestId: receipt.id,
      completedAt: receipt.completedAt,
      nextAttemptAt: 0
    };
    await saveDeletionCompletion(completed);
    await finishLocalErasure(completed);
    return;
  }
  // A valid processing receipt is progress, not an exhausted transport retry.
  const attempts = Math.min(journal.attempts + 1, backoff.length - 1);
  const next = {
    ...journal,
    requestId: receipt.id,
    attempts,
    retryAfterAt,
    nextAttemptAt:
      Math.max(
        Date.now() + Math.min(5_000, backoff[Math.min(attempts - 1, backoff.length - 1)]),
        retryAfterAt
      )
  };
  await saveDeletionCompletion(next);
  const failed = receipt.status === 'failed' || receipt.status === 'cancelled';
  publish(journal.ownerId, failed ? 'failed' : 'pending', {
    nextAttemptAt: next.nextAttemptAt,
    automaticRetries: !failed && attempts < backoff.length
  });
}

async function recordFailure(
  journal: DeletionCompletionJournal,
  failure: unknown
): Promise<void> {
  if (
    ['server_completed', 'local_completed'].includes(
      (await loadDeletionCompletion(journal.ownerId))?.phase ?? ''
    )
  ) {
    publish(journal.ownerId, 'local_retry', {
      error: 'settings.deletion.dev.localRetry'
    });
    return;
  }
  const transport =
    failure instanceof DeletionTransportFailure ? failure : null;
  if (
    transport?.method === 'POST' &&
    transport.failure.status === 403 &&
    transport.failure.domainCode === 'FORBIDDEN' &&
    journal.requestId === null
  ) {
    await saveDeletionCompletion({
      ...journal,
      phase: 'rejected',
      attempts: 0,
      nextAttemptAt: 0,
      retryAfterAt: 0
    });
    publishRejected(journal.ownerId);
    return;
  }
  if (transport?.failure.domainCode === 'RECENT_AUTH_REQUIRED') {
    await saveDeletionCompletion({
      ...journal,
      phase: 'verification_required',
      nextAttemptAt: 0
    });
    publish(journal.ownerId, 'verification_required');
    return;
  }
  const attempts = journal.attempts + 1;
  const nextAttemptAt =
    Date.now() +
    Math.max(
      transport?.retryAfterMs ?? 0,
      backoff[Math.min(attempts - 1, backoff.length - 1)]
    );
  await saveDeletionCompletion({
    ...journal,
    attempts,
    nextAttemptAt,
    retryAfterAt: transport?.retryAfterMs
      ? Date.now() + transport.retryAfterMs
      : journal.retryAfterAt
  });
  publish(journal.ownerId, 'unavailable', {
    nextAttemptAt,
    automaticRetries: attempts < backoff.length,
    error:
      transport?.failure.code === 'rate_limited'
        ? 'settings.deletion.rateLimited'
        : 'settings.deletion.error'
  });
}

async function recoverJournal(
  journal: DeletionCompletionJournal,
  force: boolean,
  online = true
): Promise<void> {
  if (journal.phase === 'rejected') {
    publishRejected(journal.ownerId);
    return;
  }
  if (
    journal.phase === 'server_completed' ||
    journal.phase === 'local_completed'
  ) {
    if (!force && snapshots.get(journal.ownerId)?.phase === 'local_retry')
      return;
    return finishLocalErasure(journal);
  }
  if (
    journal.phase === 'verification_required' ||
    journal.phase === 'prepared'
  ) {
    publish(journal.ownerId, 'verification_required');
    return;
  }
  if (!online) {
    publish(journal.ownerId, 'unavailable', {
      error: 'settings.deletion.error',
      nextAttemptAt: journal.nextAttemptAt,
      automaticRetries: journal.attempts < backoff.length
    });
    return;
  }
  if (
    journal.retryAfterAt > Date.now() ||
    (!force &&
      (journal.nextAttemptAt > Date.now() ||
        journal.attempts >= backoff.length))
  ) {
    if (!snapshots.has(journal.ownerId))
      publish(journal.ownerId, 'pending', {
        nextAttemptAt: journal.nextAttemptAt,
        automaticRetries: journal.attempts < backoff.length
      });
    return;
  }
  try {
    const { value: receipt, retryAfterAt } = await deletionRequest(
      `/api/v1/privacy/deletion-completions/${encodeURIComponent(journal.operationId)}`,
      receiptSchema,
      { token: journal.completionToken!, method: 'GET' }
    );
    await acceptReceipt(journal, receipt, retryAfterAt);
  } catch (failure) {
    await recordFailure(journal, failure);
  }
}

export async function submitDevAccountDeletion(ownerId: string): Promise<void> {
  requireRuntime();
  return ownerFlight(ownerId, async () => {
    discardPriorCompletion([ownerId]);
    const existing = await loadDeletionCompletion(ownerId);
    if (
      existing &&
      existing.phase !== 'prepared' &&
      existing.phase !== 'rejected' &&
      existing.phase !== 'verification_required'
    )
      return recoverJournal(existing, true);
    const actor = await captureLiveClerkIdentity();
    if (actor.userId !== ownerId) throw new HttpError('session_expired', 401);
    assertShellOwner(ownerId);
    const journal = existing ?? (await prepareDeletionCompletion(ownerId));
    const submitted: DeletionCompletionJournal = {
      ...journal,
      phase: 'submitted',
      nextAttemptAt: 0
    };
    let dispatched = false;
    try {
      await saveDeletionCompletion(submitted);
      await actor.assertCurrent();
      assertShellOwner(ownerId);
      publish(ownerId, 'deleting');
      dispatched = true;
      const { value: request, retryAfterAt } = await deletionRequest(
        '/api/v1/me/deletion-requests',
        deletionRequestSchema,
        {
          method: 'POST',
          token: actor.token,
          headers: { 'Idempotency-Key': journal.operationId },
          body: {
            confirmation: 'DELETE_MY_ACCOUNT',
            completionToken: journal.completionToken
          }
        }
      );
      await acceptReceipt(submitted, {
        id: request.id,
        status: request.status,
        completedAt: request.completedAt,
        errorCode: null,
        version: request.version
      }, retryAfterAt);
    } catch (failure) {
      if (!dispatched) {
        await saveDeletionCompletion({ ...journal, phase: 'prepared' });
        publish(ownerId, 'verification_required');
      } else await recordFailure(submitted, failure);
    }
  });
}

export async function reconcileDevAccountDeletions(
  options: { force?: boolean; online?: boolean } = {}
): Promise<void> {
  if (!isDevPrivacyDeletionEnabled()) return;
  const owners = await pendingDeletionOwners();
  if (owners.length) discardPriorCompletion(owners);
  for (const ownerId of owners) {
    await ownerFlight(ownerId, async () => {
      try {
        const journal = await loadDeletionCompletion(ownerId);
        if (!journal) {
          publish(ownerId, 'unavailable', { error: 'settings.deletion.error' });
          return;
        }
        await recoverJournal(
          journal,
          options.force ?? false,
          options.online ?? true
        );
      } catch {
        // A corrupt or unavailable owner's journal cannot quarantine another owner.
        publish(ownerId, 'unavailable', { error: 'settings.deletion.error' });
      }
    });
  }
}
