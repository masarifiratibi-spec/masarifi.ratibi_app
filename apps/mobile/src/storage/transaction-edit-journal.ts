import { z } from 'zod';
import { transactionInputSchema } from '@/domain/core-finance';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';
import {
  type DraftOwner,
  withTransactionDraftWrite
} from './transaction-draft-snapshots';

export const TRANSACTION_EDIT_JOURNAL_PREFIX = '__transaction_edit_v1__:';
export const isTransactionEditJournalId = (id: string) =>
  id.startsWith(TRANSACTION_EDIT_JOURNAL_PREFIX);
export function assertOrdinaryDraftId(id: string): void {
  if (isTransactionEditJournalId(id)) throw new CoreFinanceError('validation');
}
const patchSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.literal('Mobile edit'),
    kind: z.enum(['expense', 'income']).optional(),
    amountMinor: z.number().int().safe().nonnegative().optional(),
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    title: z.string().optional(),
    merchant: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    occurredAt: z.string().datetime().optional()
  })
  .strict();
const journalSchema = z
  .object({
    version: z.literal(1),
    resourceId: z.string().uuid(),
    serverResourceId: z.string().uuid().optional(),
    operationId: z.string().uuid(),
    input: transactionInputSchema,
    body: patchSchema
  })
  .strict();
export type TransactionEditJournal = z.infer<typeof journalSchema>;
export type EditJournalDatabase = Pick<
  Awaited<ReturnType<typeof openDatabase>>,
  'getFirstAsync'
>;
export type TransactionEditGuard = (
  database?: EditJournalDatabase
) => Promise<void>;
export const uncertainEdit = () =>
  new CoreFinanceError('offline', {
    domainCode: 'TRANSACTION_OUTCOME_UNCERTAIN',
    uncertain: true
  });

export async function assertNoQueuedTransactionMutation(
  owner: DraftOwner,
  resourceId: string,
  database?: EditJournalDatabase
): Promise<void> {
  const connection = database ?? (await openDatabase(owner.userId));
  await owner.assertCurrent();
  const queued = await connection.getFirstAsync<{ operation_id: string }>(
    `SELECT operation_id FROM sync_mutation_queue
     WHERE domain='transactions' AND resource_type='transaction'
       AND (resource_id=? OR resource_id IN (SELECT server_id FROM sync_id_mappings WHERE domain='transactions' AND local_id=?))
       AND status NOT IN ('applied','conflict','rejected') LIMIT 1`,
    resourceId, resourceId
  );
  await owner.assertCurrent();
  if (queued) throw uncertainEdit();
}

export async function readTransactionEditJournal(
  owner: DraftOwner,
  resourceId: string,
  database?: EditJournalDatabase
): Promise<TransactionEditJournal | null> {
  const connection = database ?? (await openDatabase(owner.userId));
  await owner.assertCurrent();
  const row = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM finance_drafts WHERE id = ?',
    TRANSACTION_EDIT_JOURNAL_PREFIX + resourceId
  );
  await owner.assertCurrent();
  if (!row) return null;
  const journal = journalSchema.parse(JSON.parse(row.payload));
  if (journal.resourceId !== resourceId) throw uncertainEdit();
  return journal;
}

export async function writeTransactionEditJournal(
  owner: DraftOwner,
  journal: TransactionEditJournal
): Promise<void> {
  const validated = journalSchema.parse(journal);
  await withTransactionDraftWrite(async () => {
    const database = await openDatabase(owner.userId);
    await owner.assertCurrent();
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      // Serialize queue authority with journal creation. Offline producers check
      // this journal through the same exclusive transaction boundary.
      await assertNoQueuedTransactionMutation(
        owner,
        journal.resourceId,
        transaction
      );
      const prior = await transaction.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM finance_drafts WHERE id = ?',
        TRANSACTION_EDIT_JOURNAL_PREFIX + journal.resourceId
      );
      await owner.assertCurrent();
      if (
        prior &&
        JSON.stringify(journalSchema.parse(JSON.parse(prior.payload))) !==
          JSON.stringify(validated)
      )
        throw uncertainEdit();
      await transaction.runAsync(
        'INSERT INTO finance_drafts(id,payload,status,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated_at=excluded.updated_at',
        TRANSACTION_EDIT_JOURNAL_PREFIX + journal.resourceId,
        JSON.stringify(validated),
        'saving',
        Date.now()
      );
      await owner.assertCurrent();
    });
  });
}

export async function deleteTransactionEditJournal(
  owner: DraftOwner,
  journal: TransactionEditJournal,
  persistAcknowledgement?: (
    database: Awaited<ReturnType<typeof openDatabase>>
  ) => Promise<void>
): Promise<void> {
  await withTransactionDraftWrite(async () => {
    const database = await openDatabase(owner.userId);
    await owner.assertCurrent();
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const row = await transaction.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM finance_drafts WHERE id = ?',
        TRANSACTION_EDIT_JOURNAL_PREFIX + journal.resourceId
      );
      await owner.assertCurrent();
      if (
        !row ||
        journalSchema.parse(JSON.parse(row.payload)).operationId !==
          journal.operationId
      )
        throw uncertainEdit();
      await persistAcknowledgement?.(transaction);
      await owner.assertCurrent();
      await transaction.runAsync(
        'DELETE FROM finance_drafts WHERE id = ?',
        TRANSACTION_EDIT_JOURNAL_PREFIX + journal.resourceId
      );
      await owner.assertCurrent();
    });
  });
}
