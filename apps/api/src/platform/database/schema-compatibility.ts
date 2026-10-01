import { Injectable } from '@nestjs/common';

import { PoolService } from './pool.service';

@Injectable()
export class SchemaCompatibilityService {
  constructor(private readonly database: PoolService) {}

  async check(timeoutMs = 1_000): Promise<void> {
    const result = await this.database.query<{ compatible: boolean | null }>(
      `select has_function_privilege(
        current_user,
        'private.resolve_category(text,uuid,text)',
        'execute'
      ) as compatible`,
      [],
      timeoutMs,
    );
    if (result.rows[0]?.compatible !== true) {
      throw new Error('SCHEMA_INCOMPATIBLE');
    }
  }
}
