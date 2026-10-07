import { z } from 'zod';
import { openDatabase } from './database';

export const voiceBatchOperationSchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    failureCode: z.literal('voice_canary_restricted').optional(),
    phase: z.enum([
      'captured',
      'created',
      'uploaded',
      'processing',
      'cancel_requested',
      'completed',
      'cancelled',
      'failed'
    ]),
    audioReference: z.string().max(2048).nullable(),
    locale: z.enum(['ar', 'en']),
    durationMs: z.number().int().min(1).max(60000),
    recordedAt: z.number().int().nonnegative(),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840),
    createBody: z.record(z.string(), z.unknown()).nullable(),
    sessionId: z.string().uuid().nullable(),
    version: z.number().int().positive().nullable(),
    retryAfterAt: z.number().int().nonnegative().optional(),
    processBody: z.record(z.string(), z.unknown()).nullable()
  })
  .strict();
export type VoiceBatchOperation = z.infer<typeof voiceBatchOperationSchema>;
export async function pruneVoiceBatches(owner: string): Promise<void> {
  const db = await openDatabase(owner);
  // Pending operations and failed media deletions always retain recovery ownership.
  const cleanTerminal =
    "json_extract(payload,'$.phase') IN ('completed','cancelled','failed') AND json_extract(payload,'$.audioReference') IS NULL";
  await db.runAsync(
    `DELETE FROM voice_batch_operations WHERE ${cleanTerminal} AND json_extract(payload,'$.recordedAt')<?`,
    Date.now() - 7 * 86400000
  );
  await db.runAsync(
    `DELETE FROM voice_batch_operations WHERE id IN (SELECT id FROM voice_batch_operations WHERE ${cleanTerminal} ORDER BY json_extract(payload,'$.recordedAt') DESC,id DESC LIMIT -1 OFFSET 100)`
  );
}
export async function loadVoiceBatches(
  owner: string
): Promise<VoiceBatchOperation[]> {
  const db = await openDatabase(owner);
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM voice_batch_operations ORDER BY id'
  );
  return rows.map((row) =>
    voiceBatchOperationSchema.parse(JSON.parse(row.payload))
  );
}
export async function saveVoiceBatch(
  owner: string,
  operation: VoiceBatchOperation
): Promise<void> {
  const db = await openDatabase(owner);
  const value = voiceBatchOperationSchema.parse(operation);
  const payload = JSON.stringify(value);
  if (payload.length > 8192) throw new Error('voice batch too large');
  if (value.revision === 0)
    await db.runAsync(
      'INSERT INTO voice_batch_operations(id,revision,payload) VALUES(?,?,?)',
      value.id,
      0,
      payload
    );
  else {
    const saved = await db.runAsync(
      'UPDATE voice_batch_operations SET revision=?,payload=? WHERE id=? AND revision=?',
      value.revision,
      payload,
      value.id,
      value.revision - 1
    );
    if (saved.changes !== 1) throw new Error('voice batch revision conflict');
  }
}
