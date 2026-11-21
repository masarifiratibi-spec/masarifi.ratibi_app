import { Injectable } from '@nestjs/common';

import { PoolService } from '../database/pool.service';

export type DependencyState = 'up' | 'down';

@Injectable()
export class QueueHealthIndicator {
  constructor(private readonly database: PoolService) {}

  async check(timeoutMs: number): Promise<DependencyState> {
    try {
      const result = await this.database.query<{ healthy: boolean }>(
        `select (
          exists(select 1 from pg_extension where extname = 'pgmq')
        and to_regclass('pgmq."q_platform-events"') is not null
        and to_regclass('public.client_mutations') is not null
        and to_regprocedure('private.claim_client_mutations(text,integer,integer)') is not null
        and to_regclass('private.planning_job_claims') is not null
        and to_regprocedure('private.claim_planning_job(text,uuid,integer,integer)') is not null
        ) as healthy`,
        [],
        timeoutMs,
      );
      return result.rows[0]?.healthy === true ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
