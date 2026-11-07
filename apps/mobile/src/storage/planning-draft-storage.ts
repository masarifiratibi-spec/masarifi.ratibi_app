import type { PlanningDraft } from '@/domain/financial-planning';
import { FinancialPlanningError } from '@/domain/financial-planning';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';

interface DraftOwner {
  userId: string;
  assertCurrent(): Promise<void>;
}

export async function readPlanningDraft(
  owner: DraftOwner,
  id: string
): Promise<PlanningDraft | null> {
  const db = await openDatabase(owner.userId);
  await owner.assertCurrent();
  const row = await db.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM planning_drafts WHERE id = ? AND kind != 'report_schedule'",
    id
  );
  await owner.assertCurrent();
  if (!row) return null;
  const draft = JSON.parse(row.payload) as PlanningDraft;
  if (draft.id !== id || draft.kind === 'report_schedule')
    throw new FinancialPlanningError('validation');
  return draft;
}

export async function writePlanningDraft(
  owner: DraftOwner,
  draft: PlanningDraft
): Promise<PlanningDraft> {
  if (draft.kind === 'report_schedule')
    throw new FinancialPlanningError('validation');
  const value = { ...draft, updatedAt: Date.now() };
  const db = await openDatabase(owner.userId);
  await runExclusiveDatabaseTransaction(db, async (transaction) => {
    await owner.assertCurrent();
    await transaction.runAsync(
      `INSERT INTO planning_drafts(id,payload,kind,status,updated_at) VALUES(?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,kind=excluded.kind,status=excluded.status,updated_at=excluded.updated_at
       WHERE planning_drafts.kind != 'report_schedule'`,
      value.id,
      JSON.stringify(value),
      value.kind,
      value.status,
      value.updatedAt
    );
  });
  await owner.assertCurrent();
  return value;
}

export async function deletePlanningDraft(
  owner: DraftOwner,
  id: string
): Promise<void> {
  const db = await openDatabase(owner.userId);
  await runExclusiveDatabaseTransaction(db, async (transaction) => {
    await owner.assertCurrent();
    await transaction.runAsync(
      "DELETE FROM planning_drafts WHERE id = ? AND kind != 'report_schedule'",
      id
    );
  });
  await owner.assertCurrent();
}

export async function listPlanningDrafts(
  owner: DraftOwner,
  kind: PlanningDraft['kind']
): Promise<PlanningDraft[]> {
  if (kind === 'report_schedule')
    throw new FinancialPlanningError('validation');
  const db = await openDatabase(owner.userId);
  await owner.assertCurrent();
  const rows = await db.getAllAsync<{ id: string; payload: string }>(
    "SELECT id,payload FROM planning_drafts WHERE kind = ? AND status IN ('editing','valid') ORDER BY updated_at DESC,id ASC LIMIT 64",
    kind
  );
  await owner.assertCurrent();
  return rows.map((row) => {
    const draft = JSON.parse(row.payload) as PlanningDraft;
    if (draft.id !== row.id || draft.kind !== kind)
      throw new FinancialPlanningError('validation');
    return draft;
  });
}
