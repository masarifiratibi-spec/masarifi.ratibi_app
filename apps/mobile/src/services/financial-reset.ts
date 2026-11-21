import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

import {
  isBenchmarkReadOnly,
  resolveClientRuntime
} from '@/config/client-runtime';
import { useAppShellStore } from '@/state/app-shell';
import { captureLiveClerkIdentity } from './live/auth-service';
import { HttpError, requestJson } from './live/http-client';
import { readRecoveryNetwork } from './platform/read-recovery-network';

const path = '/api/v1/me/financial-reset';
const stateSchema = z.object({
  generation: z.number().int().nonnegative(),
  resetAt: z.string().nullable(),
  requestId: z.string().uuid().nullable(),
  status: z.enum(['ready', 'processing'])
});
const receiptSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['processing', 'completed']),
  generation: z.number().int().nonnegative()
});
export type FinancialResetReceipt = z.infer<typeof receiptSchema>;
export type FinancialResetState = z.infer<typeof stateSchema>;

const key = (ownerId: string) => 'masarifi.financialReset.operation.' + ownerId;

export function financialResetRuntimeAvailable() {
  return resolveClientRuntime().mode === 'live' && !isBenchmarkReadOnly();
}

function assertOwner(ownerId: string) {
  const session = useAppShellStore.getState().session;
  if (session?.status !== 'authenticated' || session.userId !== ownerId)
    throw new HttpError('session_expired', 401);
}

async function actorFor(ownerId: string) {
  assertOwner(ownerId);
  const actor = await captureLiveClerkIdentity();
  if (actor.userId !== ownerId) throw new HttpError('session_expired', 401);
  assertOwner(ownerId);
  return actor;
}

export async function fetchFinancialResetState(ownerId: string) {
  const actor = await actorFor(ownerId);
  const state = await requestJson(path + '/state', stateSchema, {
    token: actor.token,
    recentAuth: 'manual'
  });
  await actor.assertCurrent();
  assertOwner(ownerId);
  return state;
}

const intentSchema = z.object({
  id: z.string().uuid(),
  generation: z.number().int().nonnegative().nullable()
});

export async function loadFinancialResetOperation(ownerId: string) {
  assertOwner(ownerId);
  const saved = await AsyncStorage.getItem(key(ownerId));
  if (saved === null) return null;
  if (z.string().uuid().safeParse(saved).success)
    return { id: saved, generation: null };
  return intentSchema.parse(JSON.parse(saved));
}

export async function readFinancialReset(ownerId: string, id: string) {
  const actor = await actorFor(ownerId);
  try {
    const receipt = await requestJson(path + '/' + id, receiptSchema, {
      token: actor.token,
      recentAuth: 'manual'
    });
    if (receipt.id !== id) throw new HttpError('contract_mismatch', 500);
    await actor.assertCurrent();
    assertOwner(ownerId);
    if (!(await loadFinancialResetOperation(ownerId)))
      await AsyncStorage.setItem(
        key(ownerId),
        JSON.stringify({ id, generation: null })
      );
    return receipt;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'not_found') return null;
    throw error;
  }
}

export async function submitFinancialReset(
  ownerId: string,
  reviewedGeneration: number,
  isActive: () => boolean
) {
  const actor = await actorFor(ownerId);
  if (readRecoveryNetwork.available && !(await readRecoveryNetwork.isOnline()))
    throw new HttpError(
      'provider_unavailable',
      503,
      undefined,
      undefined,
      'network'
    );
  // Check the current generation before sending the confirmed operation.
  const state = await fetchFinancialResetState(ownerId);
  const saved = await loadFinancialResetOperation(ownerId);
  if (saved) {
    const receipt = await readFinancialReset(ownerId, saved.id);
    if (receipt) return receipt;
    if (saved.generation !== state.generation)
      throw new HttpError('conflict', 409, 'FINANCIAL_GENERATION_CHANGED');
  }
  if (state.status === 'processing' && state.requestId) {
    return readFinancialReset(ownerId, state.requestId);
  }
  if (state.generation !== reviewedGeneration)
    throw new HttpError('conflict', 409, 'FINANCIAL_GENERATION_CHANGED');
  if (!isActive()) return null;
  await actor.assertCurrent();
  assertOwner(ownerId);
  const id = saved?.id ?? randomUUID();
  const generation = saved?.generation ?? reviewedGeneration;
  // A lost POST response is ambiguous. Persist its identity before sending.
  await AsyncStorage.setItem(key(ownerId), JSON.stringify({ id, generation }));
  await actor.assertCurrent();
  assertOwner(ownerId);
  if (!isActive()) return null;
  const receipt = await requestJson(path, receiptSchema, {
    method: 'POST',
    body: { operationId: id },
    token: actor.token,
    headers: {
      'Idempotency-Key': id,
      'X-Financial-Generation': String(generation)
    },
    recentAuth: 'manual',
    timeoutMs: 70_000
  });
  if (receipt.id !== id) throw new HttpError('contract_mismatch', 500);
  await actor.assertCurrent();
  assertOwner(ownerId);
  return receipt;
}

export async function acknowledgeFinancialReset(ownerId: string, id: string) {
  if ((await loadFinancialResetOperation(ownerId))?.id === id)
    await AsyncStorage.removeItem(key(ownerId));
}
