import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { z } from 'zod';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';

const captureBodySchema = z
  .object({
    locale: z.enum(['ar', 'en']),
    durationMs: z.number().int().min(1).max(60_000),
    contentType: z.enum([
      'audio/m4a',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm'
    ]),
    sizeBytes: z.number().int().min(1).max(12_582_912),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    recordedAt: z.string().datetime(),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840)
  })
  .strict();

export const voiceOperationSchema = z
  .object({
    attemptId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    phase: z.enum([
      'captured',
      'creating',
      'created',
      'uploaded',
      'processing',
      'reviewing',
      'confirming',
      'confirmation_unknown',
      'saved',
      'cancel_requested',
      'cancelled',
      'terminal'
    ]),
    createKey: z.string().uuid(),
    processKey: z.string().uuid(),
    cancelKey: z.string().uuid(),
    createBody: captureBodySchema.nullable(),
    sessionId: z.string().uuid().nullable(),
    sessionVersion: z.number().int().positive().nullable(),
    processBody: z
      .object({
        uploadCompleted: z.literal(true),
        expectedVersion: z.number().int().positive(),
        contentHash: z.string().regex(/^[0-9a-f]{64}$/)
      })
      .strict()
      .nullable(),
    proposalId: z.string().uuid().nullable(),
    proposalVersion: z.number().int().positive().nullable(),
    confirmationKey: z.string().uuid().nullable(),
    confirmationBody: z.record(z.string(), z.unknown()).nullable(),
    transactionId: z.string().uuid().nullable(),
    audioReference: z.string().min(1).max(2048).nullable(),
    createdAt: z.number().int().nonnegative()
  })
  .strict();
export type VoiceOperation = z.infer<typeof voiceOperationSchema>;

export async function loadVoiceOperation(
  ownerId: string
): Promise<VoiceOperation | null> {
  const database = await openDatabase(ownerId);
  const row = await database.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM voice_operation_journal WHERE id='singleton'"
  );
  return row ? voiceOperationSchema.parse(JSON.parse(row.payload)) : null;
}

export async function saveVoiceOperation(
  ownerId: string,
  operation: VoiceOperation,
  create = false
): Promise<void> {
  const value = voiceOperationSchema.parse(operation);
  const payload = JSON.stringify(value);
  if (payload.length > 24_000) throw new Error('voice operation too large');
  const database = await openDatabase(ownerId);
  await runExclusiveDatabaseTransaction(database, async (transaction) => {
    if (create) {
      const row = await transaction.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM voice_operation_journal WHERE id='singleton'"
      );
      if (
        row &&
        !['saved', 'cancelled', 'terminal'].includes(
          voiceOperationSchema.parse(JSON.parse(row.payload)).phase
        )
      )
        throw new Error('pending voice operation');
      await transaction.runAsync(
        'INSERT INTO voice_operation_journal (id,attempt_id,revision,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET attempt_id=excluded.attempt_id,revision=excluded.revision,payload=excluded.payload',
        'singleton',
        value.attemptId,
        value.revision,
        payload
      );
    } else {
      const result = await transaction.runAsync(
        "UPDATE voice_operation_journal SET revision=?,payload=? WHERE id='singleton' AND attempt_id=? AND revision=?",
        value.revision,
        payload,
        value.attemptId,
        value.revision - 1
      );
      if (Number(result.changes) !== 1)
        throw new Error('stale voice operation');
    }
  });
}

export async function clearVoiceOperation(
  ownerId: string,
  attemptId: string
): Promise<void> {
  const database = await openDatabase(ownerId);
  await runExclusiveDatabaseTransaction(database, async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM voice_operation_journal WHERE id='singleton' AND attempt_id=?",
      attemptId
    );
  });
}

const pendingSchema = z
  .object({
    sessionId: z.string().uuid(),
    sessionVersion: z.number().int().positive(),
    recordedAt: z.number().int().nonnegative(),
    timezoneOffsetMinutes: z.number().int(),
    createdAt: z.number().int().nonnegative()
  })
  .strict();

export type PendingVoiceSession = z.infer<typeof pendingSchema>;

function key(ownerId: string): string {
  const hash = bytesToHex(sha256(new TextEncoder().encode(ownerId))).slice(
    0,
    24
  );
  return `masarifi.voice.pending.${hash}`;
}

export async function loadPendingVoiceSession(
  ownerId: string
): Promise<PendingVoiceSession | null> {
  const raw = await AsyncStorage.getItem(key(ownerId));
  if (!raw) return null;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePendingVoiceSession(
  ownerId: string,
  pending: PendingVoiceSession
): Promise<void> {
  return AsyncStorage.setItem(key(ownerId), JSON.stringify(pending));
}

export function clearPendingVoiceSession(ownerId: string): Promise<void> {
  return AsyncStorage.removeItem(key(ownerId));
}
