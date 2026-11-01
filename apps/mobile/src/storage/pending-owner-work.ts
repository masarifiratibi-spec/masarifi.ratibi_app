import { openDatabase, hasQuarantinedOwnerDatabase } from './database';

export async function pendingOwnerWork(ownerId: string): Promise<number> {
  if (await hasQuarantinedOwnerDatabase(ownerId))
    throw new Error('unrecoverable owner work');
  const database = await openDatabase(ownerId);
  const row = await database.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT count(*) FROM sync_mutation_queue WHERE status!='applied') +
      (SELECT count(*) FROM finance_drafts) +
      (SELECT count(*) FROM planning_drafts WHERE status!='saved') +
      (SELECT count(*) FROM voice_operation_journal WHERE
        json_extract(payload,'$.phase') NOT IN ('saved','cancelled','terminal') OR
        json_extract(payload,'$.audioReference') IS NOT NULL) +
      (SELECT count(*) FROM voice_batch_operations WHERE
        json_extract(payload,'$.phase') NOT IN ('completed','cancelled','failed') OR
        json_extract(payload,'$.audioReference') IS NOT NULL) AS count`);
  if (!row || !Number.isSafeInteger(row.count) || row.count < 0)
    throw new Error('pending work unavailable');
  const sms = await database.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM sms_import_queue WHERE id=?',
    'singleton'
  );
  const pending: unknown = sms ? JSON.parse(sms.payload).pending : [];
  if (!Array.isArray(pending)) throw new Error('pending work unavailable');
  return row.count + pending.length;
}

export async function ownerVoiceAudioReferences(
  ownerId: string
): Promise<string[]> {
  const database = await openDatabase(ownerId);
  const rows = await database.getAllAsync<{ uri: string | null }>(`
    SELECT json_extract(payload,'$.audioReference') AS uri FROM voice_operation_journal
    UNION SELECT json_extract(payload,'$.audioReference') AS uri FROM voice_batch_operations`);
  return rows.flatMap(({ uri }) =>
    typeof uri === 'string' && uri.startsWith('file://') ? [uri] : []
  );
}
