import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { trackingNativeRuntime } from './platform/tracking-native-runtime';
import type { TrackingNativeLease } from '@/state/tracking-admission';

const contextSchema = z
  .object({
    version: z.literal(3),
    ownerId: z.string().min(1).max(256),
    generation: z.string().min(16).max(80),
    phase: z.enum(['prepared', 'committed']),
    previousGeneration: z.string().min(16).max(80).optional(),
    configurationKey: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
  })
  .strict();
const legacySchema = z
  .object({
    ownerId: z.string().min(1).max(256),
    generation: z.string().min(16).max(80)
  })
  .strict();

export interface PreparedTrackingOwnerContext {
  ownerId: string;
  nativeLease: TrackingNativeLease;
  key: string;
  raw: string;
}

export function supportsTrackingOwnerPartitions(): boolean {
  return (
    typeof trackingNativeRuntime?.prepareTrackingOwnerV4 === 'function' &&
    typeof trackingNativeRuntime.commitTrackingOwnerV4 === 'function'
  );
}

function parsedJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error('tracking_restore_unavailable');
  }
}

function ownedContext(raw: string, ownerId: string) {
  const context = contextSchema.safeParse(parsedJson(raw));
  if (!context.success || context.data.ownerId !== ownerId)
    throw new Error('tracking_restore_unavailable');
  return context.data;
}

async function assertContextUnchanged(
  context: PreparedTrackingOwnerContext,
  assertCurrent: () => Promise<void>
) {
  await assertCurrent();
  if ((await SecureStore.getItemAsync(context.key)) !== context.raw)
    throw new Error('tracking_restore_unavailable');
  await assertCurrent();
}

async function sameOwnerLegacyGeneration(
  ownerId: string
): Promise<string | undefined> {
  const raw = await SecureStore.getItemAsync(
    'masarifi.tracking.background-context.v2'
  );
  if (raw === null) return undefined;
  let legacy: unknown;
  try {
    legacy = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // Unattributed legacy bytes stay dormant; the fresh namespace never adopts them.
    return undefined;
  }
  const parsed = legacySchema.safeParse(legacy);
  return parsed.success && parsed.data.ownerId === ownerId
    ? parsed.data.generation
    : undefined;
}

export async function prepareTrackingOwnerContext(
  ownerId: string,
  assertCurrent: () => Promise<void>,
  configurationKey?: string
): Promise<PreparedTrackingOwnerContext> {
  await assertCurrent();
  const ownerDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ownerId
  );
  await assertCurrent();
  await trackingNativeRuntime!.suspendTrackingOwner();
  await assertCurrent();
  const key = `masarifi.tracking.background-context.v3.${ownerDigest}`;
  const saved = await SecureStore.getItemAsync(key);
  const stored = saved === null ? null : ownedContext(saved, ownerId);
  const rotate =
    stored &&
    configurationKey !== undefined &&
    stored.configurationKey !== configurationKey;
  const generation = rotate
    ? Crypto.randomUUID()
    : (stored?.generation ?? Crypto.randomUUID());
  const previousGeneration = rotate
    ? stored.generation
    : stored?.previousGeneration;
  const raw = JSON.stringify(
    contextSchema.parse({
      version: 3,
      ownerId,
      generation,
      phase: 'prepared',
      ...(previousGeneration ? { previousGeneration } : {}),
      ...((configurationKey ?? stored?.configurationKey)
        ? { configurationKey: configurationKey ?? stored?.configurationKey }
        : {})
    })
  );
  const legacyGeneration = await sameOwnerLegacyGeneration(ownerId);
  await assertCurrent();
  // An intent precedes native preparation so a crash cannot lose its generation.
  await SecureStore.setItemAsync(key, raw);
  const prepared = {
    ownerId,
    nativeLease: { ownerDigest, generation },
    key,
    raw
  };
  await assertContextUnchanged(prepared, assertCurrent);
  await trackingNativeRuntime!.prepareTrackingOwnerV4!(
    JSON.stringify({
      ownerDigest,
      generation,
      ...(previousGeneration ? { previousGeneration } : {}),
      ...(legacyGeneration ? { legacyGeneration } : {})
    })
  );
  await assertContextUnchanged(prepared, assertCurrent);
  return prepared;
}

export async function commitTrackingOwnerContext(
  context: PreparedTrackingOwnerContext,
  assertCurrent: () => Promise<void>
): Promise<TrackingNativeLease> {
  await assertContextUnchanged(context, assertCurrent);
  const committed = JSON.stringify({
    ...ownedContext(context.raw, context.ownerId),
    phase: 'committed'
  });
  await SecureStore.setItemAsync(context.key, committed);
  await assertContextUnchanged({ ...context, raw: committed }, assertCurrent);
  await trackingNativeRuntime!.commitTrackingOwnerV4!(
    context.nativeLease.ownerDigest,
    context.nativeLease.generation
  );
  await assertContextUnchanged({ ...context, raw: committed }, assertCurrent);
  return context.nativeLease;
}

export async function readTrackingOwnerContext(ownerId: string) {
  const ownerDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ownerId
  );
  const key = `masarifi.tracking.background-context.v3.${ownerDigest}`;
  const raw = await SecureStore.getItemAsync(key);
  return raw === null
    ? null
    : { ...ownedContext(raw, ownerId), ownerDigest, key, raw };
}
