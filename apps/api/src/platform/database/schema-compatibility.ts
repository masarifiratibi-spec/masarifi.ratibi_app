import { Injectable } from '@nestjs/common';

import { PoolService } from './pool.service';

// Resolving to an OID lets a missing function report an incompatible schema.
export const schemaCompatibilityPredicate = `case
  when has_schema_privilege(current_user, to_regnamespace('private'), 'usage')
  then has_function_privilege(current_user, to_regprocedure('private.resolve_category(text,uuid,text)'), 'execute')
  else false end`;

@Injectable()
export class SchemaCompatibilityService {
  constructor(private readonly database: PoolService) {}

  async check(timeoutMs = 1_000): Promise<void> {
    const result = await this.database.query<{ compatible: boolean | null }>(
      `select ${schemaCompatibilityPredicate} as compatible`,
      [],
      timeoutMs,
    );
    if (result.rows[0]?.compatible !== true) {
      throw new Error('SCHEMA_INCOMPATIBLE');
    }
  }
}
