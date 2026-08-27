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
