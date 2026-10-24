import { draftInputSchema, type TransactionDraft } from '@/domain/core-finance';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';
import {
  type DraftOwner,
  readTransactionDraftSnapshot,
  withTransactionDraftWrite
} from './transaction-draft-snapshots';

export function mergeTransactionDraft(
  prior: TransactionDraft | null | undefined,
  draft: TransactionDraft
): TransactionDraft {
  // An ordinary autosave cannot erase a durably submitted operation.
  if (prior?.submission && draft.submission === undefined) return prior;
  if (
    prior?.submission &&
    draft.submission &&
    prior.submission.operationId !== draft.submission.operationId
  )
    throw new CoreFinanceError('conflict', {
      domainCode: 'MANUAL_SUBMISSION_CONFLICT',
      uncertain: false
    });
  return { ...draft, updatedAt: Date.now() };
}

async function readDraftRow(
  db: Pick<Awaited<ReturnType<typeof openDatabase>>, 'getFirstAsync'>,
  id: string
): Promise<TransactionDraft | null> {
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM finance_drafts WHERE id = ?',
    id
  );
  if (!row) return null;
  const draft = JSON.parse(row.payload) as TransactionDraft;
  if (!draft || draft.id !== id) throw new CoreFinanceError('validation');
  return draft;
}

export async function readTransactionDraft(
  owner: DraftOwner,
  id: string
): Promise<TransactionDraft | null> {
  return readTransactionDraftSnapshot(owner, id, async () => {
    const db = await openDatabase(owner.userId);
    await owner.assertCurrent();
    const draft = await readDraftRow(db, id);
    await owner.assertCurrent();
    return draft;
  });
}

export async function writeTransactionDraft(
  owner: DraftOwner,
  draft: TransactionDraft
): Promise<TransactionDraft> {
  return withTransactionDraftWrite(async () => {
    const input = draftInputSchema.parse(draft);
    const db = await openDatabase(owner.userId);
    let saved!: TransactionDraft;
    await runExclusiveDatabaseTransaction(db, async (transaction) => {
      await owner.assertCurrent();
      const prior = await readDraftRow(transaction, input.id);
      saved = mergeTransactionDraft(prior, input);
      await owner.assertCurrent();
      if (saved !== prior)
        await transaction.runAsync(
          'INSERT INTO finance_drafts(id,payload,status,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated_at=excluded.updated_at',
          saved.id,
          JSON.stringify(saved),
          saved.status,
          saved.updatedAt
        );
      await owner.assertCurrent();
    });
    await owner.assertCurrent();
    return saved;
  });
}

export async function deleteTransactionDraft(
  owner: DraftOwner,
  id: string
): Promise<void> {
  return withTransactionDraftWrite(async () => {
    const db = await openDatabase(owner.userId);
    await runExclusiveDatabaseTransaction(db, async (transaction) => {
      await owner.assertCurrent();
      await transaction.runAsync('DELETE FROM finance_drafts WHERE id = ?', id);
      await owner.assertCurrent();
    });
    await owner.assertCurrent();
  });
}
