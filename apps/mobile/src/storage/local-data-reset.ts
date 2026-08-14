import { openDatabase, runExclusiveDatabaseTransaction } from './database';

type LocalDataDeletionResult = { deletedRows: number; operationId: string };
type SqliteLike = {
  getAllAsync<T>(sql: string): Promise<T[]>;
  runAsync(sql: string, ...values: unknown[]): Promise<{ changes: number }>;
};

const completed = new Map<string, LocalDataDeletionResult>();
const resetTables = [
  'notifications',
  'assistant_conversations',
  'support_drafts',
  'finance_transactions'
] as const;

export async function resetLocalUserData(operationId: string): Promise<LocalDataDeletionResult> {
  const replay = completed.get(operationId);
  if (replay) return replay;

  const database = await openDatabase();
  let deletedRows = 0;
  await runExclusiveDatabaseTransaction(database, async (transaction) => {
    for (const table of resetTables) {
      for (const row of await (transaction as SqliteLike).getAllAsync<{ id: string }>(`SELECT id FROM ${table}`)) {
        deletedRows += (await (transaction as SqliteLike).runAsync(`DELETE FROM ${table} WHERE id = ?`, row.id)).changes;
      }
    }
  });

  const result = { deletedRows, operationId };
  completed.set(operationId, result);
  return result;
}
