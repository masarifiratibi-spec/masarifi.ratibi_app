import { Injectable } from '@nestjs/common';

import { PoolService } from '../database/pool.service';
import { schemaCompatibilityPredicate } from '../database/schema-compatibility';

export interface DependencyChecks {
  database: 'up' | 'down';
  queue: 'up' | 'down';
}

@Injectable()
export class ReadinessDependencies {
  constructor(private readonly database: PoolService) {}

  async check(timeoutMs: number): Promise<DependencyChecks> {
    try {
      const { rows } = await this.database.query<{
        compatible: boolean | null;
        healthy: boolean | null;
      }>(
        `select ${schemaCompatibilityPredicate} as compatible,
          case when has_schema_privilege(current_user, to_regnamespace('pgmq'), 'usage')
            and has_schema_privilege(current_user, to_regnamespace('public'), 'usage')
            and has_schema_privilege(current_user, to_regnamespace('private'), 'usage')
          then exists(select 1 from pg_extension where extname = 'pgmq')
            and to_regclass('pgmq."q_platform-events"') is not null
            and to_regclass('public.client_mutations') is not null
            and to_regprocedure('private.claim_client_mutations(text,integer,integer)') is not null
            and to_regclass('private.planning_job_claims') is not null
            and to_regprocedure('private.claim_planning_job(text,uuid,integer,integer)') is not null
          else false end as healthy`,
        [],
        timeoutMs,
      );
      return {
        database: rows[0]?.compatible === true ? 'up' : 'down',
        queue: rows[0]?.healthy === true ? 'up' : 'down',
      };
    } catch {
      return { database: 'down', queue: 'down' };
    }
  }
}
