import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PoolService } from '../platform/database/pool.service';
import type { ClerkPrincipal } from './clerk-auth.guard';

@Injectable()
export class CustomerAdminRepository {
  constructor(private readonly pool: PoolService) {}

  async execute(
    principal: ClerkPrincipal,
    operation: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.transaction('masarifi_api', async (client) => {
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: principal.userId, sid: principal.sessionId, role: 'authenticated' }),
      ]);
      const sql =
        operation === 'detail'
          ? "select private.customer_admin($1,$2::jsonb) || jsonb_build_object('providerRevocationStatus',private.customer_admin_revocation_status($3)) value"
          : 'select private.customer_admin($1,$2::jsonb) value';
      const result = await client.query<{ value: Record<string, unknown> }>(
        sql,
        operation === 'detail'
          ? [operation, JSON.stringify(body), body.userId]
          : [operation, JSON.stringify(body)],
      );
      const value = result.rows[0]?.value;
      if (!value) throw new Error('CUSTOMER_RESULT_MISSING');
      return value;
    });
  }

  async withWorker<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.transaction('masarifi_worker', action);
  }

  private async transaction<T>(
    role: 'masarifi_api' | 'masarifi_worker',
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(`set local role ${role}`);
        const value = await action(client);
        await client.query('commit');
        return value;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}
