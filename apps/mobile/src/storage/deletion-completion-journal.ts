import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const ownersKey = 'masarifi.deletionCompletion.owners';
const journalSchema = z
  .object({
    ownerId: z.string().min(1),
    operationId: z.string().uuid(),
    completionToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    phase: z.enum([
      'prepared',
      'submitted',
      'rejected',
      'verification_required',
      'server_completed',
      'local_completed'
    ]),
    requestId: z.string().min(1).nullable(),
    completedAt: z.string().datetime().nullable(),
    attempts: z.number().int().nonnegative(),
    nextAttemptAt: z.number().int().nonnegative(),
    retryAfterAt: z.number().int().nonnegative().default(0)
  })
  .strict()
  .refine(
    (journal) =>
      (journal.phase === 'local_completed'
        ? journal.completionToken === null
        : journal.completionToken !== null) &&
      (!['server_completed', 'local_completed'].includes(journal.phase) ||
        (journal.requestId !== null && journal.completedAt !== null))
  );
export type DeletionCompletionJournal = z.infer<typeof journalSchema>;
let indexQueue = Promise.resolve();

async function ownerHash(ownerId: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, ownerId);
}

async function journalKey(ownerId: string): Promise<string> {
  return `masarifi.deletionCompletion.capability.${await ownerHash(ownerId)}`;
}

export async function pendingDeletionOwners(): Promise<string[]> {
  const serialized = await AsyncStorage.getItem(ownersKey);
  return serialized === null
    ? []
    : z.array(z.string().min(1)).parse(JSON.parse(serialized));
}

async function updateOwnerIndex(
  ownerId: string,
  include: boolean
): Promise<void> {
  const operation = indexQueue.then(async () => {
    const owners = new Set(await pendingDeletionOwners());
    if (include) owners.add(ownerId);
    else owners.delete(ownerId);
    if (owners.size)
      await AsyncStorage.setItem(ownersKey, JSON.stringify([...owners]));
    else await AsyncStorage.removeItem(ownersKey);
  });
  indexQueue = operation.catch(() => undefined);
  await operation;
}

export async function loadDeletionCompletion(
  ownerId: string
): Promise<DeletionCompletionJournal | null> {
  const serialized = await SecureStore.getItemAsync(await journalKey(ownerId));
  if (serialized === null) return null;
  const journal = journalSchema.parse(JSON.parse(serialized));
  if (journal.ownerId !== ownerId) throw new Error('deletion owner mismatch');
  return journal;
}

export async function saveDeletionCompletion(
  journal: DeletionCompletionJournal
): Promise<void> {
  journalSchema.parse(journal);
  await SecureStore.setItemAsync(
    await journalKey(journal.ownerId),
    JSON.stringify(journal)
  );
  await updateOwnerIndex(journal.ownerId, true);
}

export function ensureDeletionCompletionIndexed(
  ownerId: string
): Promise<void> {
  return updateOwnerIndex(ownerId, true);
}

export async function prepareDeletionCompletion(
  ownerId: string
): Promise<DeletionCompletionJournal> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const journal: DeletionCompletionJournal = {
    ownerId,
    operationId: Crypto.randomUUID(),
    completionToken: Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join(''),
    phase: 'prepared',
    requestId: null,
    completedAt: null,
    attempts: 0,
    nextAttemptAt: 0,
    retryAfterAt: 0
  };
  await saveDeletionCompletion(journal);
  return journal;
}

export async function retainDeletedOwnerFence(ownerId: string): Promise<void> {
  await SecureStore.setItemAsync(
    `masarifi.deletionCompletion.completed.${await ownerHash(ownerId)}`,
    'completed'
  );
}

export async function isDeletionOwnerFenced(ownerId: string): Promise<boolean> {
  return (
    (await SecureStore.getItemAsync(
      `masarifi.deletionCompletion.completed.${await ownerHash(ownerId)}`
    )) === 'completed' || (await loadDeletionCompletion(ownerId)) !== null
  );
}

export async function removeDeletionCompletion(ownerId: string): Promise<void> {
  await updateOwnerIndex(ownerId, false);
  try {
    await SecureStore.deleteItemAsync(await journalKey(ownerId));
  } catch (failure) {
    await updateOwnerIndex(ownerId, true);
    throw failure;
  }
}
