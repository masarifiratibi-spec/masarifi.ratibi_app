import type { PoolClient } from 'pg';
import { financialGeneration } from '../http/financial-generation';

type FinancialClaimKind =
  'sync' | 'planning' | 'assistant' | 'voice-batch' | 'report' | 'report-schedule';

export async function bindFinancialClaim(
  client: PoolClient,
  kind: FinancialClaimKind,
  id: string,
  token: string | null,
): Promise<string> {
  const row = (
    await client.query<{ generation: string }>(
      'select private.bind_financial_worker_generation($1,$2::uuid,$3::uuid)::text generation',
      [kind, id, token],
    )
  ).rows[0];
  if (!row || !/^(0|[1-9][0-9]*)$/u.test(row.generation))
    throw new Error('FINANCIAL_WORKER_GENERATION_UNAVAILABLE');
  return row.generation;
}

// Binding the claim once preserves its generation across external I/O, pool checkouts and API role changes.
export function withClaimGeneration<T>(generation: string | undefined, action: () => T): T {
  return financialGeneration.run(generation ?? '', action);
}
