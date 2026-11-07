import type { SQLiteDatabase } from 'expo-sqlite';

const tables = [
  'sync_state',
  'sync_mutation_queue',
  'sync_id_mappings',
  'sync_resource_state',
  'offline_entries',
  'finance_sync_conflicts',
  'finance_operations',
  'finance_corrections',
  'finance_drafts',
  'finance_transactions',
  'finance_categories',
  'finance_accounts',
  'tracking_events',
  'tracking_reviews',
  'tracking_duplicates',
  'tracking_history',
  'tracking_feedback',
  'planning_salary_profiles',
  'planning_salary_receipts',
  'planning_budgets',
  'planning_category_budgets',
  'planning_obligations',
  'planning_obligation_schedule_items',
  'planning_obligation_payments',
  'planning_savings_goals',
  'planning_goal_movements',
  'planning_drafts',
  'planning_sync_conflicts',
  'planning_payment_matches',
  'report_schedules',
  'report_output_attempts',
  'assistant_action_previews',
  'assistant_responses',
  'assistant_conversations',
  'voice_operation_journal',
  'voice_batch_operations'
] as const;

export async function eraseFinancialProjections(
  tx: Pick<SQLiteDatabase, 'execAsync'>
) {
  await tx.execAsync('PRAGMA defer_foreign_keys = ON');
  for (const name of tables) await tx.execAsync('DELETE FROM ' + name);
  await tx.execAsync(`DELETE FROM query_read_cache
    WHERE json_extract(query_key,'$[0]') IN ('core-finance','planning','reports','automatic-tracking','assistant','voice','financial-insights')`);
}
