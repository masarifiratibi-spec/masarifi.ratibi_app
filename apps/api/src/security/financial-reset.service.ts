import type { PoolClient } from 'pg';
import { HttpException, Injectable } from '@nestjs/common';
import { isRecentClerkAuthentication, type ClerkPrincipal } from '../identity/clerk-auth.guard';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { SecurityRepository } from './security.repository';

interface ResetRow {
  generation: string;
  reset_at: Date | null;
  request_id: string | null;
  cleanup_pending: boolean;
}

function receipt(row: ResetRow | undefined) {
  if (!row?.request_id) throw new HttpException({ code: 'NOT_FOUND' }, 404);
  return {
    id: row.request_id,
    status: row.cleanup_pending ? ('processing' as const) : ('completed' as const),
    generation: Number(row.generation),
  };
}

@Injectable()
export class FinancialResetService {
  constructor(
    private readonly repository: SecurityRepository,
    private readonly config: PlatformConfigService,
  ) {}

  reset(principal: ClerkPrincipal, operationId: string) {
    if (
      !isRecentClerkAuthentication(
        principal,
        this.config.getRequired('MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS'),
      )
    )
      throw new HttpException({ code: 'RECENT_AUTH_REQUIRED' }, 403);
    return this.transaction(principal, async (client) => {
      // Large histories need a longer statement budget than the default for interactive queries.
      await client.query("set local lock_timeout = '3s'");
      await client.query("set local statement_timeout = '60s'");
      const resetQuery = {
        text: 'select * from private.reset_financial_data($1,$2::uuid)',
        values: [principal.userId, operationId],
        query_timeout: 65_000,
      };
      const result = await client.query<ResetRow>(resetQuery);
      return receipt(result.rows[0]);
    });
  }

  receipt(principal: ClerkPrincipal, id: string) {
    return this.transaction(principal, async (client) => {
      const result = await client.query<ResetRow>(
        'select * from private.financial_reset_receipt($1,$2::uuid)',
        [principal.userId, id],
      );
      return receipt(result.rows[0]);
    });
  }

  state(principal: ClerkPrincipal) {
    return this.transaction(principal, async (client) => {
      const result = await client.query<ResetRow>(
        'select * from private.financial_reset_state($1)',
        [principal.userId],
      );
      const row = result.rows[0];
      if (!row) throw new Error('FINANCIAL_RESET_STATE_UNAVAILABLE');
      return {
        generation: Number(row.generation),
        resetAt: row.reset_at?.toISOString() ?? null,
        status: row.cleanup_pending ? ('processing' as const) : ('ready' as const),
        requestId: row.request_id,
      };
    });
  }
  private async transaction<T>(
    principal: ClerkPrincipal,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repository.withPrincipalTransaction(principal, work);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        if (error.code === '42501' && error.message === 'PROFILE_INACTIVE')
          throw new HttpException({ code: 'PROFILE_INACTIVE' }, 403);
        if (error.code === '28000' && error.message === 'AUTH_TOKEN_INVALID')
          throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
        if (error.code === '55P03' || error.code === '40P01')
          throw new HttpException({ code: 'FINANCIAL_RESET_WORK_BUSY' }, 409);
      }
      throw error;
    }
  }
}
