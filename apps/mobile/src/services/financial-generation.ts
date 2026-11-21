import { z } from 'zod';
import { eraseFinancialProjections } from '@/storage/financial-reset-projections';
import { clearExternalFinancialData } from './financial-reset-cleanup';
import {
  openDatabase,
  runExclusiveDatabaseTransaction
} from '@/storage/database';
import { clearFinancialAssistantDrafts } from '@/storage/app-shell-storage';
import { clearPendingVoiceSession } from '@/storage/voice-pending-session';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { useAppShellStore } from '@/state/app-shell';
import { HttpError, requestJson } from './live/http-client';
import { captureLiveReadClerkIdentity } from './live/auth-service';
import { resetFinancialProjections } from '../storage/runtime-user-data-reset';

const stateSchema = z.object({
  generation: z.number().int().nonnegative(),
  status: z.enum(['ready', 'processing']),
  resetAt: z.string().nullable(),
  requestId: z.string().nullable()
});
const jobs = new Map<
  string,
  Promise<{ generation: number; changed: boolean; cutoff: number }>
>();
const listeners = new Set<(owner: string) => Promise<void>>();
export function onFinancialReset(listener: (owner: string) => Promise<void>) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function assertOwner(owner: string) {
  const session = useAppShellStore.getState().session;
  if (session?.status !== 'authenticated' || session.userId !== owner)
    throw new HttpError('session_expired', 401);
}

async function reconcile(owner: string) {
  assertOwner(owner);
  const actor = await captureLiveReadClerkIdentity();
  if (actor.userId !== owner) throw new HttpError('session_expired', 401);
  const state = await requestJson(
    '/api/v1/me/financial-reset/state',
    stateSchema,
    { token: actor.token }
  ).catch((error) => {
    if (!(error instanceof HttpError) || error.status !== 404) throw error;
    // A server predating the feature accepts only pre-reset clients. Never downgrade
    // an owner whose device has already observed a reset.
    return {
      generation: 0,
      status: 'ready' as const,
      requestId: null,
      resetAt: null
    };
  });
  await actor.assertCurrent();
  assertOwner(owner);
  if (state.status !== 'ready')
    throw new HttpError('conflict', 409, 'FINANCIAL_RESET_PROCESSING');

  const db = await openDatabase(owner);
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS financial_reset_state (id INTEGER PRIMARY KEY CHECK (id=1), generation INTEGER NOT NULL)'
  );
  const row = await db.getFirstAsync<{ generation: number }>(
    'SELECT generation FROM financial_reset_state WHERE id=1'
  );
  const previous = row?.generation ?? 0;
  if (state.generation < previous)
    throw new HttpError('conflict', 409, 'FINANCIAL_GENERATION_INVALID');
  if (state.generation === previous)
    return {
      generation: previous,
      changed: false,
      cutoff: state.resetAt ? Date.parse(state.resetAt) : 0
    };
  assertOwner(owner);
  const previews = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM assistant_action_previews'
  );
  await clearExternalFinancialData(
    owner,
    previews.map((record) => record.id)
  );
  await clearFinancialAssistantDrafts(owner);
  await clearPendingVoiceSession(owner);
  const cutoff = Date.parse(state.resetAt ?? '');
  if (!Number.isFinite(cutoff)) throw new HttpError('contract_mismatch', 502);
  await new SmsImportQueue().resetFinancialHistory(owner, cutoff);
  await runExclusiveDatabaseTransaction(db, async (tx) => {
    assertOwner(owner);
    await eraseFinancialProjections(tx);
  });
  resetFinancialProjections(owner);
  for (const listener of listeners) await listener(owner);
  assertOwner(owner);
  await db.runAsync(
    'INSERT OR REPLACE INTO financial_reset_state(id,generation) VALUES (1,?)',
    state.generation
  );
  return { generation: state.generation, changed: true, cutoff };
}
export function reconcileFinancialReset(owner: string) {
  const pending = jobs.get(owner);
  if (pending) return pending;
  const next = reconcile(owner).finally(() => jobs.delete(owner));
  jobs.set(owner, next);
  return next;
}
export async function financialWriteGeneration(owner: string) {
  const result = await reconcileFinancialReset(owner);
  if (result.changed)
    throw new HttpError('conflict', 409, 'FINANCIAL_GENERATION_CHANGED');
  return String(result.generation);
}
