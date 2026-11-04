import { openDatabase, runExclusiveDatabaseTransaction } from './database';
import { clearAppShellUserData } from './app-shell-storage';
import { resetRuntimeUserData } from './runtime-user-data-reset';
import { clearPersistedPreferences } from './secure-preferences';
import { clearLegacySmsImportQueue, SmsImportQueue } from './sms-import-queue';
import { withTransactionDraftWrite } from './transaction-draft-snapshots';

import {
  captureTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';

type LocalDataDeletionResult = { deletedRows: number; operationId: string };
type SqliteLike = {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string): Promise<T[]>;
  runAsync(sql: string, ...values: unknown[]): Promise<{ changes: number }>;
};

const completed = new Map<string, LocalDataDeletionResult>();
export async function resetLocalUserData(
  operationId: string
): Promise<LocalDataDeletionResult> {
  const assertCurrent = captureTrackingAdmission();
  const partitionOwner = useTrackingAdmission.getState().nativeLease
    ? useTrackingAdmission.getState().admittedOwnerId
    : null;
  const replay = completed.get(operationId);
  if (replay) return replay;
  return withTransactionDraftWrite(async () => {
    assertCurrent();
    // Validate attribution before owner cleanup; legacy Tracking stays outside its scope.
    if (partitionOwner) await new SmsImportQueue().load(partitionOwner);
    let deletedRows = 0;
    const outcomes = await Promise.allSettled([
      (async () => {
        const database = await openDatabase();
        assertCurrent();
        await runExclusiveDatabaseTransaction(database, async (transaction) => {
          assertCurrent();
          const sqlite = transaction as SqliteLike;
          await sqlite.execAsync('PRAGMA defer_foreign_keys = ON');
          const tables = await sqlite.getAllAsync<{ name: string }>(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name != 'schema_migrations'
            AND name NOT LIKE 'sqlite_%'
        `);
          for (const { name } of tables) {
            if (
              partitionOwner &&
              ['sms_import_queue', 'sms_import_queue_v3'].includes(name)
            )
              continue;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
              throw new Error('invalid local data table');
            assertCurrent();
            deletedRows += (await sqlite.runAsync(`DELETE FROM "${name}"`))
              .changes;
          }
        });
      })(),
      clearAppShellUserData(),
      clearPersistedPreferences(),
      clearLegacySmsImportQueue()
    ]);
    if (partitionOwner) await new SmsImportQueue().clear(partitionOwner);
    await resetRuntimeUserData();
    const failure = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === 'rejected'
    );
    if (failure) throw failure.reason;

    const result = { deletedRows, operationId };
    completed.set(operationId, result);
    return result;
  });
}
